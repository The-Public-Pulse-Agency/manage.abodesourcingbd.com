import { prisma } from "@/lib/db";
import { assertPermission, ForbiddenError, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const RESET_PHRASE = "DELETE ALL";

/**
 * Danger zone: delete ALL of the company's orders + shipments (and their invoices /
 * lines / milestones — everything cascades). Master data (buyers, factories, styles,
 * colours, templates) is kept. Admin-only + requires the exact confirm phrase.
 * Use to wipe mistaken/imported data before a clean re-import.
 */
export async function clearOrdersAndShipments(
  actor: SessionUser,
  opts: { confirm: string },
): Promise<{ orders: number; shipments: number }> {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Only an admin can clear data");
  assertPermission(actor, "orders", "delete");
  if (opts.confirm !== RESET_PHRASE) throw new Error(`Type "${RESET_PHRASE}" exactly to confirm`);
  const companyId = tenantId(actor);

  const [orders, shipments] = await Promise.all([
    prisma.purchaseOrder.count({ where: { companyId } }),
    prisma.shipment.count({ where: { companyId } }),
  ]);

  // Order matters: invoices (payments cascade) → shipments (lines/sizes cascade) →
  // POs (order lines/sizes/milestones/cost/materials/samples/QC cascade).
  await prisma.$transaction([
    prisma.invoice.deleteMany({ where: { companyId } }),
    prisma.shipment.deleteMany({ where: { companyId } }),
    prisma.purchaseOrder.deleteMany({ where: { companyId } }),
  ]);

  await recordAudit({ userId: actor.id, entityType: "Company", entityId: companyId, action: "delete", before: { orders, shipments } });
  return { orders, shipments };
}
