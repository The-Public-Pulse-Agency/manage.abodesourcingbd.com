import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const KINDS = ["FABRIC", "TRIM", "ACCESSORY"] as const;

// kind → the T&A milestone keys to auto-stamp when booked / received in-house.
const BOOKED_KEY: Record<string, string> = { FABRIC: "FABRIC_BOOKED", TRIM: "TRIMS_BOOKED", ACCESSORY: "TRIMS_BOOKED" };
const IN_HOUSE_KEY: Record<string, string | undefined> = { FABRIC: "FABRIC_IN" };

/** Stamp a milestone's actual date (only if it exists and isn't already done). */
async function stampMilestone(actor: SessionUser, poId: string, key: string | undefined, date: Date) {
  if (!key) return;
  await prisma.taMilestone.updateMany({ where: { poId, key, actualDate: null, companyId: tenantId(actor) }, data: { actualDate: date } });
}

/** Revert a material-driven milestone's actual date (used when the last booking that
 * stamped it is removed). */
async function unstampMilestone(actor: SessionUser, poId: string, key: string | undefined) {
  if (!key) return;
  await prisma.taMilestone.updateMany({ where: { poId, key, companyId: tenantId(actor) }, data: { actualDate: null } });
}

/** Kinds whose booking stamps the same "booked" milestone key (TRIM+ACCESSORY share TRIMS_BOOKED). */
function kindsSharingBookedKey(key: string): (typeof KINDS)[number][] {
  return KINDS.filter((k) => BOOKED_KEY[k] === key);
}

export async function listMaterials(actor: SessionUser, poId: string) {
  assertPermission(actor, "productionQc", "view");
  return prisma.materialBooking.findMany({ where: { poId, companyId: tenantId(actor) }, orderBy: { createdAt: "asc" } });
}

export const materialSchema = z.object({
  poId: z.string().min(1),
  kind: z.enum(KINDS),
  description: z.string().min(1),
  supplier: z.string().optional(),
  bookedQty: z.coerce.number().nonnegative().optional(),
  unit: z.string().optional(),
  bookingRef: z.string().optional(),
  etaDate: z.coerce.date().optional(),
});
export type MaterialInput = z.input<typeof materialSchema>;

export async function addMaterial(actor: SessionUser, input: MaterialInput) {
  assertPermission(actor, "productionQc", "create");
  const data = materialSchema.parse(input);
  // Tenant integrity: the parent PO must belong to the actor's company.
  const po = await prisma.purchaseOrder.findFirst({ where: { id: data.poId, companyId: tenantId(actor) }, select: { id: true } });
  if (!po) throw new Error("Order not found");
  const m = await prisma.materialBooking.create({
    data: {
      companyId: tenantId(actor),
      poId: data.poId,
      kind: data.kind,
      description: data.description.trim(),
      supplier: data.supplier,
      bookedQty: data.bookedQty != null ? String(data.bookedQty) : null,
      unit: data.unit,
      bookingRef: data.bookingRef,
      etaDate: data.etaDate,
    },
  });
  // Booking a material stamps the "booked" milestone on the critical path.
  await stampMilestone(actor, data.poId, BOOKED_KEY[data.kind], new Date());
  await recordAudit({ userId: actor.id, entityType: "MaterialBooking", entityId: m.id, action: "create", after: { kind: data.kind, description: data.description } });
  return m;
}

const receiveSchema = z.object({
  receivedQty: z.coerce.number().positive("Received quantity must be greater than zero").finite(),
  receivedDate: z.coerce.date().optional(),
});

export async function receiveMaterial(
  actor: SessionUser,
  id: string,
  input: { receivedQty: number; receivedDate?: Date },
) {
  assertPermission(actor, "productionQc", "edit");
  const parsed = receiveSchema.parse(input); // rejects zero / negative / non-numeric receipts
  const m = await prisma.materialBooking.findFirst({ where: { id, companyId: tenantId(actor) } });
  if (!m) throw new Error("Material booking not found");
  const receivedDate = parsed.receivedDate ?? new Date();
  // Accumulate partial receipts rather than overwriting the running total.
  const prevReceived = m.receivedQty != null ? Number(m.receivedQty) : 0;
  const newTotal = prevReceived + parsed.receivedQty;
  const booked = m.bookedQty != null ? Number(m.bookedQty) : null;
  // "Fully in-house" requires a positive booked target that has been met. With no
  // target (null/0), we can't assert completeness, so the booking stays PARTIAL.
  const fullyIn = booked != null && booked > 0 && newTotal >= booked;
  const status = fullyIn ? "IN_HOUSE" : "PARTIAL";
  await prisma.materialBooking.updateMany({
    where: { id, companyId: tenantId(actor) },
    data: { receivedQty: String(newTotal), receivedDate, status },
  });
  const updated = await prisma.materialBooking.findFirst({ where: { id, companyId: tenantId(actor) } });
  // Fabric fully in-house stamps the "bulk fabric in-house" milestone.
  if (status === "IN_HOUSE") await stampMilestone(actor, m.poId, IN_HOUSE_KEY[m.kind], receivedDate);
  await recordAudit({ userId: actor.id, entityType: "MaterialBooking", entityId: id, action: "edit", after: { receivedQty: newTotal, status } });
  return updated;
}

export const materialUpdateSchema = z.object({
  description: z.string().min(1).optional(),
  supplier: z.string().nullable().optional(),
  bookedQty: z.coerce.number().nonnegative().nullable().optional(),
  unit: z.string().nullable().optional(),
  bookingRef: z.string().nullable().optional(),
  etaDate: z.coerce.date().nullable().optional(),
});
export type MaterialUpdateInput = z.input<typeof materialUpdateSchema>;

/** Correct an existing booking's details (no milestone re-stamping). Tenant-scoped. */
export async function updateMaterial(actor: SessionUser, id: string, input: MaterialUpdateInput) {
  assertPermission(actor, "productionQc", "edit");
  const m = await prisma.materialBooking.findFirst({ where: { id, companyId: tenantId(actor) } });
  if (!m) throw new Error("Material booking not found");
  const data = materialUpdateSchema.parse(input);

  const patch: Record<string, unknown> = {};
  if (data.description !== undefined) patch.description = data.description.trim();
  if (data.supplier !== undefined) patch.supplier = data.supplier?.trim() || null;
  if (data.bookedQty !== undefined) patch.bookedQty = data.bookedQty != null ? String(data.bookedQty) : null;
  if (data.unit !== undefined) patch.unit = data.unit?.trim() || null;
  if (data.bookingRef !== undefined) patch.bookingRef = data.bookingRef?.trim() || null;
  if (data.etaDate !== undefined) patch.etaDate = data.etaDate ?? null;

  await prisma.materialBooking.updateMany({ where: { id, companyId: tenantId(actor) }, data: patch });
  const updated = await prisma.materialBooking.findFirst({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "MaterialBooking", entityId: id, action: "edit", after: JSON.parse(JSON.stringify(patch)) });
  return updated;
}

export async function removeMaterial(actor: SessionUser, id: string) {
  assertPermission(actor, "productionQc", "edit");
  const cid = tenantId(actor);
  const m = await prisma.materialBooking.findFirst({ where: { id, companyId: cid }, select: { id: true, poId: true, kind: true } });
  if (!m) return;
  await prisma.materialBooking.deleteMany({ where: { id, companyId: cid } });
  // Revert the milestone(s) this kind stamps if no other booking still backs them.
  const bookedKey = BOOKED_KEY[m.kind];
  if (bookedKey) {
    const stillBooked = await prisma.materialBooking.count({ where: { poId: m.poId, kind: { in: kindsSharingBookedKey(bookedKey) }, companyId: cid } });
    if (stillBooked === 0) await unstampMilestone(actor, m.poId, bookedKey);
  }
  const inKey = IN_HOUSE_KEY[m.kind];
  if (inKey) {
    const stillInHouse = await prisma.materialBooking.count({ where: { poId: m.poId, kind: m.kind, status: "IN_HOUSE", companyId: cid } });
    if (stillInHouse === 0) await unstampMilestone(actor, m.poId, inKey);
  }
  await recordAudit({ userId: actor.id, entityType: "MaterialBooking", entityId: id, action: "delete" });
}
