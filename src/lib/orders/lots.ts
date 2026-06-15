import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createLotSchema = z.object({
  name: z.string().min(1),
  factoryId: z.string().optional(),
});
export type CreateLotInput = z.infer<typeof createLotSchema>;

export async function createLot(actor: SessionUser, input: CreateLotInput) {
  assertPermission(actor, "orders", "create");
  const data = createLotSchema.parse(input);
  const lot = await prisma.lot.create({ data: { name: data.name, factoryId: data.factoryId } });
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
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });

  if (lotId) {
    const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
    if (lot.factoryId && lot.factoryId !== po.factoryId) {
      throw new Error("Lot belongs to a different factory than this PO");
    }
  }

  const updated = await prisma.purchaseOrder.update({ where: { id: poId }, data: { lotId } });
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
