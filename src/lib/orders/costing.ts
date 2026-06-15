import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function approveCosting(actor: SessionUser, poId: string) {
  assertPermission(actor, "costing", "approve");
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  if (po.status !== "DRAFT") {
    throw new Error("Costing can only be approved while the order is DRAFT");
  }
  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { costingApprovedById: actor.id, costingApprovedAt: new Date() },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "PurchaseOrder",
    entityId: poId,
    action: "approve",
    after: { costingApproved: true },
  });
  return updated;
}

export async function unapproveCosting(actor: SessionUser, poId: string) {
  assertPermission(actor, "costing", "approve");
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  if (po.status !== "DRAFT") {
    throw new Error("Costing approval can only be revoked while the order is DRAFT");
  }
  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { costingApprovedById: null, costingApprovedAt: null },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "PurchaseOrder",
    entityId: poId,
    action: "edit",
    before: { costingApprovedById: po.costingApprovedById },
    after: { costingApproved: false },
  });
  return updated;
}
