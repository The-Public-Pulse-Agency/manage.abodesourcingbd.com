import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { criticalPathBoard, criticalPathSummary, type StageProgress } from "@/lib/tna/board";
import { businessToday } from "@/lib/tna/schedule";
import { RagChip } from "@/components/rag-chip";
import { CountUp } from "@/components/dashboard/count-up";
import { formatDate } from "@/lib/format";

export default async function CriticalPathPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "criticalPath", "view")) redirect("/dashboard");
  const now = businessToday(new Date());
  const [items, summary] = await Promise.all([
    criticalPathBoard(actor, { now }),
    criticalPathSummary(actor, { now }),
  ]);
  const overdue = items.filter((i) => i.rag === "OVERDUE").length;

  return (
    <div className="space-y-6">
      <div className="rise">
        <p className="eyebrow">Merchandising</p>
        <h1 className="text-2xl font-semibold tracking-tight">Critical Path</h1>
        <p className="mt-1 text-sm text-ink-soft">Time &amp; action across all live orders — overall progress and what needs attention this week.</p>
      </div>

      <div className="rise grid grid-cols-2 gap-4 lg:grid-cols-5" style={{ animationDelay: "60ms" }}>
        <Kpi label="Milestones" rail="var(--ink)"><CountUp value={summary.total} format="qty" /></Kpi>
        <Kpi label="Complete" rail="var(--ok)"><CountUp value={summary.pctComplete ?? 0} format="pct" /></Kpi>
        <Kpi label="Overdue" rail="var(--bad)"><CountUp value={summary.overdue} format="qty" /></Kpi>
        <Kpi label="Due ≤ 7 days" rail="var(--warn)"><CountUp value={summary.dueSoon} format="qty" /></Kpi>
        <Kpi label="Pending" rail="var(--accent)"><CountUp value={summary.pending} format="qty" /></Kpi>
      </div>

      {summary.byStage.length > 0 && (
        <div className="rise rounded-lg border border-line bg-surface p-4 elevate" style={{ animationDelay: "120ms" }}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Progress by stage</h3>
          <div className="space-y-2.5">{summary.byStage.map((s) => <StageBar key={s.stage} s={s} />)}</div>
        </div>
      )}

      <p className="rise text-sm font-semibold" style={{ animationDelay: "180ms" }}>
        Attention this week — {items.length} due soon or overdue
        {overdue > 0 && <span className="text-bad"> · {overdue} overdue</span>}.
      </p>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">Milestone</th>
              <th className="px-3 py-2 font-semibold">Stage</th>
              <th className="px-3 py-2 font-semibold">PO</th>
              <th className="px-3 py-2 font-semibold">Buyer</th>
              <th className="px-3 py-2 font-semibold">Factory</th>
              <th className="px-3 py-2 font-semibold">Planned</th>
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-ink-soft">
                  Nothing due soon or overdue. 🎉
                </td>
              </tr>
            )}
            {items.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="px-3 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2 text-xs text-ink-soft">{m.stage.replace(/_/g, " ")}</td>
                <td className="px-3 py-2">
                  <Link href={`/orders/${m.poId}`} className="font-mono text-accent hover:underline">
                    {m.poNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">{m.buyer}</td>
                <td className="px-3 py-2">{m.factory}</td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(m.plannedDate)}</td>
                <td className="px-3 py-2"><RagChip rag={m.rag} /></td>
              </tr>
            ))}
          </tbody>
        </table>
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

function StageBar({ s }: { s: StageProgress }) {
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  return (
    <div className="grid grid-cols-[9rem_1fr_5rem] items-center gap-3 text-sm">
      <span className="truncate text-ink-soft">{s.stage.replace(/_/g, " ").toLowerCase()}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-paper">
        <div className="bar-fill h-full rounded-full bg-ok" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className="tnum text-right text-xs font-semibold">
        {s.done}/{s.total}{s.overdue > 0 && <span className="ml-1 text-bad">· {s.overdue}!</span>}
      </span>
    </div>
  );
}
