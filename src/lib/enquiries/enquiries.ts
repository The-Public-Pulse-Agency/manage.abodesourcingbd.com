import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { createPurchaseOrder } from "@/lib/orders/po";

const STATUSES = ["NEW", "QUOTING", "QUOTED", "WON", "LOST", "DROPPED"] as const;

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

async function assertBrandInBuyer(buyerId: string, brandId: string) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand || brand.buyerId !== buyerId) throw new Error("Brand does not belong to the specified buyer");
}

export async function createEnquiry(actor: SessionUser, input: CreateEnquiryInput) {
  assertPermission(actor, "orders", "create");
  const data = createEnquirySchema.parse(input);
  await assertBrandInBuyer(data.buyerId, data.brandId);
  const enq = await prisma.enquiry.create({
    data: {
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
    where: filter.status ? { status: filter.status as (typeof STATUSES)[number] } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function getEnquiry(actor: SessionUser, id: string) {
  assertPermission(actor, "orders", "view");
  return prisma.enquiry.findUnique({ where: { id } });
}

export const updateEnquirySchema = z.object({
  status: z.enum(STATUSES).optional(),
  quotedPriceUsd: z.coerce.number().nonnegative().optional(),
  targetQty: z.coerce.number().int().positive().optional(),
  lostReason: z.string().optional(),
  factoryId: z.string().optional(),
});

export async function updateEnquiry(actor: SessionUser, id: string, input: z.input<typeof updateEnquirySchema>) {
  assertPermission(actor, "orders", "edit");
  const data = updateEnquirySchema.parse(input);
  const patch: Record<string, string | number | null> = {};
  if (data.status) patch.status = data.status;
  if (data.quotedPriceUsd != null) patch.quotedPriceUsd = String(data.quotedPriceUsd);
  if (data.targetQty != null) patch.targetQty = data.targetQty;
  if (data.lostReason !== undefined) patch.lostReason = data.lostReason;
  if (data.factoryId !== undefined) patch.factoryId = data.factoryId || null;
  const enq = await prisma.enquiry.update({ where: { id }, data: patch });
  await recordAudit({ userId: actor.id, entityType: "Enquiry", entityId: id, action: "edit", after: patch });
  return enq;
}

/** Convert a won enquiry into a DRAFT purchase order, pre-filled from the enquiry. */
export async function convertToOrder(actor: SessionUser, id: string) {
  assertPermission(actor, "orders", "create");
  const enq = await prisma.enquiry.findUniqueOrThrow({ where: { id } });
  if (enq.convertedPoId) throw new Error("This enquiry has already been converted to an order");
  if (!enq.factoryId) throw new Error("Set a factory on the enquiry before converting to an order");
  const po = await createPurchaseOrder(actor, {
    poNumber: `Q-${enq.id.slice(-6).toUpperCase()}`,
    buyerId: enq.buyerId,
    brandId: enq.brandId,
    factoryId: enq.factoryId,
    exFactoryDate: enq.requiredShipDate ?? undefined,
    notes: `Converted from enquiry ${enq.styleRef}`,
  });
  await prisma.enquiry.update({ where: { id }, data: { status: "WON", convertedPoId: po.id } });
  await recordAudit({ userId: actor.id, entityType: "Enquiry", entityId: id, action: "edit", after: { converted: po.id } });
  return po;
}

export type PipelineKpis = { openCount: number; openValueUsd: number; wonRate: number | null };

export async function enquiryPipelineKpis(actor: SessionUser): Promise<PipelineKpis> {
  assertPermission(actor, "orders", "view");
  const all = await prisma.enquiry.findMany();
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
