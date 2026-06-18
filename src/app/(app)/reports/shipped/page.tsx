import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { shippedGoodsReport, type ShippedRow } from "@/lib/reports/shipped";
import { formatQty } from "@/lib/format";
import { CountUp } from "@/components/dashboard/count-up";
import { ShippedTable } from "@/components/reports/shipped-table";
import { Pagination } from "@/components/pagination";

function topBy(rows: ShippedRow[], key: (r: ShippedRow) => string, val: (r: ShippedRow) => number, n = 7) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + val(r));
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, n);
}

type SP = { page?: string };

export default async function ShippedReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "shipment", "view")) redirect("/dashboard");
  const sp = await searchParams;
  const report = await shippedGoodsReport(actor, { page: Math.max(1, Number(sp.page) || 1) });
  const { rows, kpis } = report;

  // Headline KPIs span ALL shipments (DB aggregate), not just the visible page.
  const totalQty = kpis.totalQty;
  const totalValue = kpis.receivableUsd;
  const paid = kpis.paid;
  const awaiting = kpis.awaiting;

  // Charts summarise the current page of rows (matches the open-orders report pattern).
  const byFactory = topBy(rows, (r) => r.factory, (r) => r.qty);
  const byBuyer = topBy(rows, (r) => r.buyer, () => 1);
  const facMax = Math.max(1, ...byFactory.map((d) => d.value));
  const buyMax = Math.max(1, ...byBuyer.map((d) => d.value));

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Report</p>
          <h1 className="text-2xl font-semibold tracking-tight">Shipped Goods</h1>
          <p className="mt-1 text-sm text-ink-soft">Shipped register — invoice, payment &amp; transaction-certificate status.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ok" /></span>
            {kpis.shipments} shipments
          </span>
          {can(actor, "shipment", "create") && (
            <Link href="/shipments/new" className="rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90">+ New shipment</Link>
          )}
        </div>
      </div>

      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Kpi label="Shipments" rail="var(--accent)"><CountUp value={kpis.shipments} format="qty" /></Kpi>
        <Kpi label="Shipped quantity (pcs)" rail="var(--ink)"><CountUp value={totalQty} format="qty" /></Kpi>
        <Kpi label="Invoiced value (USD)" rail="var(--ok)"><CountUp value={totalValue} format="money" /></Kpi>
        <Kpi label="Awaiting payment" rail="var(--warn)"><CountUp value={awaiting} format="qty" /><span className="ml-2 text-xs font-normal text-ink-soft">/ {paid} paid</span></Kpi>
      </div>

      <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ animationDelay: "120ms" }}>
        <ChartCard title="Shipped quantity by factory">
          <BarChart data={byFactory} max={facMax} color="var(--accent)" fmt={(v) => formatQty(v)} />
        </ChartCard>
        <ChartCard title="Shipments by buyer">
          <BarChart data={byBuyer} max={buyMax} color="var(--ink)" fmt={(v) => formatQty(v)} />
        </ChartCard>
      </div>

      <div className="rise space-y-3" style={{ animationDelay: "180ms" }}>
        <ShippedTable rows={rows} />
        <Pagination page={report.page} totalPages={report.totalPages} total={report.total} pageSize={report.pageSize} params={sp} />
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
