import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listOpenOrders, openOrdersSummary, type OpenOrdersFilter, type StatusCell } from "@/lib/reports/open-orders";
import { listFactories } from "@/lib/masterdata/factory";
import { listBuyers } from "@/lib/masterdata/buyer";
import { formatDate, formatQty } from "@/lib/format";
import { CountUp } from "@/components/dashboard/count-up";
import { ReportFilters } from "@/components/reports/report-filters";
import { Pagination } from "@/components/pagination";

function Cell({ c }: { c: StatusCell }) {
  if (c.state === "na") return <span className="text-ink-soft">—</span>;
  if (c.state === "done") return <span className="inline-flex rounded-sm bg-ok-soft px-1.5 py-0.5 text-[0.625rem] font-semibold text-ok">✓ {c.date ? formatDate(c.date) : "done"}</span>;
  if (c.state === "overdue") return <span className="inline-flex rounded-sm bg-bad-soft px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-bad">overdue</span>;
  return <span className="inline-flex rounded-sm bg-warn-soft px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-warn">pending</span>;
}

type SP = { page?: string; status?: string; factory?: string; buyer?: string; q?: string };

export default async function DevelopmentReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "orders", "view")) redirect("/dashboard");
  const sp = await searchParams;
  const filter: OpenOrdersFilter = { status: sp.status, factoryId: sp.factory, buyerId: sp.buyer, q: sp.q };

  const [book, summary, factories, buyers] = await Promise.all([
    listOpenOrders(actor, filter, { page: Math.max(1, Number(sp.page) || 1) }),
    openOrdersSummary(actor, filter),
    listFactories(actor),
    listBuyers(actor),
  ]);

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Development</p>
          <h1 className="text-2xl font-semibold tracking-tight">Development Program</h1>
          <p className="mt-1 text-sm text-ink-soft">Sample development pipeline — lab dip, knitting &amp; sample approvals per order.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ok" /></span>
          {book.total} in development
        </div>
      </div>

      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Kpi label="Orders in development" rail="var(--accent)"><CountUp value={book.total} format="qty" /></Kpi>
        <Kpi label="Total quantity (pcs)" rail="var(--ink)"><CountUp value={summary.totalQty} format="qty" /></Kpi>
        <Kpi label="Factories" rail="var(--ok)"><CountUp value={summary.byFactory.length} format="qty" /></Kpi>
        <Kpi label="Buyers" rail="var(--warn)"><CountUp value={summary.byBuyer.length} format="qty" /></Kpi>
      </div>

      <div className="rise space-y-3" style={{ animationDelay: "120ms" }}>
        <ReportFilters
          searchPlaceholder="Search PO, style, colour, factory, buyer…"
          resultLabel={`${book.rows.length} on this page · ${book.total} total`}
          selects={[
            { param: "status", allLabel: "All statuses", options: ["DRAFT", "CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED"].map((s) => ({ value: s, label: s.replace("_", " ").toLowerCase() })) },
            { param: "factory", allLabel: "All factories", options: factories.map((f) => ({ value: f.id, label: f.name })) },
            { param: "buyer", allLabel: "All buyers", options: buyers.map((b) => ({ value: b.id, label: b.name })) },
          ]}
        />
        <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
          <table className="list-table w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2.5 font-semibold">PO</th><th className="px-3 py-2.5 font-semibold">Factory</th><th className="px-3 py-2.5 font-semibold">Buyer</th>
                <th className="px-3 py-2.5 font-semibold">Style</th><th className="px-3 py-2.5 font-semibold">Colour</th>
                <th className="px-3 py-2.5 font-semibold">Lab dip</th><th className="px-3 py-2.5 font-semibold">Knitting</th>
                <th className="px-3 py-2.5 font-semibold">1st sample</th><th className="px-3 py-2.5 font-semibold">2nd sample</th>
                <th className="px-3 py-2.5 font-semibold">Final sample sent</th><th className="px-3 py-2.5 font-semibold">Edit</th>
              </tr>
            </thead>
            <tbody>
              {book.rows.length === 0 && <tr><td colSpan={11} className="px-3 py-10 text-center text-ink-soft">No orders match.</td></tr>}
              {book.rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2"><Link href={`/orders/${r.id}`} className="font-mono font-medium text-accent hover:underline">{r.poNumber}</Link></td>
                  <td className="px-3 py-2">{r.factory}</td>
                  <td className="px-3 py-2">{r.buyer}</td>
                  <td className="px-3 py-2 text-xs">{r.styles}</td>
                  <td className="px-3 py-2 text-xs">{r.colours}</td>
                  <td className="px-3 py-2"><Cell c={r.labDip} /></td>
                  <td className="px-3 py-2"><Cell c={r.knitting} /></td>
                  <td className="px-3 py-2"><Cell c={r.firstSample} /></td>
                  <td className="px-3 py-2"><Cell c={r.secondSample} /></td>
                  <td className="px-3 py-2 tnum text-xs">{formatDate(r.finalSampleDate)}</td>
                  <td className="px-3 py-2"><Link href={`/orders/${r.id}`} className="text-xs font-medium text-accent hover:underline">Edit →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={book.page} totalPages={book.totalPages} total={book.total} pageSize={book.pageSize} params={sp} />
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
