import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { instantiateMilestones } from "@/lib/tna/milestones";

// Confirm requires costing approval (spec §9③, see costing.ts) in addition to a fully
// and sanely costed order.

export async function confirmPurchaseOrder(actor: SessionUser, poId: string) {
  assertPermission(actor, "orders", "edit");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
    include: { lines: { include: { sizes: true } } },
  });
  if (!po) {
    throw new Error("Purchase order not found");
  }

  if (po.status !== "DRAFT") {
    throw new Error(`Only DRAFT orders can be confirmed (current: ${po.status})`);
  }
  if (po.lines.length === 0) {
    throw new Error("Cannot confirm a PO with no lines");
  }
  for (const line of po.lines) {
    if (line.sizes.length === 0) {
      throw new Error("Every line must have at least one size row");
    }
    for (const s of line.sizes) {
      const net = Number(s.netFob.toString());
      const sell = Number(s.sellFob.toString());
      if (s.qty <= 0) {
        throw new Error(`Size ${s.label} must have qty greater than zero`);
      }
      if (sell <= 0) {
        throw new Error(`Size ${s.label} must have a sell price greater than zero`);
      }
      if (net <= 0) {
        throw new Error(`Size ${s.label} must have a cost (net FOB) greater than zero`);
      }
      if (sell < net) {
        throw new Error(`Size ${s.label}: sell price (${sell}) is below cost (${net})`);
      }
    }
  }

  // Costing-approval gate (spec §9③): checked after cost/qty validation so those
  // messages surface first; the updateMany below re-asserts it for race-safety.
  if (!po.costingApprovedAt) {
    throw new Error("Costing must be approved before the order can be confirmed");
  }

  // Atomic: flip status, audit, and create T&A milestones together (spec §9②) so a PO
  // can never end up CONFIRMED without its critical path. The status filter on the
  // updateMany is the single race-safe serialization point.
  await prisma.$transaction(async (tx) => {
    const res = await tx.purchaseOrder.updateMany({
      where: { id: poId, companyId: tenantId(actor), status: "DRAFT", costingApprovedAt: { not: null } },
      data: { status: "CONFIRMED" },
    });
    if (res.count === 0) {
      throw new Error("PO is no longer in DRAFT status or costing is not approved");
    }
    await recordAudit(
      {
        userId: actor.id,
        entityType: "PurchaseOrder",
        entityId: poId,
        action: "edit",
        before: { status: "DRAFT" },
        after: { status: "CONFIRMED" },
      },
      tx,
    );
    await instantiateMilestones(poId, tx);
  }, { timeout: 15000, maxWait: 10000 }); // instantiating the full critical path can exceed the 5s default under load

  const confirmed = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
  });
  if (!confirmed) {
    throw new Error("Purchase order not found");
  }
  return confirmed;
}
