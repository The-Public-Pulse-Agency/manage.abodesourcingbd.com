import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const CLOSEABLE = ["SHIPPED", "PARTLY_SHIPPED"] as const;

export async function closePurchaseOrder(actor: SessionUser, poId: string) {
  assertPermission(actor, "orders", "edit");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
  });
  if (!po) {
    throw new Error("Purchase order not found");
  }
  if (!CLOSEABLE.includes(po.status as (typeof CLOSEABLE)[number])) {
    throw new Error(`Only SHIPPED or PARTLY_SHIPPED orders can be closed (current: ${po.status})`);
  }
  // Re-assert the closeable status in the updateMany where-clause: the read above and
  // this write aren't atomic, so a concurrent transition (e.g. another close) could land
  // in between. The status filter is the race-safe serialization point — count===0 means
  // it slipped out of a closeable state. Mirrors confirm.ts.
  const res = await prisma.purchaseOrder.updateMany({
    where: { id: poId, companyId: tenantId(actor), status: { in: [...CLOSEABLE] } },
    data: { status: "CLOSED" },
  });
  if (res.count === 0) {
    throw new Error("Order is no longer closeable");
  }
  const updated = await prisma.purchaseOrder.findFirstOrThrow({
    where: { id: poId, companyId: tenantId(actor) },
  });
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
