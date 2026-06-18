import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { rebaseMilestones } from "@/lib/tna/milestones";
import { createPoSchema, type CreatePoInput, type OpenOrderBookFilter } from "./schema";
import { lineMills, rollup, type Decimalish, type Totals } from "./money";

const CLOSED_STATUSES = ["CLOSED", "CANCELLED"] as const;

type SizeShape = { qty: number; netFob: Decimalish; sellFob: Decimalish };

function totalsForLines(lines: { sizes: SizeShape[] }[]): Totals {
  return rollup(lines.map((l) => lineMills(l.sizes)));
}

export async function createPurchaseOrder(actor: SessionUser, input: CreatePoInput) {
  assertPermission(actor, "orders", "create");
  const data = createPoSchema.parse(input);
  const poNumber = data.poNumber.trim();
  // Cross-entity integrity: the brand must belong to the named buyer.
  const brand = await prisma.brand.findFirst({
    where: { id: data.brandId, companyId: tenantId(actor) },
  });
  if (!brand || brand.buyerId !== data.buyerId) {
    throw new Error("Brand does not belong to the specified buyer");
  }
  // Tenant integrity: the factory must belong to the actor's company (prevents a
  // cross-tenant factoryId from being booked onto this company's order).
  const factory = await prisma.factory.findFirst({
    where: { id: data.factoryId, companyId: tenantId(actor) },
    select: { id: true },
  });
  if (!factory) throw new Error("Factory not found");
  try {
    const po = await prisma.purchaseOrder.create({
      data: {
        companyId: tenantId(actor),
        poNumber,
        buyerId: data.buyerId,
        brandId: data.brandId,
        factoryId: data.factoryId,
        channel: data.channel,
        orderDate: data.orderDate,
        crd: data.crd,
        exFactoryDate: data.exFactoryDate,
        currency: data.currency,
        notes: data.notes,
      },
    });
    await recordAudit({
      userId: actor.id,
      entityType: "PurchaseOrder",
      entityId: po.id,
      action: "create",
      after: { poNumber: po.poNumber, channel: po.channel, status: po.status },
    });
    return po;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(
        `PO ${poNumber} already exists for this buyer/factory/channel (${data.channel})`,
      );
    }
    throw e;
  }
}

export async function getPurchaseOrder(actor: SessionUser, id: string) {
  assertPermission(actor, "orders", "view");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, companyId: tenantId(actor) },
    include: {
      buyer: true,
      brand: true,
      factory: true,
      lot: true,
      lines: {
        include: { style: true, colour: true, sizes: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!po) return null;
  return { ...po, totals: totalsForLines(po.lines) };
}

export async function listOpenOrderBook(actor: SessionUser, filter: OpenOrderBookFilter) {
  assertPermission(actor, "orders", "view");
  const pos = await prisma.purchaseOrder.findMany({
    where: bookWhere(actor, filter),
    include: {
      buyer: true,
      brand: true,
      factory: true,
      lines: { include: { sizes: true } },
    },
    orderBy: [{ exFactoryDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  return pos.map((po) => ({ ...po, totals: totalsForLines(po.lines) }));
}

/** Shared WHERE for the Open Order Book (non-closed POs + optional filters). */
function bookWhere(actor: SessionUser, filter: OpenOrderBookFilter) {
  return {
    companyId: tenantId(actor),
    status: { notIn: [...CLOSED_STATUSES] },
    ...(filter.factoryId ? { factoryId: filter.factoryId } : {}),
    ...(filter.buyerId ? { buyerId: filter.buyerId } : {}),
    ...(filter.channel ? { channel: filter.channel } : {}),
    ...(filter.exFactoryBefore ? { exFactoryDate: { lte: filter.exFactoryBefore } } : {}),
  };
}

/** Server-side paginated Open Order Book — bounds rows loaded per request at scale. */
export async function listOpenOrderBookPaged(
  actor: SessionUser,
  filter: OpenOrderBookFilter,
  opts: { page?: number; pageSize?: number } = {},
) {
  assertPermission(actor, "orders", "view");
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const where = bookWhere(actor, filter);
  const total = await prisma.purchaseOrder.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const pos = await prisma.purchaseOrder.findMany({
    where,
    include: { buyer: true, brand: true, factory: true, lines: { include: { sizes: true } } },
    orderBy: [{ exFactoryDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { rows: pos.map((po) => ({ ...po, totals: totalsForLines(po.lines) })), total, page, pageSize, totalPages };
}

/**
 * Grand totals across ALL filtered orders (not just the visible page) — a flat size
 * query (no nested includes) summed once via the mills lib, so the footer stays
 * accurate under pagination without loading every order's full object graph.
 */
export async function openOrderBookTotals(actor: SessionUser, filter: OpenOrderBookFilter): Promise<Totals> {
  assertPermission(actor, "orders", "view");
  const sizes = await prisma.orderLineSize.findMany({
    where: { companyId: tenantId(actor), orderLine: { po: bookWhere(actor, filter) } },
    select: { qty: true, netFob: true, sellFob: true },
  });
  return rollup([lineMills(sizes)]);
}

/**
 * Delete a purchase order and its dependent records (lines, sizes, milestones, cost
 * items, materials, samples, QC — all cascade; invoices removed too). Blocked when the
 * order has shipments, to protect shipped data — delete those shipments first.
 */
export async function deletePurchaseOrder(actor: SessionUser, poId: string): Promise<void> {
  assertPermission(actor, "orders", "delete");
  const cid = tenantId(actor);
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: cid },
    select: { poNumber: true, lines: { select: { shipmentLines: { select: { id: true }, take: 1 } } } },
  });
  if (!po) throw new Error("Order not found");
  if (po.lines.some((l) => l.shipmentLines.length > 0)) {
    throw new Error("This order has shipments — delete the shipment(s) first, then delete the order.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.invoice.deleteMany({ where: { poId, companyId: cid } }); // payments cascade
    await tx.purchaseOrder.deleteMany({ where: { id: poId, companyId: cid } }); // lines/sizes/milestones/etc. cascade
  });
  await recordAudit({ userId: actor.id, entityType: "PurchaseOrder", entityId: poId, action: "delete", before: { poNumber: po.poNumber } });
}

/** Inline quick-edit of a PO's schedule dates (PO receive + confirmed ship). */
export async function updateOrderSchedule(
  actor: SessionUser,
  poId: string,
  input: { orderDate?: Date | null; exFactoryDate?: Date | null; crd?: Date | null; notes?: string },
) {
  assertPermission(actor, "orders", "edit");
  const cid = tenantId(actor);
  const existing = await prisma.purchaseOrder.findFirst({ where: { id: poId, companyId: cid }, select: { id: true } });
  if (!existing) throw new Error("Order not found");
  const data: { orderDate?: Date | null; exFactoryDate?: Date | null; crd?: Date | null; notes?: string | null } = {};
  if (input.orderDate !== undefined) data.orderDate = input.orderDate;
  if (input.exFactoryDate !== undefined) data.exFactoryDate = input.exFactoryDate;
  if (input.crd !== undefined) data.crd = input.crd;
  if (input.notes !== undefined) data.notes = input.notes || null;
  await prisma.purchaseOrder.update({ where: { id: poId }, data });
  await recordAudit({ userId: actor.id, entityType: "PurchaseOrder", entityId: poId, action: "edit", after: data });
  // A ship-date change must re-base the critical path so un-actualed milestone planned
  // dates move with it. rebaseMilestones asserts criticalPath:edit, so only call it when
  // the actor holds that permission — a schedule save shouldn't fail on a missing rebase right.
  if (input.exFactoryDate !== undefined && can(actor, "criticalPath", "edit")) {
    await rebaseMilestones(actor, poId);
  }
}
