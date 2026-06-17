import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createLotSchema = z.object({
  name: z.string().min(1),
  factoryId: z.string().optional(),
});
export type CreateLotInput = z.infer<typeof createLotSchema>;

export async function createLot(actor: SessionUser, input: CreateLotInput) {
  assertPermission(actor, "orders", "create");
  const data = createLotSchema.parse(input);
  const lot = await prisma.lot.create({
    data: { companyId: tenantId(actor), name: data.name, factoryId: data.factoryId },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "Lot",
    entityId: lot.id,
    action: "create",
    after: { name: lot.name, factoryId: lot.factoryId },
  });
  return lot;
}

export async function assignPoToLot(actor: SessionUser, poId: string, lotId: string | null) {
  assertPermission(actor, "orders", "edit");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
  });
  if (!po) {
    throw new Error("Purchase order not found");
  }

  if (lotId) {
    const lot = await prisma.lot.findFirst({
      where: { id: lotId, companyId: tenantId(actor) },
    });
    if (!lot) {
      throw new Error("Lot not found");
    }
    if (lot.factoryId == null) {
      // Fail-closed: a factoryless lot adopts the first assigned PO's factory,
      // so it becomes factory-scoped and cannot later mix factories.
      await prisma.lot.updateMany({
        where: { id: lotId, companyId: tenantId(actor) },
        data: { factoryId: po.factoryId },
      });
    } else if (lot.factoryId !== po.factoryId) {
      throw new Error("Lot belongs to a different factory than this PO");
    }
  }

  await prisma.purchaseOrder.updateMany({
    where: { id: poId, companyId: tenantId(actor) },
    data: { lotId },
  });
  const updated = await prisma.purchaseOrder.findFirstOrThrow({
    where: { id: poId, companyId: tenantId(actor) },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "PurchaseOrder",
    entityId: poId,
    action: "edit",
    before: { lotId: po.lotId },
    after: { lotId },
  });
  return updated;
}
