import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
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
  // Per-style breakdown (remaining qty/value), so the report shows one row per style. Critical-
  // path / follow-up status lives on the Critical Path page + order detail, not here.
  styleBreakdown: { style: string; sizes: string; colours: string; qty: number; netFob: number; value: number }[];
  remarks: string;
};

export type OpenOrdersFilter = { status?: string; factoryIds?: string[]; buyerIds?: string[]; brandIds?: string[]; q?: string; shipYear?: string; shipMonth?: string };

/** [start, end) UTC range for a ship year (+ optional 1-12 month), or null when no period filter. */
export function shipDateRange(year?: string, month?: string): { gte: Date; lt: Date } | null {
  const y = Number(year);
  if (!year || !Number.isFinite(y)) return null;
  const mo = month ? Number(month) : 0;
  if (mo >= 1 && mo <= 12) return { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) };
  return { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
}

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
    ...(f.brandIds?.length ? { brandId: { in: f.brandIds } } : {}),
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
  };
}>;

// Shared include for the row queries (ordered sizes + per-line shipped sizes for the balance).
const ROW_INCLUDE = {
  buyer: true,
  factory: true,
  brand: true,
  lines: { include: { sizes: true, colour: true, style: true, shipmentLines: { include: { sizes: true } } } },
} satisfies Prisma.PurchaseOrderInclude;

type BreakdownRow = OpenOrderRow["styleBreakdown"][number];

/**
 * Split one style's lines into ONE row per distinct (net FOB, sell FOB) price, so a style
 * priced differently by size (e.g. XS–2XL @ $1.50, 3XL–6XL @ $2.00) renders as two lines —
 * each with its own qty/value and a single clean Net FOB — instead of one blended average.
 * Quantities use the REMAINING balance (ordered − shipped); a tier with nothing left to ship
 * is dropped. Tiers, and the sizes within each, are ordered by size position.
 */
function priceGroupRows(lines: PoForRow["lines"]): BreakdownRow[] {
  const style = lines[0]?.style?.styleCode ?? "—";
  type Group = { minPos: number; labels: Map<string, number>; colours: Set<string>; sizes: { qty: number; netFob: Decimalish; sellFob: Decimalish }[] };
  const groups = new Map<string, Group>();
  for (const l of lines) {
    const shipped = l.shipmentLines.flatMap((sl) => sl.sizes.map((s) => ({ label: s.label, qty: s.qty })));
    const bal = remainingBySize(l.sizes.map((s) => ({ label: s.label, qty: s.qty })), shipped);
    const balByLabel = new Map(bal.map((b) => [b.label, Math.max(0, b.balance)]));
    const colour = l.colour?.name;
    for (const s of l.sizes) {
      const remaining = balByLabel.get(s.label) ?? s.qty;
      const key = `${Number(s.netFob)}|${Number(s.sellFob)}`;
      let g = groups.get(key);
      if (!g) { g = { minPos: Number.POSITIVE_INFINITY, labels: new Map(), colours: new Set(), sizes: [] }; groups.set(key, g); }
      g.sizes.push({ qty: remaining, netFob: s.netFob, sellFob: s.sellFob });
      if (remaining > 0) {
        if (!g.labels.has(s.label)) g.labels.set(s.label, s.position);
        if (colour) g.colours.add(colour);
        if (s.position < g.minPos) g.minPos = s.position;
      }
    }
  }
  return [...groups.values()]
    .map((g) => {
      const t = rollup([lineMills(g.sizes)]);
      const sizeLabels = [...g.labels.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label);
      const row: BreakdownRow = {
        style,
        sizes: sizeLabels.join(", ") || "—",
        colours: [...g.colours].join(", ") || "—",
        qty: t.qty,
        netFob: t.qty > 0 ? Math.round((t.cost / t.qty) * 10000) / 10000 : 0,
        value: t.value,
      };
      return { minPos: g.minPos, row };
    })
    .filter((x) => x.row.qty > 0)
    .sort((a, b) => a.minPos - b.minPos)
    .map((x) => x.row);
}

function mapRow(po: PoForRow): OpenOrderRow {
  const sizes = [...new Set(po.lines.flatMap((l) => l.sizes.map((s) => s.label)))].join(", ");
  const colours = [...new Set(po.lines.map((l) => l.colour?.name).filter(Boolean) as string[])].join(", ");
  const styles = [...new Set(po.lines.map((l) => l.style?.styleCode).filter(Boolean) as string[])].join(", ");
  // Open qty/value = remaining balance (ordered − shipped), so a partly-shipped PO shows
  // only what's still to ship.
  const totals = remainingTotals(po.lines as unknown as LineForBalance[]);
  // Per-style breakdown: group the PO's lines by styleId, each with its own remaining qty/value
  // + sizes/colours, so the report can render one row per style.
  const byStyle = new Map<string | null, PoForRow["lines"]>();
  for (const l of po.lines) {
    const sid = l.styleId ?? null;
    const arr = byStyle.get(sid) ?? [];
    arr.push(l);
    byStyle.set(sid, arr);
  }
  // One row per (style, price): a style with size-varying prices splits into a line per price
  // tier (each with its own qty/value/Net FOB), never a blended average.
  const styleBreakdown = [...byStyle.values()].flatMap((lines) => priceGroupRows(lines));
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
    styleBreakdown: styleBreakdown.length ? styleBreakdown : [{ style: "—", sizes: sizes || "—", colours: colours || "—", qty: totals.qty, netFob: totals.qty > 0 ? Math.round((totals.cost / totals.qty) * 10000) / 10000 : 0, value: totals.value }],
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
  return { rows: pos.map((po) => mapRow(po)), total, page, pageSize, totalPages };
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
  const pos = await prisma.purchaseOrder.findMany({
    where: whereFor(actor, filter),
    include: ROW_INCLUDE,
    orderBy: [{ exFactoryDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 5_000,
  });
  return pos.map((po) => mapRow(po));
}
