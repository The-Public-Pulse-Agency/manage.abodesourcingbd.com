import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { lineMills, rollup, marginPct } from "./money";
import { getSubscription } from "@/lib/billing/subscription";

export async function approveCosting(actor: SessionUser, poId: string) {
  assertPermission(actor, "costing", "approve");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
  });
  if (!po) {
    throw new Error("Purchase order not found");
  }
  if (po.status !== "DRAFT") {
    throw new Error("Costing can only be approved while the order is DRAFT");
  }
  // Margin-floor gate: block approval when the order's margin is below the org floor.
  const sub = await getSubscription();
  if (sub.minMarginPct > 0) {
    const lines = await prisma.orderLine.findMany({
      where: { poId, companyId: tenantId(actor) },
      include: { sizes: true },
    });
    const pct = marginPct(rollup(lines.map((l) => lineMills(l.sizes))));
    if (pct !== null && pct < sub.minMarginPct) {
      throw new Error(`Margin ${pct}% is below the ${sub.minMarginPct}% floor — cannot approve costing`);
    }
  }
  await prisma.purchaseOrder.updateMany({
    where: { id: poId, companyId: tenantId(actor) },
    data: { costingApprovedById: actor.id, costingApprovedAt: new Date() },
  });
  const updated = await prisma.purchaseOrder.findFirstOrThrow({
    where: { id: poId, companyId: tenantId(actor) },
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
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
  });
  if (!po) {
    throw new Error("Purchase order not found");
  }
  if (po.status !== "DRAFT") {
    throw new Error("Costing approval can only be revoked while the order is DRAFT");
  }
  await prisma.purchaseOrder.updateMany({
    where: { id: poId, companyId: tenantId(actor) },
    data: { costingApprovedById: null, costingApprovedAt: null },
  });
  const updated = await prisma.purchaseOrder.findFirstOrThrow({
    where: { id: poId, companyId: tenantId(actor) },
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
