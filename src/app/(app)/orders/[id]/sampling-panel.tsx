"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSampleAction, updateSampleStatusAction } from "@/lib/sampling/form-actions";

type Sample = {
  id: string;
  type: string;
  colourId: string | null;
  status: string;
  approvedDate: string | Date | null;
  sentDate: string | Date | null;
};

/** Days a sent sample has been awaiting approval (null if not sent or already decided). */
function awaitingDays(s: Sample): number | null {
  if (!s.sentDate || (s.status !== "PENDING" && s.status !== "SUBMITTED")) return null;
  const sent = typeof s.sentDate === "string" ? new Date(s.sentDate) : s.sentDate;
  return Math.max(0, Math.floor((Date.now() - sent.getTime()) / 86_400_000));
}
type Opt = { id: string; name: string };

const NEXT: Record<string, { label: string; status: string }[]> = {
  PENDING: [{ label: "Submit", status: "SUBMITTED" }],
  SUBMITTED: [
    { label: "Approve", status: "APPROVED" },
    { label: "Reject", status: "REJECTED" },
  ],
  REJECTED: [{ label: "Resubmit", status: "SUBMITTED" }],
  APPROVED: [],
};

const STATUS_CLS: Record<string, string> = {
  PENDING: "bg-line text-ink-soft",
  SUBMITTED: "bg-warn-soft text-warn",
  APPROVED: "bg-ok-soft text-ok",
  REJECTED: "bg-bad-soft text-bad",
};

export function SamplingPanel({
  poId,
  samples,
  colours,
  canCreate,
  canEdit,
}: {
  poId: string;
  samples: Sample[];
  colours: Opt[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const colourName = (id: string | null) => colours.find((c) => c.id === id)?.name ?? "—";

  async function advance(id: string, status: string) {
    setMsg(null);
    const approvedDate = status === "APPROVED" ? `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z` : undefined;
    const res = await updateSampleStatusAction(poId, id, status, approvedDate);
    if (res.error) setMsg(res.error);
    else router.refresh();
  }

  return (
    <div className="rounded-sm border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Sampling</h3>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-3 py-1.5 font-semibold">Type</th>
            <th className="px-3 py-1.5 font-semibold">Colour</th>
            <th className="px-3 py-1.5 font-semibold">Status</th>
            {canEdit && <th className="px-3 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {samples.length === 0 && (
            <tr><td colSpan={canEdit ? 4 : 3} className="px-3 py-4 text-center text-ink-soft">No samples yet.</td></tr>
          )}
          {samples.map((s) => (
            <tr key={s.id} className="border-b border-line last:border-0">
              <td className="px-3 py-1.5 font-mono text-xs">{s.type.replace(/_/g, " ")}</td>
              <td className="px-3 py-1.5">{colourName(s.colourId)}</td>
              <td className="px-3 py-1.5">
                <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${STATUS_CLS[s.status] ?? ""}`}>
                  {s.status}
                </span>
                {(() => {
                  const d = awaitingDays(s);
                  if (d === null || d < 3) return null;
                  return (
                    <span className={`ml-2 inline-flex rounded-sm px-1.5 py-0.5 text-[0.625rem] font-semibold ${d >= 10 ? "bg-bad-soft text-bad" : d >= 5 ? "bg-warn-soft text-warn" : "text-ink-soft"}`}>
                      awaiting {d}d
                    </span>
                  );
                })()}
              </td>
              {canEdit && (
                <td className="px-3 py-1.5 text-right">
                  {(NEXT[s.status] ?? []).map((n) => (
                    <button
                      key={n.status}
                      type="button"
                      onClick={() => advance(s.id, n.status)}
                      className="ml-2 rounded-sm border border-line px-2 py-0.5 text-xs hover:border-accent hover:text-accent"
                    >
                      {n.label}
                    </button>
                  ))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {canCreate && (
        <form
          action={async (fd) => {
            const res = await createSampleAction(poId, fd);
            if (res.error) setMsg(res.error);
            else router.refresh();
          }}
          className="flex flex-wrap items-end gap-2 border-t border-line p-3"
        >
          <select name="type" required className="select text-xs" aria-label="Sample type">
            {["LAB_DIP", "FIT", "PP", "SIZE_SET"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select name="colourId" className="select text-xs" aria-label="Sample colour">
            <option value="">(no colour)</option>
            {colours.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input name="remarks" placeholder="Remarks" className="input text-xs" />
          <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
            Add sample
          </button>
        </form>
      )}
    </div>
  );
}
