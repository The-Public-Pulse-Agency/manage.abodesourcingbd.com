import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { dashboardSummary } from "@/lib/dashboard/summary";
import { factoryLeagueTable } from "@/lib/dashboard/factories";
import { enquiryPipelineKpis } from "@/lib/enquiries/enquiries";
import { formatMoney, formatQty, formatDate } from "@/lib/format";
import { CountUp } from "@/components/dashboard/count-up";

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
  const cashMax = Math.max(s.finance.receivable, s.finance.payable, 1);
  const today = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="text-2xl font-semibold tracking-tight">Order Book Overview</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
          </span>
          Live · {today}
        </div>
      </div>

      {/* Hero KPI band */}
      <div className="rise hero-band elevate-lg overflow-hidden rounded-lg border border-line" style={{ animationDelay: "60ms" }}>
        <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <HeroCell icon={<IconBox />} rail="var(--accent)" label="Open order book">
            <CountUp value={s.openOrders.value} format="money" className="tnum block text-[1.75rem] font-semibold leading-tight" />
            <p className="mt-1 text-xs text-ink-soft">{formatQty(s.openOrders.count)} live orders</p>
          </HeroCell>

          <HeroCell icon={<IconTarget />} rail="var(--ok)" label="On-time delivery">
            <div className="flex items-center gap-3">
              <DonutRing pct={s.otd.pct} />
              <div className="text-xs text-ink-soft">
                {s.otd.pct === null ? "No history yet" : <><span className="font-semibold text-ink">{s.otd.onTime}</span> / {s.otd.completed}<br />shipped on time</>}
              </div>
            </div>
          </HeroCell>

          <HeroCell icon={<IconCash />} rail="var(--warn)" label="Cash position">
            <Meter label="Receivable" value={s.finance.receivable} max={cashMax} color="var(--ok)" />
            <Meter label="Payable" value={s.finance.payable} max={cashMax} color="var(--bad)" />
          </HeroCell>

          {pipeline ? (
            <HeroCell icon={<IconFunnel />} rail="var(--ink)" label="Enquiry pipeline">
              <CountUp value={pipeline.openValueUsd} format="money" className="tnum block text-[1.75rem] font-semibold leading-tight" />
              <p className="mt-1 text-xs text-ink-soft">{pipeline.openCount} open · {pipeline.wonRate === null ? "—" : `${pipeline.wonRate}%`} win rate</p>
            </HeroCell>
          ) : (
            <HeroCell icon={<IconFunnel />} rail="var(--ink)" label="Open orders">
              <CountUp value={s.openOrders.count} format="qty" className="tnum block text-[1.75rem] font-semibold leading-tight" />
              <p className="mt-1 text-xs text-ink-soft">in the live book</p>
            </HeroCell>
          )}
        </div>
      </div>

      {/* Quick reports */}
      <div className="rise grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: "120ms" }}>
        <ReportCard href="/reports/open-orders" icon={<IconBox />} title="Open / Running Orders" desc="PO → ship status across the critical path" />
        <ReportCard href="/reports/development" icon={<IconTarget />} title="Development Program" desc="Lab dip, knitting & sample approvals" />
        <ReportCard href="/reports/shipped" icon={<IconShip />} title="Shipped Goods" desc="Invoices, payments, container & TC status" />
        <ReportCard href="/reports/factories" icon={<IconCert />} title="Factory Information" desc="Compliance certificates & validity" />
      </div>

      {/* Exception tiles */}
      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "180ms" }}>
        <Exception label="Milestones overdue" count={e.overdueMilestones} href="/critical-path" tone="bad" icon={<IconAlert />} />
        <Exception label="Milestones due soon" count={e.dueSoonMilestones} href="/critical-path" tone="warn" icon={<IconClock />} />
        <Exception label="Payments overdue >30d" count={e.paymentOverdue} href="/finance" tone="warn" icon={<IconCash />} />
        <Exception label="Telex pending" count={e.telexPending.length} href="/shipments" tone="warn" icon={<IconShip />} />
      </div>

      {/* Watchlists */}
      <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ animationDelay: "240ms" }}>
        <Panel title="Ex-factory due within 7 days" href="/critical-path" linkLabel="Critical path">
          {e.exFtyDue7d.length === 0 ? (
            <Empty>Nothing due this week.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {e.exFtyDue7d.map((x) => (
                <li key={x.poId} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-accent-soft">
                  <Link href={`/orders/${x.poId}`} className="font-mono font-medium text-accent hover:underline">{x.poNumber}</Link>
                  <span className="min-w-0 flex-1 truncate text-right text-ink-soft">{x.buyer} · {x.factory}</span>
                  <span className="tnum shrink-0 rounded-sm bg-paper px-1.5 py-0.5 text-xs">{formatDate(x.exFactoryDate)}</span>
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
                <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-accent-soft">
                  <span className="font-mono font-medium">{t.reference}</span>
                  <span className="font-mono text-ink-soft">{t.blNumber}</span>
                  <span className="rounded-sm bg-warn-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase text-warn">Telex pending</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Factory performance */}
      {factories.length > 0 && (
        <div className="rise overflow-hidden rounded-lg border border-line bg-surface elevate" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2.5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Factory performance</h3>
            <Link href="/reports/factories" className="link-accent text-xs text-ink-soft hover:text-accent">Factory info →</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-2 font-semibold">Factory</th>
                <th className="px-3 py-2 text-right font-semibold">Open</th>
                <th className="px-3 py-2 text-right font-semibold">Open value</th>
                <th className="px-3 py-2 font-semibold">OTD</th>
                <th className="px-3 py-2 font-semibold">AQL pass</th>
              </tr>
            </thead>
            <tbody>
              {factories.map((f, i) => (
                <tr key={f.factoryId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper font-mono text-xs font-semibold text-ink-soft">{i + 1}</span>
                      <span className="font-medium">{f.name}</span>
                      <span className="font-mono text-[0.6875rem] text-ink-soft">{f.type}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tnum">{formatQty(f.openOrders)}</td>
                  <td className="px-3 py-2.5 text-right tnum">{formatMoney(f.openValueUsd)}</td>
                  <td className="px-3 py-2.5"><TableMeter pct={f.otdPct} good={85} /></td>
                  <td className="px-3 py-2.5"><TableMeter pct={f.aqlPct} good={90} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── presentational helpers ───────────────────────────────────────────────── */

function HeroCell({ icon, label, rail, children }: { icon: React.ReactNode; label: string; rail: string; children: React.ReactNode }) {
  return (
    <div className="kpi p-5" style={{ "--kpi-rail": rail } as React.CSSProperties}>
      <div className="mb-2 flex items-center gap-2 text-ink-soft">
        <span style={{ color: rail }}>{icon}</span>
        <span className="eyebrow">{label}</span>
      </div>
      {children}
    </div>
  );
}

function DonutRing({ pct }: { pct: number | null }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const value = pct ?? 0;
  const off = circ * (1 - value / 100);
  const color = pct === null ? "var(--ink-soft)" : value >= 90 ? "var(--ok)" : value >= 75 ? "var(--warn)" : "var(--bad)";
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0 -rotate-90">
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
      {pct !== null && (
        <circle
          cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} className="ring-arc"
          style={{ "--circ": `${circ}px`, "--off": `${off}px`, strokeDashoffset: off } as React.CSSProperties}
        />
      )}
      <text x="34" y="34" transform="rotate(90 34 34)" textAnchor="middle" dominantBaseline="central" className="fill-ink tnum text-[0.95rem] font-semibold">
        {pct === null ? "—" : `${pct}%`}
      </text>
    </svg>
  );
}

function Meter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const w = Math.max(2, Math.round((value / max) * 100));
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-ink-soft">{label}</span>
        <span className="tnum font-semibold">{formatMoney(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper">
        <div className="bar-fill h-full rounded-full" style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  );
}

function TableMeter({ pct, good }: { pct: number | null; good: number }) {
  if (pct === null) return <span className="text-xs text-ink-soft">—</span>;
  const color = pct >= good ? "var(--ok)" : pct >= good - 15 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-paper">
        <div className="bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="tnum w-9 text-right text-xs font-semibold" style={{ color }}>{pct}%</span>
    </div>
  );
}

function ReportCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="card-hover elevate group block rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">{icon}</span>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{desc}</p>
          <p className="mt-2 text-xs font-medium text-accent">Open report <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span></p>
        </div>
      </div>
    </Link>
  );
}

function Exception({ label, count, href, tone, icon }: { label: string; count: number; href: string; tone: "bad" | "warn"; icon: React.ReactNode }) {
  const hot = count > 0;
  const color = !hot ? "var(--ink-soft)" : tone === "bad" ? "var(--bad)" : "var(--warn)";
  const bg = !hot ? "bg-paper" : tone === "bad" ? "bg-bad-soft" : "bg-warn-soft";
  return (
    <Link href={href} className="card-hover elevate flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${bg}`} style={{ color }}>{icon}</span>
      <div className="min-w-0">
        <p className="tnum text-2xl font-semibold leading-none" style={{ color: hot ? color : "var(--ink)" }}>{count}</p>
        <p className="mt-1 truncate text-xs text-ink-soft">{label}</p>
      </div>
    </Link>
  );
}

function Panel({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface elevate">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2.5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{title}</h3>
        <Link href={href} className="link-accent text-xs text-ink-soft hover:text-accent">{linkLabel} →</Link>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-ink-soft">{children}</p>;
}

/* ── inline icons (stroke, currentColor) ──────────────────────────────────── */

const SVG = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p} />
);
const IconBox = () => <SVG><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></SVG>;
const IconTarget = () => <SVG><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></SVG>;
const IconCash = () => <SVG><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></SVG>;
const IconFunnel = () => <SVG><path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z" /></SVG>;
const IconShip = () => <SVG><path d="M3 13h18l-2 6a2 2 0 0 1-1.8 1H6.8A2 2 0 0 1 5 19l-2-6Z" /><path d="M12 3v10M8 6h8M5 13V9h14v4" /></SVG>;
const IconCert = () => <SVG><circle cx="12" cy="9" r="5" /><path d="M9 13.5 8 22l4-2 4 2-1-8.5" /></SVG>;
const IconAlert = () => <SVG><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></SVG>;
const IconClock = () => <SVG><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></SVG>;
