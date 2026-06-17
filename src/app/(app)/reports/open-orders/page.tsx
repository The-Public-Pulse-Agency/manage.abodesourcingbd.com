import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { openOrdersReport, type OpenOrderRow } from "@/lib/reports/open-orders";
import { formatQty } from "@/lib/format";
import { CountUp } from "@/components/dashboard/count-up";
import { OpenOrdersTable } from "@/components/reports/open-orders-table";

function topBy(rows: OpenOrderRow[], key: (r: OpenOrderRow) => string, val: (r: OpenOrderRow) => number, n = 7) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + val(r));
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, n);
}

export default async function OpenOrdersReportPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "orders", "view")) redirect("/dashboard");
  const rows = await openOrdersReport(actor, { now: new Date() });

  const totalQty = rows.reduce((a, r) => a + r.qty, 0);
  const totalValue = rows.reduce((a, r) => a + r.totalValue, 0);
  const now = Date.now();
  const shipping30 = rows.filter((r) => r.confirmedShipDate && r.confirmedShipDate.getTime() >= now && r.confirmedShipDate.getTime() <= now + 30 * 86_400_000).length;

  const byFactory = topBy(rows, (r) => r.factory, (r) => r.qty);
  const byBuyer = topBy(rows, (r) => r.buyer, () => 1);
  const facMax = Math.max(1, ...byFactory.map((d) => d.value));
  const buyMax = Math.max(1, ...byBuyer.map((d) => d.value));

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Report</p>
          <h1 className="text-2xl font-semibold tracking-tight">Open / Running Orders</h1>
          <p className="mt-1 text-sm text-ink-soft">Live order book — status columns track the critical path in real time.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ok" /></span>
          {rows.length} live orders
        </div>
      </div>

      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Kpi label="Open orders" rail="var(--accent)"><CountUp value={rows.length} format="qty" /></Kpi>
        <Kpi label="Total quantity (pcs)" rail="var(--ink)"><CountUp value={totalQty} format="qty" /></Kpi>
        <Kpi label="Order value (USD)" rail="var(--ok)"><CountUp value={totalValue} format="money" /></Kpi>
        <Kpi label="Shipping ≤ 30 days" rail="var(--warn)"><CountUp value={shipping30} format="qty" /></Kpi>
      </div>

      <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ animationDelay: "120ms" }}>
        <ChartCard title="Quantity by factory">
          <BarChart data={byFactory} max={facMax} color="var(--accent)" fmt={(v) => formatQty(v)} />
        </ChartCard>
        <ChartCard title="Orders by buyer">
          <BarChart data={byBuyer} max={buyMax} color="var(--ink)" fmt={(v) => formatQty(v)} />
        </ChartCard>
      </div>

      <div className="rise" style={{ animationDelay: "180ms" }}>
        <OpenOrdersTable rows={rows} />
      </div>
    </div>
  );
}

function Kpi({ label, rail, children }: { label: string; rail: string; children: React.ReactNode }) {
  return (
    <div className="kpi rounded-lg border border-line bg-surface p-4 elevate" style={{ "--kpi-rail": rail } as React.CSSProperties}>
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-1 text-xl font-semibold">{children}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface elevate">
      <div className="border-b border-line bg-paper px-4 py-2.5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function BarChart({ data, max, color, fmt }: { data: { label: string; value: number }[]; max: number; color: string; fmt: (v: number) => string }) {
  if (data.length === 0) return <p className="py-6 text-center text-sm text-ink-soft">No data.</p>;
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-ink-soft" title={d.label}>{d.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-paper">
            <div className="bar-fill h-full rounded-full" style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, background: color }} />
          </div>
          <span className="tnum text-right text-xs font-semibold">{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}
