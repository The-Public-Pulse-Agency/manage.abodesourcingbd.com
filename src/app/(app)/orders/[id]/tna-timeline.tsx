"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RagChip } from "@/components/rag-chip";
import { completeMilestoneAction } from "@/lib/tna/form-actions";

type Milestone = {
  id: string;
  name: string;
  stage: string;
  plannedDate: string | Date | null;
  actualDate: string | Date | null;
  rag: string;
};

function fmt(d: string | Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

const TODAY = new Date().toISOString().slice(0, 10);

export function TnaTimeline({
  poId,
  milestones,
  canEdit,
}: {
  poId: string;
  milestones: Milestone[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});

  async function complete(id: string) {
    setBusy(id);
    setError(null);
    const day = dates[id] ?? TODAY;
    const res = await completeMilestoneAction(poId, id, `${day}T00:00:00.000Z`);
    setBusy(null);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-sm border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Critical Path</h3>
        {error && <span className="text-xs text-bad">{error}</span>}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-3 py-1.5 font-semibold">Stage</th>
            <th className="px-3 py-1.5 font-semibold">Milestone</th>
            <th className="px-3 py-1.5 font-semibold">Planned</th>
            <th className="px-3 py-1.5 font-semibold">Actual</th>
            <th className="px-3 py-1.5 font-semibold">Status</th>
            {canEdit && <th className="px-3 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {milestones.map((m) => (
            <tr key={m.id} className="border-b border-line last:border-0">
              <td className="px-3 py-1.5 text-xs text-ink-soft">{m.stage.replace(/_/g, " ")}</td>
              <td className="px-3 py-1.5">{m.name}</td>
              <td className="px-3 py-1.5 tnum text-xs">{fmt(m.plannedDate)}</td>
              <td className="px-3 py-1.5 tnum text-xs">{fmt(m.actualDate)}</td>
              <td className="px-3 py-1.5"><RagChip rag={m.rag} /></td>
              {canEdit && (
                <td className="px-3 py-1.5 text-right">
                  {!m.actualDate && (
                    <span className="inline-flex items-center gap-1">
                      <input
                        type="date"
                        aria-label={`Actual date for ${m.name}`}
                        value={dates[m.id] ?? TODAY}
                        onChange={(e) => setDates((s) => ({ ...s, [m.id]: e.target.value }))}
                        className="input px-1 py-0.5 text-xs"
                      />
                      <button
                        type="button"
                        disabled={busy === m.id}
                        onClick={() => complete(m.id)}
                        className="rounded-sm border border-line px-2 py-0.5 text-xs hover:border-accent hover:text-accent disabled:opacity-50"
                      >
                        Done
                      </button>
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
