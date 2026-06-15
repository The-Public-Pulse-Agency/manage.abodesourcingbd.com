import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { criticalPathBoard } from "@/lib/tna/board";
import { RagChip } from "@/components/rag-chip";
import { formatDate } from "@/lib/format";

export default async function CriticalPathPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "criticalPath", "view")) redirect("/dashboard");
  const items = await criticalPathBoard(actor, { now: new Date() });
  const overdue = items.filter((i) => i.rag === "OVERDUE").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Merchandising</p>
        <h1 className="text-2xl font-semibold tracking-tight">Critical Path — attention this week</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {items.length} milestone{items.length === 1 ? "" : "s"} due soon or overdue
          {overdue > 0 && <span className="text-bad"> · {overdue} overdue</span>}.
        </p>
      </div>

      <div className="overflow-hidden rounded-sm border border-line bg-surface">
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
