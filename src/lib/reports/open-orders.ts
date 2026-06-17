import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { businessToday } from "@/lib/tna/schedule";
import { lineMills, rollup, type Decimalish } from "@/lib/orders/money";

// ON_HOLD is an active (non-finished, non-cancelled) status — held orders stay
// visible in the canonical open-order book/pipeline.
const OPEN_STATUSES = ["DRAFT", "CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED", "ON_HOLD"] as const;

export type StatusCell = { state: "done" | "overdue" | "pending" | "na"; date: Date | null };

export type OpenOrderRow = {
  id: string;
  poNumber: string;
  status: string;
  poReceiveDate: Date | null;
  factory: string;
  buyer: string;
  sizes: string;
  colours: string;
  confirmedShipDate: Date | null;
  crd: Date | null;
  qty: number;
  pricePerUnit: number;
  totalValue: number;
  currency: string;
  styles: string;
  labDip: StatusCell;
  knitting: StatusCell;
  firstSample: StatusCell;
  secondSample: StatusCell;
  finalSampleDate: Date | null;
  trims: StatusCell;
  yarn: StatusCell;
  dyeing: StatusCell;
  bulkShade: StatusCell;
  ppSample: StatusCell;
  cutting: StatusCell;
  bulkSewing: StatusCell;
  printEmb: StatusCell;
  topSample: StatusCell;
  finalInspectionDate: Date | null;
  remarks: string;
};

export type OpenOrdersFilter = { status?: string; factoryId?: string; buyerId?: string; q?: string };

const KEY = {
  trims: "TRIMS_BOOKED",
  yarn: "FABRIC_BOOKED",
  dyeing: "FABRIC_IN",
  bulkShade: "LAB_DIP",
  ppSample: "PP_SAMPLE",
  cutting: "CUTTING",
  bulkSewing: "SEWING",
  printEmb: "PRINT_EMB",
  topSample: "TOP_SAMPLE",
  labDip: "LAB_DIP",
  knitting: "KNITTING",
  firstSample: "FIRST_SAMPLE",
  secondSample: "SECOND_SAMPLE",
} as const;

function whereFor(actor: SessionUser, f: OpenOrdersFilter): Prisma.PurchaseOrderWhereInput {
  const status =
    f.status && (OPEN_STATUSES as readonly string[]).includes(f.status)
      ? { equals: f.status as (typeof OPEN_STATUSES)[number] }
      : { in: [...OPEN_STATUSES] };
  const q = f.q?.trim();
  const ci = (s: string) => ({ contains: s, mode: "insensitive" as const });
  return {
    companyId: tenantId(actor),
    status,
    ...(f.factoryId ? { factoryId: f.factoryId } : {}),
    ...(f.buyerId ? { buyerId: f.buyerId } : {}),
    ...(q
      ? {
          OR: [
            { poNumber: ci(q) },
            { factory: { name: ci(q) } },
            { buyer: { name: ci(q) } },
            { lines: { some: { style: { OR: [{ styleCode: ci(q) }, { name: ci(q) }] } } } },
            { lines: { some: { colour: { name: ci(q) } } } },
          ],
        }
      : {}),
  };
}

type PoForRow = Prisma.PurchaseOrderGetPayload<{
  include: { buyer: true; factory: true; lines: { include: { sizes: true; colour: true; style: true } }; milestones: { select: { key: true; plannedDate: true; actualDate: true } } };
}>;

function mapRow(po: PoForRow, today: Date): OpenOrderRow {
  // Case-tolerant: default template keys are UPPER_CASE; user-added ones are lower_case.
  const byKey = new Map(po.milestones.map((m) => [m.key.toUpperCase(), m]));
  const cell = (k: string): StatusCell => {
    const m = byKey.get(k.toUpperCase());
    if (!m) return { state: "na", date: null };
    if (m.actualDate) return { state: "done", date: m.actualDate };
    if (m.plannedDate && m.plannedDate < today) return { state: "overdue", date: m.plannedDate };
    return { state: "pending", date: m.plannedDate };
  };
  const sizes = [...new Set(po.lines.flatMap((l) => l.sizes.map((s) => s.label)))].join(", ");
  const colours = [...new Set(po.lines.map((l) => l.colour?.name).filter(Boolean) as string[])].join(", ");
  const styles = [...new Set(po.lines.map((l) => l.style?.styleCode).filter(Boolean) as string[])].join(", ");
  const totals = rollup(po.lines.map((l) => lineMills(l.sizes as { qty: number; netFob: Decimalish; sellFob: Decimalish }[])));
  return {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    poReceiveDate: po.orderDate,
    factory: po.factory.name,
    buyer: po.buyer.name,
    sizes: sizes || "—",
    colours: colours || "—",
    confirmedShipDate: po.exFactoryDate,
    crd: po.crd,
    qty: totals.qty,
    pricePerUnit: totals.qty > 0 ? Math.round((totals.value / totals.qty) * 10000) / 10000 : 0,
    totalValue: totals.value,
    currency: po.currency,
    styles: styles || "—",
    labDip: cell(KEY.labDip),
    knitting: cell(KEY.knitting),
    firstSample: cell(KEY.firstSample),
    secondSample: cell(KEY.secondSample),
    finalSampleDate: byKey.get("FINAL_SAMPLE")?.actualDate ?? null,
    trims: cell(KEY.trims),
    yarn: cell(KEY.yarn),
    dyeing: cell(KEY.dyeing),
    bulkShade: cell(KEY.bulkShade),
    ppSample: cell(KEY.ppSample),
    cutting: cell(KEY.cutting),
    bulkSewing: cell(KEY.bulkSewing),
    printEmb: cell(KEY.printEmb),
    topSample: cell(KEY.topSample),
    finalInspectionDate: byKey.get("FINAL_AQL")?.actualDate ?? null,
    remarks: po.notes ?? "",
  };
}

/** Server-side filtered + paginated rows (bounds the heavy include query at scale). */
export async function listOpenOrders(
  actor: SessionUser,
  filter: OpenOrdersFilter,
  opts: { page?: number; pageSize?: number; now?: Date } = {},
) {
  assertPermission(actor, "orders", "view");
  const today = businessToday(opts.now ?? new Date());
  const where = whereFor(actor, filter);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const total = await prisma.purchaseOrder.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const pos = await prisma.purchaseOrder.findMany({
    where,
    include: { buyer: true, factory: true, lines: { include: { sizes: true, colour: true, style: true } }, milestones: { select: { key: true, plannedDate: true, actualDate: true } } },
    orderBy: [{ exFactoryDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { rows: pos.map((po) => mapRow(po, today)), total, page, pageSize, totalPages };
}

export type OpenOrdersSummary = {
  count: number;
  totalQty: number;
  totalValue: number;
  shipping30: number;
  byFactory: { label: string; value: number }[];
  byBuyer: { label: string; value: number }[];
};

/** KPI + chart aggregates over the filtered set (light projection — no milestone graph). */
export async function openOrdersSummary(actor: SessionUser, filter: OpenOrdersFilter): Promise<OpenOrdersSummary> {
  assertPermission(actor, "orders", "view");
  // KPI value/qty are USD-scoped (single-currency contract — see lib/orders/money.ts):
  // the money lib forbids mixing currencies in one rollup and order-line FOB carries no
  // currency tag, so only USD POs contribute to totalQty/totalValue.
  const where: Prisma.PurchaseOrderWhereInput = { ...whereFor(actor, filter), currency: "USD" };

  // count() is the true matching-PO count (no in-app cap), so it never diverges from the
  // value/qty rollup at scale; totals come from a flat size aggregate over the same
  // where-clause (mirrors openOrderBookTotals in lib/orders/po.ts — accurate under any size).
  const [count, sizes, pos] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.orderLineSize.findMany({
      where: { companyId: tenantId(actor), orderLine: { po: where } },
      select: { qty: true, netFob: true, sellFob: true },
    }),
    prisma.purchaseOrder.findMany({
      where,
      select: { exFactoryDate: true, factory: { select: { name: true } }, buyer: { select: { name: true } }, lines: { select: { sizes: { select: { qty: true } } } } },
    }),
  ]);

  const totals = rollup([lineMills(sizes as { qty: number; netFob: Decimalish; sellFob: Decimalish }[])]);

  // Chart aggregates (qty-by-factory, count-by-buyer, shipping≤30d) need per-PO grouping
  // that a single aggregate can't express, so derive them from a light per-PO projection.
  const now = Date.now();
  let shipping30 = 0;
  const fac = new Map<string, number>(), buy = new Map<string, number>();
  for (const po of pos) {
    const qty = po.lines.reduce((a, l) => a + l.sizes.reduce((b, z) => b + z.qty, 0), 0);
    fac.set(po.factory.name, (fac.get(po.factory.name) ?? 0) + qty);
    buy.set(po.buyer.name, (buy.get(po.buyer.name) ?? 0) + 1);
    if (po.exFactoryDate && +po.exFactoryDate >= now && +po.exFactoryDate <= now + 30 * 86_400_000) shipping30++;
  }
  const top = (m: Map<string, number>) => [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 7);
  return { count, totalQty: totals.qty, totalValue: totals.value, shipping30, byFactory: top(fac), byBuyer: top(buy) };
}

/** All filtered rows for CSV export (bounded). */
export async function openOrdersForExport(actor: SessionUser, filter: OpenOrdersFilter): Promise<OpenOrderRow[]> {
  assertPermission(actor, "orders", "view");
  const today = businessToday(new Date());
  const pos = await prisma.purchaseOrder.findMany({
    where: whereFor(actor, filter),
    include: { buyer: true, factory: true, lines: { include: { sizes: true, colour: true, style: true } }, milestones: { select: { key: true, plannedDate: true, actualDate: true } } },
    orderBy: [{ exFactoryDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 5_000,
  });
  return pos.map((po) => mapRow(po, today));
}
