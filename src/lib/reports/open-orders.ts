import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { businessToday } from "@/lib/tna/schedule";
import { lineMills, rollup, type Decimalish } from "@/lib/orders/money";
import { remainingBySize } from "@/lib/shipment/balance";

type SizeForBalance = { label: string; qty: number; netFob: Decimalish; sellFob: Decimalish };
type LineForBalance = { sizes: SizeForBalance[]; shipmentLines: { sizes: { label: string; qty: number }[] }[] };

/**
 * Open-book totals reflect the REMAINING balance (ordered − already shipped) per size, so
 * a partly-shipped PO shows only the qty/value still to ship — not the full original order.
 * Lines with no shipments fall through to their full ordered qty.
 */
function remainingTotals(lines: LineForBalance[]) {
  return rollup(
    lines.map((l) => {
      const shipped = l.shipmentLines.flatMap((sl) => sl.sizes.map((s) => ({ label: s.label, qty: s.qty })));
      const bal = remainingBySize(l.sizes.map((s) => ({ label: s.label, qty: s.qty })), shipped);
      const balByLabel = new Map(bal.map((b) => [b.label, Math.max(0, b.balance)]));
      const remainingSizes = l.sizes.map((s) => ({ ...s, qty: balByLabel.get(s.label) ?? s.qty }));
      return lineMills(remainingSizes);
    }),
  );
}

// ON_HOLD is an active (non-finished, non-cancelled) status — held orders stay
// visible in the canonical open-order book/pipeline.
const OPEN_STATUSES = ["DRAFT", "CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED", "ON_HOLD"] as const;
const SUMMARY_CAP = 20_000; // bound the per-PO balance projection at extreme scale

export type StatusCell = { state: "done" | "overdue" | "pending" | "na"; date: Date | null };

export type OpenOrderRow = {
  id: string;
  poNumber: string;
  status: string;
  poReceiveDate: Date | null;
  factory: string;
  buyer: string;
  brand: string;
  sizes: string;
  colours: string;
  confirmedShipDate: Date | null;
  crd: Date | null;
  qty: number;
  pricePerUnit: number;
  totalValue: number;
  currency: string;
  styles: string;
  // Per-style breakdown (remaining qty/value + that style's own follow-up RAG cells), so the
  // report can show one row per style with independent critical-path status.
  styleBreakdown: ({ style: string; sizes: string; colours: string; qty: number; value: number } & MilestoneCells)[];
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

export type OpenOrdersFilter = { status?: string; factoryIds?: string[]; buyerIds?: string[]; q?: string; shipYear?: string; shipMonth?: string };

/** [start, end) UTC range for a ship year (+ optional 1-12 month), or null when no period filter. */
export function shipDateRange(year?: string, month?: string): { gte: Date; lt: Date } | null {
  const y = Number(year);
  if (!year || !Number.isFinite(y)) return null;
  const mo = month ? Number(month) : 0;
  if (mo >= 1 && mo <= 12) return { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) };
  return { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
}

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
  const ship = shipDateRange(f.shipYear, f.shipMonth); // by confirmed ship / ex-factory date
  return {
    companyId: tenantId(actor),
    status,
    ...(ship ? { exFactoryDate: ship } : {}),
    ...(f.factoryIds?.length ? { factoryId: { in: f.factoryIds } } : {}),
    ...(f.buyerIds?.length ? { buyerId: { in: f.buyerIds } } : {}),
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
  include: {
    buyer: true;
    factory: true;
    brand: true;
    lines: { include: { sizes: true; colour: true; style: true; shipmentLines: { include: { sizes: true } } } };
    milestones: { select: { key: true; plannedDate: true; actualDate: true; styleId: true } };
  };
}>;

// Shared include for the row queries (ordered sizes + per-line shipped sizes for the balance).
const ROW_INCLUDE = {
  buyer: true,
  factory: true,
  brand: true,
  lines: { include: { sizes: true, colour: true, style: true, shipmentLines: { include: { sizes: true } } } },
  milestones: { select: { key: true, plannedDate: true, actualDate: true, styleId: true } },
} satisfies Prisma.PurchaseOrderInclude;

type MsLite = { key: string; plannedDate: Date | null; actualDate: Date | null; styleId: string | null };
export type MilestoneCells = {
  labDip: StatusCell; knitting: StatusCell; firstSample: StatusCell; secondSample: StatusCell; finalSampleDate: Date | null;
  trims: StatusCell; yarn: StatusCell; dyeing: StatusCell; bulkShade: StatusCell; ppSample: StatusCell;
  cutting: StatusCell; bulkSewing: StatusCell; printEmb: StatusCell; topSample: StatusCell; finalInspectionDate: Date | null;
};

/** Build the RAG status cells from a set of milestones (case-tolerant keys). */
function cellsFrom(ms: MsLite[], today: Date): MilestoneCells {
  const byKey = new Map(ms.map((m) => [m.key.toUpperCase(), m]));
  const cell = (k: string): StatusCell => {
    const m = byKey.get(k.toUpperCase());
    if (!m) return { state: "na", date: null };
    if (m.actualDate) return { state: "done", date: m.actualDate };
    if (m.plannedDate && m.plannedDate < today) return { state: "overdue", date: m.plannedDate };
    return { state: "pending", date: m.plannedDate };
  };
  return {
    labDip: cell(KEY.labDip), knitting: cell(KEY.knitting), firstSample: cell(KEY.firstSample), secondSample: cell(KEY.secondSample),
    finalSampleDate: byKey.get("FINAL_SAMPLE")?.actualDate ?? null,
    trims: cell(KEY.trims), yarn: cell(KEY.yarn), dyeing: cell(KEY.dyeing), bulkShade: cell(KEY.bulkShade), ppSample: cell(KEY.ppSample),
    cutting: cell(KEY.cutting), bulkSewing: cell(KEY.bulkSewing), printEmb: cell(KEY.printEmb), topSample: cell(KEY.topSample),
    finalInspectionDate: byKey.get("FINAL_AQL")?.actualDate ?? null,
  };
}

function mapRow(po: PoForRow, today: Date): OpenOrderRow {
  // Group milestones by styleId (null = legacy PO-level set).
  const msByStyle = new Map<string | null, MsLite[]>();
  for (const m of po.milestones) {
    const sid = m.styleId ?? null;
    const arr = msByStyle.get(sid) ?? [];
    arr.push(m);
    msByStyle.set(sid, arr);
  }
  const poLevelCells = cellsFrom(po.milestones, today); // aggregate / legacy fallback

  const sizes = [...new Set(po.lines.flatMap((l) => l.sizes.map((s) => s.label)))].join(", ");
  const colours = [...new Set(po.lines.map((l) => l.colour?.name).filter(Boolean) as string[])].join(", ");
  const styles = [...new Set(po.lines.map((l) => l.style?.styleCode).filter(Boolean) as string[])].join(", ");
  // Open qty/value = remaining balance (ordered − shipped), so a partly-shipped PO shows
  // only what's still to ship.
  const totals = remainingTotals(po.lines as unknown as LineForBalance[]);
  // Per-style breakdown: group the PO's lines by styleId, each with its own remaining qty/value,
  // sizes/colours, AND its own follow-up RAG cells (falling back to PO-level for legacy orders).
  const byStyle = new Map<string | null, PoForRow["lines"]>();
  for (const l of po.lines) {
    const sid = l.styleId ?? null;
    const arr = byStyle.get(sid) ?? [];
    arr.push(l);
    byStyle.set(sid, arr);
  }
  const styleBreakdown = [...byStyle.entries()].map(([sid, lines]) => {
    const t = remainingTotals(lines as unknown as LineForBalance[]);
    const ms = (sid && msByStyle.get(sid)) || msByStyle.get(null) || po.milestones;
    return {
      style: lines[0]?.style?.styleCode ?? "—",
      sizes: [...new Set(lines.flatMap((l) => l.sizes.map((s) => s.label)))].join(", ") || "—",
      colours: [...new Set(lines.map((l) => l.colour?.name).filter(Boolean) as string[])].join(", ") || "—",
      qty: t.qty,
      value: t.value,
      ...cellsFrom(ms, today),
    };
  });
  return {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    poReceiveDate: po.orderDate,
    factory: po.factory.name,
    buyer: po.buyer.name,
    brand: po.brand?.name ?? "—",
    sizes: sizes || "—",
    colours: colours || "—",
    confirmedShipDate: po.exFactoryDate,
    crd: po.crd,
    qty: totals.qty,
    pricePerUnit: totals.qty > 0 ? Math.round((totals.value / totals.qty) * 10000) / 10000 : 0,
    totalValue: totals.value,
    currency: po.currency,
    styles: styles || "—",
    styleBreakdown: styleBreakdown.length ? styleBreakdown : [{ style: "—", sizes: sizes || "—", colours: colours || "—", qty: totals.qty, value: totals.value, ...poLevelCells }],
    ...poLevelCells,
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
    include: ROW_INCLUDE,
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

  // count() is the true matching-PO count (no in-app cap). KPIs + charts use the REMAINING
  // balance (ordered − shipped), so a partly-shipped order contributes only its open qty/value
  // — consistent with the per-row QTY/VALUE. Per-PO projection (bounded) because the balance
  // needs each line's shipped sizes, which a flat SQL aggregate can't express.
  const [count, pos] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      select: {
        exFactoryDate: true,
        factory: { select: { name: true } },
        buyer: { select: { name: true } },
        lines: { select: { sizes: { select: { label: true, qty: true, netFob: true, sellFob: true } }, shipmentLines: { select: { sizes: { select: { label: true, qty: true } } } } } },
      },
      take: SUMMARY_CAP,
    }),
  ]);

  const now = Date.now();
  let totalQty = 0, totalValue = 0, shipping30 = 0;
  const fac = new Map<string, number>(), buy = new Map<string, number>();
  for (const po of pos) {
    const t = remainingTotals(po.lines as unknown as LineForBalance[]);
    totalQty += t.qty;
    totalValue += t.value;
    fac.set(po.factory.name, (fac.get(po.factory.name) ?? 0) + t.qty);
    buy.set(po.buyer.name, (buy.get(po.buyer.name) ?? 0) + 1);
    if (po.exFactoryDate && +po.exFactoryDate >= now && +po.exFactoryDate <= now + 30 * 86_400_000) shipping30++;
  }
  const top = (m: Map<string, number>) => [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 7);
  return { count, totalQty, totalValue, shipping30, byFactory: top(fac), byBuyer: top(buy) };
}

/** All filtered rows for CSV export (bounded). */
export async function openOrdersForExport(actor: SessionUser, filter: OpenOrdersFilter): Promise<OpenOrderRow[]> {
  assertPermission(actor, "orders", "view");
  const today = businessToday(new Date());
  const pos = await prisma.purchaseOrder.findMany({
    where: whereFor(actor, filter),
    include: ROW_INCLUDE,
    orderBy: [{ exFactoryDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 5_000,
  });
  return pos.map((po) => mapRow(po, today));
}
