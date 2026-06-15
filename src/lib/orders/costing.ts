import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { lineMills, rollup, marginPct } from "./money";
import { getSubscription } from "@/lib/billing/subscription";

export async function approveCosting(actor: SessionUser, poId: string) {
  assertPermission(actor, "costing", "approve");
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  if (po.status !== "DRAFT") {
    throw new Error("Costing can only be approved while the order is DRAFT");
  }
  // Margin-floor gate: block approval when the order's margin is below the org floor.
  const sub = await getSubscription();
  if (sub.minMarginPct > 0) {
    const lines = await prisma.orderLine.findMany({ where: { poId }, include: { sizes: true } });
    const pct = marginPct(rollup(lines.map((l) => lineMills(l.sizes))));
    if (pct !== null && pct < sub.minMarginPct) {
      throw new Error(`Margin ${pct}% is below the ${sub.minMarginPct}% floor — cannot approve costing`);
    }
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
