import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const CLOSEABLE = ["SHIPPED", "PARTLY_SHIPPED"] as const;

export async function closePurchaseOrder(actor: SessionUser, poId: string) {
  assertPermission(actor, "orders", "edit");
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  if (!CLOSEABLE.includes(po.status as (typeof CLOSEABLE)[number])) {
    throw new Error(`Only SHIPPED or PARTLY_SHIPPED orders can be closed (current: ${po.status})`);
  }
  const updated = await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: "CLOSED" } });
  await recordAudit({
    userId: actor.id,
    entityType: "PurchaseOrder",
    entityId: poId,
    action: "edit",
    before: { status: po.status },
    after: { status: "CLOSED" },
  });
  return updated;
}
