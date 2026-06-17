import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

/**
 * Hard-delete master data, but only when it isn't referenced by any order/brand/style —
 * otherwise we'd orphan rows. Callers should suggest "deactivate" instead when blocked.
 */

export async function deleteFactory(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "delete");
  const companyId = tenantId(actor);
  const orders = await prisma.purchaseOrder.count({ where: { factoryId: id, companyId } });
  if (orders > 0) throw new Error(`In use by ${orders} order(s) — deactivate instead of deleting.`);
  await prisma.factory.deleteMany({ where: { id, companyId } });
  await recordAudit({ userId: actor.id, entityType: "Factory", entityId: id, action: "delete" });
}

export async function deleteBuyer(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "delete");
  const companyId = tenantId(actor);
  const [orders, brands] = await Promise.all([
    prisma.purchaseOrder.count({ where: { buyerId: id, companyId } }),
    prisma.brand.count({ where: { buyerId: id, companyId } }),
  ]);
  if (orders > 0 || brands > 0) throw new Error(`In use by ${orders} order(s) / ${brands} brand(s) — deactivate instead.`);
  await prisma.buyer.deleteMany({ where: { id, companyId } });
  await recordAudit({ userId: actor.id, entityType: "Buyer", entityId: id, action: "delete" });
}

export async function deleteBrand(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "delete");
  const companyId = tenantId(actor);
  const [orders, styles] = await Promise.all([
    prisma.purchaseOrder.count({ where: { brandId: id, companyId } }),
    prisma.style.count({ where: { brandId: id, companyId } }),
  ]);
  if (orders > 0 || styles > 0) throw new Error(`In use by ${orders} order(s) / ${styles} style(s) — deactivate instead.`);
  await prisma.brand.deleteMany({ where: { id, companyId } });
  await recordAudit({ userId: actor.id, entityType: "Brand", entityId: id, action: "delete" });
}

export async function deleteStyle(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "delete");
  const companyId = tenantId(actor);
  const lines = await prisma.orderLine.count({ where: { styleId: id, companyId } });
  if (lines > 0) throw new Error(`In use by ${lines} order line(s) — deactivate instead.`);
  await prisma.style.deleteMany({ where: { id, companyId } });
  await recordAudit({ userId: actor.id, entityType: "Style", entityId: id, action: "delete" });
}

export async function deleteColour(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "delete");
  const companyId = tenantId(actor);
  const lines = await prisma.orderLine.count({ where: { colourId: id, companyId } });
  if (lines > 0) throw new Error(`In use by ${lines} order line(s) — deactivate instead.`);
  await prisma.colour.deleteMany({ where: { id, companyId } });
  await recordAudit({ userId: actor.id, entityType: "Colour", entityId: id, action: "delete" });
}
