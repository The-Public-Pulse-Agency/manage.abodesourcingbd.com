import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { dashboardSummary } from "@/lib/dashboard/summary";
import { factoryLeagueTable } from "@/lib/dashboard/factories";
import { enquiryPipelineKpis } from "@/lib/enquiries/enquiries";
import { formatMoney, formatQty, formatDate } from "@/lib/format";

export default async function DashboardPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (!can(actor.role, "dashboards", "view")) redirect("/orders");

  const now = new Date();
  const [s, factories, pipeline] = await Promise.all([
    dashboardSummary(actor, { now }),
    factoryLeagueTable(actor, { now }),
    can(actor.role, "orders", "view") ? enquiryPipelineKpis(actor) : Promise.resolve(null),
  ]);
  const e = s.exceptions;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Dashboard</p>
        <h1 className="text-2xl font-semibold tracking-tight">Order Book Overview</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Open orders" value={formatQty(s.openOrders.count)} />
        <Stat label="Open order value (USD)" value={formatMoney(s.openOrders.value)} />
        <Stat label="On-time delivery" value={s.otd.pct === null ? "—" : `${s.otd.pct}%`} hint={`${s.otd.onTime}/${s.otd.completed} on time`} />
        <Stat label="Receivable (AR)" value={formatMoney(s.finance.receivable)} />
        <Stat label="Payable (AP)" value={formatMoney(s.finance.payable)} />
        {pipeline && (
          <Stat
            label="Enquiry pipeline (USD)"
            value={formatMoney(pipeline.openValueUsd)}
            hint={`${pipeline.openCount} open · ${pipeline.wonRate === null ? "—" : `${pipeline.wonRate}%`} win`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Ex-factory due within 7 days" href="/critical-path" linkLabel="Critical path">
          {e.exFtyDue7d.length === 0 ? (
            <Empty>Nothing due this week.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {e.exFtyDue7d.map((x) => (
                <li key={x.poId} className="flex items-center justify-between px-4 py-2 text-sm">
                  <Link href={`/orders/${x.poId}`} className="font-mono text-accent hover:underline">{x.poNumber}</Link>
                  <span className="text-ink-soft">{x.buyer} · {x.factory}</span>
                  <span className="tnum">{formatDate(x.exFactoryDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Telex pending (BL issued)" href="/shipments" linkLabel="Shipments">
          {e.telexPending.length === 0 ? (
            <Empty>All shipments released. 🎉</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {e.telexPending.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="font-mono">{t.reference}</span>
                  <span className="font-mono text-ink-soft">{t.blNumber}</span>
                  <span className="rounded-sm bg-warn-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase text-warn">Telex pending</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Exception label="Milestones overdue" count={e.overdueMilestones} href="/critical-path" tone="bad" />
        <Exception label="Milestones due soon" count={e.dueSoonMilestones} href="/critical-path" tone="warn" />
        <Exception label="Payments overdue (>30d)" count={e.paymentOverdue} href="/finance" tone="warn" />
      </div>

      {factories.length > 0 && (
        <div className="overflow-hidden rounded-md border border-line bg-surface elevate">
          <div className="border-b border-line bg-paper px-4 py-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Factory performance</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-1.5 font-semibold">Factory</th>
                <th className="px-3 py-1.5 text-right font-semibold">Open orders</th>
                <th className="px-3 py-1.5 text-right font-semibold">Open value (USD)</th>
                <th className="px-3 py-1.5 text-right font-semibold">OTD %</th>
                <th className="px-3 py-1.5 text-right font-semibold">AQL pass %</th>
              </tr>
            </thead>
            <tbody>
              {factories.map((f) => (
                <tr key={f.factoryId} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5">
                    <span className="font-medium">{f.name}</span>
                    <span className="ml-1 font-mono text-xs text-ink-soft">{f.type}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right tnum">{formatQty(f.openOrders)}</td>
                  <td className="px-3 py-1.5 text-right tnum">{formatMoney(f.openValueUsd)}</td>
                  <td className="px-3 py-1.5 text-right tnum">{f.otdPct === null ? "—" : `${f.otdPct}%`}</td>
                  <td className="px-3 py-1.5 text-right tnum">{f.aqlPct === null ? "—" : `${f.aqlPct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4 elevate">
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function Panel({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface elevate">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{title}</h3>
        <Link href={href} className="link-accent text-xs text-ink-soft hover:text-accent">{linkLabel} →</Link>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-ink-soft">{children}</p>;
}

function Exception({ label, count, href, tone }: { label: string; count: number; href: string; tone: "bad" | "warn" }) {
  const color = count === 0 ? "text-ink" : tone === "bad" ? "text-bad" : "text-warn";
  return (
    <Link href={href} className="card-hover elevate rounded-md border border-line bg-surface p-4">
      <p className="eyebrow">{label}</p>
      <p className={`tnum mt-1 text-2xl font-semibold ${color}`}>{count}</p>
    </Link>
  );
}
