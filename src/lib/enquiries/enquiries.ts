import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { createPurchaseOrder } from "@/lib/orders/po";

const STATUSES = ["NEW", "QUOTING", "QUOTED", "WON", "LOST", "DROPPED"] as const;
type EnquiryStatus = (typeof STATUSES)[number];

/**
 * Allowed status targets for a manual updateEnquiry (same-status no-ops are always
 * allowed and handled separately). WON is never a valid target here — only
 * convertToOrder sets WON, alongside convertedPoId. LOST/DROPPED are terminal:
 * reachable going forward but never back to NEW/QUOTING (no resurrection / backflow).
 */
const ALLOWED_STATUS_TRANSITIONS: Record<EnquiryStatus, EnquiryStatus[]> = {
  NEW: ["QUOTING", "QUOTED", "LOST", "DROPPED"],
  QUOTING: ["QUOTED", "LOST", "DROPPED"],
  QUOTED: ["QUOTING", "LOST", "DROPPED"],
  WON: [],
  LOST: [],
  DROPPED: [],
};

export const createEnquirySchema = z.object({
  buyerId: z.string().min(1),
  brandId: z.string().min(1),
  factoryId: z.string().optional(),
  styleRef: z.string().min(1),
  targetQty: z.coerce.number().int().positive().optional(),
  targetPriceUsd: z.coerce.number().nonnegative().optional(),
  requiredShipDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});
export type CreateEnquiryInput = z.input<typeof createEnquirySchema>;

async function assertBrandInBuyer(actor: SessionUser, buyerId: string, brandId: string) {
  const brand = await prisma.brand.findFirst({ where: { id: brandId, companyId: tenantId(actor) } });
  if (!brand || brand.buyerId !== buyerId) throw new Error("Brand does not belong to the specified buyer");
}

export async function createEnquiry(actor: SessionUser, input: CreateEnquiryInput) {
  assertPermission(actor, "orders", "create");
  const data = createEnquirySchema.parse(input);
  await assertBrandInBuyer(actor, data.buyerId, data.brandId);
  const enq = await prisma.enquiry.create({
    data: {
      companyId: tenantId(actor),
      buyerId: data.buyerId,
      brandId: data.brandId,
      factoryId: data.factoryId || null,
      styleRef: data.styleRef.trim(),
      targetQty: data.targetQty,
      targetPriceUsd: data.targetPriceUsd != null ? String(data.targetPriceUsd) : null,
      requiredShipDate: data.requiredShipDate,
      notes: data.notes,
    },
  });
  await recordAudit({ userId: actor.id, entityType: "Enquiry", entityId: enq.id, action: "create", after: { styleRef: enq.styleRef } });
  return enq;
}

export async function listEnquiries(actor: SessionUser, filter: { status?: string } = {}) {
  assertPermission(actor, "orders", "view");
  return prisma.enquiry.findMany({
    where: {
      companyId: tenantId(actor),
      ...(filter.status ? { status: filter.status as (typeof STATUSES)[number] } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function getEnquiry(actor: SessionUser, id: string) {
  assertPermission(actor, "orders", "view");
  return prisma.enquiry.findFirst({ where: { id, companyId: tenantId(actor) } });
}

export const updateEnquirySchema = z.object({
  status: z.enum(STATUSES).optional(),
  quotedPriceUsd: z.coerce.number().nonnegative().optional(),
  targetQty: z.coerce.number().int().positive().nullish(),
  targetPriceUsd: z.coerce.number().nonnegative().nullish(),
  requiredShipDate: z.coerce.date().nullish(),
  notes: z.string().nullish(),
  lostReason: z.string().nullish(),
  factoryId: z.string().optional(),
});

export async function updateEnquiry(actor: SessionUser, id: string, input: z.input<typeof updateEnquirySchema>) {
  assertPermission(actor, "orders", "edit");
  const data = updateEnquirySchema.parse(input);
  // Load the enquiry first so we can (a) gate edits on a converted enquiry and
  // (b) validate any requested status transition against its current status.
  const current = await prisma.enquiry.findFirst({ where: { id, companyId: tenantId(actor) } });
  if (!current) throw new Error("Enquiry not found");
  const patch: Record<string, string | number | Date | null> = {};
  if (data.status && data.status !== current.status) {
    // A converted enquiry (convertedPoId set, status WON) backs a live order — its
    // status is frozen. Only benign edits (notes, etc.) remain allowed.
    if (current.convertedPoId) {
      throw new Error("This enquiry has been converted to an order; its status can no longer be changed");
    }
    // Enforce the allowed-transition table. WON is intentionally never a valid
    // target (only convertToOrder sets it); terminal states have no exits.
    if (!ALLOWED_STATUS_TRANSITIONS[current.status].includes(data.status)) {
      throw new Error(`Cannot change enquiry status from ${current.status} to ${data.status}`);
    }
    patch.status = data.status;
  }
  if (data.quotedPriceUsd != null) patch.quotedPriceUsd = String(data.quotedPriceUsd);
  if (data.targetQty !== undefined) patch.targetQty = data.targetQty;
  if (data.targetPriceUsd !== undefined) patch.targetPriceUsd = data.targetPriceUsd != null ? String(data.targetPriceUsd) : null;
  if (data.requiredShipDate !== undefined) patch.requiredShipDate = data.requiredShipDate ?? null;
  if (data.notes !== undefined) patch.notes = data.notes || null;
  if (data.lostReason !== undefined) patch.lostReason = data.lostReason || null;
  if (data.factoryId !== undefined) {
    const fid = data.factoryId || null;
    // Cross-tenant IDOR guard: a factory may only be assigned if it belongs to this tenant.
    if (fid) {
      const factory = await prisma.factory.findFirst({ where: { id: fid, companyId: tenantId(actor) } });
      if (!factory) throw new Error("Factory not found");
    }
    patch.factoryId = fid;
  }
  const res = await prisma.enquiry.updateMany({ where: { id, companyId: tenantId(actor) }, data: patch });
  if (res.count === 0) throw new Error("Enquiry not found");
  const enq = await prisma.enquiry.findFirst({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "Enquiry", entityId: id, action: "edit", after: patch });
  return enq;
}

/** Hard-delete an enquiry. Blocked once it has been converted to a purchase order. */
export async function deleteEnquiry(actor: SessionUser, id: string) {
  assertPermission(actor, "orders", "edit");
  const enq = await prisma.enquiry.findFirst({ where: { id, companyId: tenantId(actor) } });
  if (!enq) throw new Error("Enquiry not found");
  if (enq.convertedPoId) throw new Error("Cannot delete an enquiry that has been converted to an order");
  await prisma.enquiry.deleteMany({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "Enquiry", entityId: id, action: "delete" });
}

/** A PO number derived from the (full) enquiry id, optionally disambiguated on collision. */
function enquiryPoNumber(enquiryId: string, salt?: string): string {
  const base = `Q-${enquiryId.toUpperCase()}`;
  return salt ? `${base}-${salt.toUpperCase()}` : base;
}

/** Convert a won enquiry into a DRAFT purchase order, pre-filled from the enquiry. */
export async function convertToOrder(actor: SessionUser, id: string) {
  assertPermission(actor, "orders", "create");
  const cid = tenantId(actor);
  const enq = await prisma.enquiry.findFirst({ where: { id, companyId: cid } });
  if (!enq) throw new Error("Enquiry not found");
  if (enq.convertedPoId) throw new Error("This enquiry has already been converted to an order");
  if (!enq.factoryId) throw new Error("Set a factory on the enquiry before converting to an order");

  // Race-safe claim: only the caller that flips convertedPoId from null wins. We can't
  // know the real PO id until after createPurchaseOrder, so we stake the claim with a
  // sentinel ("PENDING:<enquiryId>") and reconcile it to po.id once the PO exists. A
  // concurrent double-convert sees count===0 here and bails out without creating a PO.
  const claimToken = `PENDING:${enq.id}`;
  const claim = await prisma.enquiry.updateMany({
    where: { id, companyId: cid, convertedPoId: null },
    data: { status: "WON", convertedPoId: claimToken },
  });
  if (claim.count !== 1) throw new Error("This enquiry has already been converted to an order");

  let po;
  try {
    po = await createPurchaseOrderWithUniquePo(actor, enq);
  } catch (e) {
    // PO creation failed — release the claim so the enquiry isn't stranded as a
    // WON enquiry pointing at a PO that never came into existence.
    await prisma.enquiry.updateMany({
      where: { id, companyId: cid, convertedPoId: claimToken },
      data: { status: enq.status, convertedPoId: null },
    });
    throw e;
  }

  // Reconcile the sentinel to the real PO id (scoped to our own claim token).
  await prisma.enquiry.updateMany({
    where: { id, companyId: cid, convertedPoId: claimToken },
    data: { convertedPoId: po.id },
  });
  await recordAudit({ userId: actor.id, entityType: "Enquiry", entityId: id, action: "edit", after: { converted: po.id } });
  return po;
}

/**
 * Create the PO for a conversion, deriving its poNumber from the full enquiry id for
 * entropy and retrying with a random salt if the [buyer,factory,channel,poNumber]
 * unique key still collides. createPurchaseOrder surfaces a unique-key collision as a
 * plain Error (P2002 caught internally), so we also catch the raw P2002 defensively.
 */
async function createPurchaseOrderWithUniquePo(
  actor: SessionUser,
  enq: { id: string; buyerId: string; brandId: string; factoryId: string | null; requiredShipDate: Date | null; styleRef: string },
) {
  const attempt = (poNumber: string) =>
    createPurchaseOrder(actor, {
      poNumber,
      buyerId: enq.buyerId,
      brandId: enq.brandId,
      factoryId: enq.factoryId!,
      exFactoryDate: enq.requiredShipDate ?? undefined,
      notes: `Converted from enquiry ${enq.styleRef}`,
    });

  for (let i = 0; i < 5; i++) {
    const poNumber = i === 0 ? enquiryPoNumber(enq.id) : enquiryPoNumber(enq.id, Math.random().toString(36).slice(2, 8));
    try {
      return await attempt(poNumber);
    } catch (e) {
      const isP2002 = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      const isCollisionMessage = e instanceof Error && /already exists/i.test(e.message);
      if (isP2002 || isCollisionMessage) continue; // disambiguate and retry
      throw e;
    }
  }
  throw new Error("Could not allocate a unique PO number for this conversion");
}

export type PipelineKpis = { openCount: number; openValueUsd: number; wonRate: number | null };

export async function enquiryPipelineKpis(actor: SessionUser): Promise<PipelineKpis> {
  assertPermission(actor, "orders", "view");
  const all = await prisma.enquiry.findMany({ where: { companyId: tenantId(actor) } });
  const open = all.filter((e) => ["NEW", "QUOTING", "QUOTED"].includes(e.status));
  const openValueUsd = open.reduce((a, e) => {
    const price = e.quotedPriceUsd ?? e.targetPriceUsd;
    return a + (price && e.targetQty ? Number(price) * e.targetQty : 0);
  }, 0);
  const won = all.filter((e) => e.status === "WON").length;
  const lost = all.filter((e) => e.status === "LOST").length;
  const decided = won + lost;
  return {
    openCount: open.length,
    openValueUsd: Math.round(openValueUsd * 100) / 100,
    wonRate: decided > 0 ? Math.round((won / decided) * 10000) / 100 : null,
  };
}
