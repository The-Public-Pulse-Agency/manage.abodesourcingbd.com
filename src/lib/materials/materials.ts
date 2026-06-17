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

export async function receiveMaterial(
  actor: SessionUser,
  id: string,
  input: { receivedQty: number; receivedDate?: Date },
) {
  assertPermission(actor, "productionQc", "edit");
  const m = await prisma.materialBooking.findFirst({ where: { id, companyId: tenantId(actor) } });
  if (!m) throw new Error("Material booking not found");
  const receivedDate = input.receivedDate ?? new Date();
  const booked = m.bookedQty != null ? Number(m.bookedQty) : null;
  const fullyIn = booked != null ? input.receivedQty >= booked : input.receivedQty > 0;
  const status = fullyIn ? "IN_HOUSE" : "PARTIAL";
  await prisma.materialBooking.updateMany({
    where: { id, companyId: tenantId(actor) },
    data: { receivedQty: String(input.receivedQty), receivedDate, status },
  });
  const updated = await prisma.materialBooking.findFirst({ where: { id, companyId: tenantId(actor) } });
  // Fabric fully in-house stamps the "bulk fabric in-house" milestone.
  if (status === "IN_HOUSE") await stampMilestone(actor, m.poId, IN_HOUSE_KEY[m.kind], receivedDate);
  await recordAudit({ userId: actor.id, entityType: "MaterialBooking", entityId: id, action: "edit", after: { receivedQty: input.receivedQty, status } });
  return updated;
}

export async function removeMaterial(actor: SessionUser, id: string) {
  assertPermission(actor, "productionQc", "edit");
  await prisma.materialBooking.deleteMany({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "MaterialBooking", entityId: id, action: "delete" });
}
