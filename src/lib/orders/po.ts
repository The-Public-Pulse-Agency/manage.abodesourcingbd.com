import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
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
