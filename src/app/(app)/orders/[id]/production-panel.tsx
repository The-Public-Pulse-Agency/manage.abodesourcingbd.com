"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProductionAction } from "@/lib/production/form-actions";

type Pct = { cutPct: number; sewPct: number; finishPct: number };
type Line = {
  orderLineId: string;
  style: string;
  colour: string;
  orderedQty: number;
  cutQty: number;
  sewQty: number;
  finishQty: number;
  shadeApproval: string;
  ppSampleStatus: string;
  fabricWashTest: string;
  garmentsWashTest: string;
  topSampleStatus: string;
  progress: Pct;
};

const REMARK_LABELS = [
  ["shadeApproval", "Bulk fabric shade approval"],
  ["ppSampleStatus", "PP sample status"],
  ["fabricWashTest", "Fabric wash test status"],
  ["garmentsWashTest", "Garments wash test status"],
  ["topSampleStatus", "Top / shipment samples status"],
] as const;
type Production = {
  orderedQty: number;
  cutQty: number;
  sewQty: number;
  finishQty: number;
  progress: Pct;
  lines: Line[];
};

type StyleGroup = { style: string; orderedQty: number; cutQty: number; sewQty: number; finishQty: number; lines: Line[] };

/** Group the per-colour lines by style, summing cut/sew/finish across colours. */
function groupByStyle(lines: Line[]): StyleGroup[] {
  const map = new Map<string, StyleGroup>();
  for (const l of lines) {
    let g = map.get(l.style);
    if (!g) { g = { style: l.style, orderedQty: 0, cutQty: 0, sewQty: 0, finishQty: 0, lines: [] }; map.set(l.style, g); }
    g.orderedQty += l.orderedQty;
    g.cutQty += l.cutQty;
    g.sewQty += l.sewQty;
    g.finishQty += l.finishQty;
    g.lines.push(l);
  }
  return [...map.values()];
}

const pctOf = (q: number, o: number) => (o > 0 ? Math.round((q / o) * 100) : 0);

function Bar({ label, qty, pct }: { label: string; qty: number; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-ink-soft">{label}</span>
        <span className="tnum">{qty} · {pct}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-line">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <input
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input tnum w-20 text-right text-sm"
      />
    </label>
  );
}

function LineRow({ poId, line, canEdit }: { poId: string; line: Line; canEdit: boolean }) {
  const router = useRouter();
  const [cut, setCut] = useState(String(line.cutQty));
  const [sew, setSew] = useState(String(line.sewQty));
  const [fin, setFin] = useState(String(line.finishQty));
  const [remarks, setRemarks] = useState({
    shadeApproval: line.shadeApproval,
    ppSampleStatus: line.ppSampleStatus,
    fabricWashTest: line.fabricWashTest,
    garmentsWashTest: line.garmentsWashTest,
    topSampleStatus: line.topSampleStatus,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setMsg(null);
    setBusy(true);
    const res = await saveProductionAction(poId, line.orderLineId, {
      cutQty: Number(cut) || 0,
      sewQty: Number(sew) || 0,
      finishQty: Number(fin) || 0,
      ...remarks,
    });
    setBusy(false);
    if (res.error) setMsg(res.error);
    else router.refresh();
  }

  return (
    <div className="rounded-sm border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {line.style}
          {line.colour !== "—" ? <span className="text-ink-soft"> · {line.colour}</span> : null}
          <span className="ml-2 text-xs text-ink-soft">{line.orderedQty} pcs ordered</span>
        </div>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>
      {/* Status remarks — shown above the cut/sew/finish bars. */}
      {canEdit ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {REMARK_LABELS.map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="eyebrow">{label}</span>
              <input
                aria-label={label}
                value={remarks[key]}
                onChange={(e) => setRemarks((r) => ({ ...r, [key]: e.target.value }))}
                placeholder="—"
                className="input text-sm"
              />
            </label>
          ))}
        </div>
      ) : (
        REMARK_LABELS.some(([key]) => line[key]) && (
          <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {REMARK_LABELS.filter(([key]) => line[key]).map(([key, label]) => (
              <div key={key} className="flex flex-col">
                <dt className="eyebrow">{label}</dt>
                <dd className="text-sm">{line[key]}</dd>
              </div>
            ))}
          </dl>
        )
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Bar label="Cut" qty={line.cutQty} pct={line.progress.cutPct} />
        <Bar label="Sew" qty={line.sewQty} pct={line.progress.sewPct} />
        <Bar label="Finish" qty={line.finishQty} pct={line.progress.finishPct} />
      </div>
      {canEdit && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Num label="Cut" value={cut} onChange={setCut} />
          <Num label="Sew" value={sew} onChange={setSew} />
          <Num label="Finish" value={fin} onChange={setFin} />
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ProductionPanel({
  poId,
  production,
  canEdit,
}: {
  poId: string;
  production: Production;
  canEdit: boolean;
}) {
  const groups = groupByStyle(production.lines);
  return (
    <div className="rounded-sm border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Production · {production.orderedQty} pcs ordered <span className="text-ink-soft/70">· all styles</span>
        </h3>
      </div>
      {/* PO-wide total across every style & colour */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Bar label="Cut" qty={production.cutQty} pct={production.progress.cutPct} />
        <Bar label="Sew" qty={production.sewQty} pct={production.progress.sewPct} />
        <Bar label="Finish" qty={production.finishQty} pct={production.progress.finishPct} />
      </div>
      {/* Grouped by style: a per-style subtotal (all its colours) then each colour line. */}
      {production.lines.length > 0 ? (
        <>
        <div className="mt-4 space-y-6 border-t border-line pt-3">
          {groups.map((g) => (
            <div key={g.style} className="space-y-3">
              {/* Per-style summary (sum of all colours of this style) */}
              <div className="rounded-sm border border-line bg-paper p-3">
                <p className="text-sm font-semibold">
                  {g.style}
                  <span className="ml-1.5 text-xs font-normal text-ink-soft">· {g.orderedQty} pcs · {g.lines.length} colour{g.lines.length === 1 ? "" : "s"}</span>
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <Bar label="Cut" qty={g.cutQty} pct={pctOf(g.cutQty, g.orderedQty)} />
                  <Bar label="Sew" qty={g.sewQty} pct={pctOf(g.sewQty, g.orderedQty)} />
                  <Bar label="Finish" qty={g.finishQty} pct={pctOf(g.finishQty, g.orderedQty)} />
                </div>
              </div>
              {/* Each colour under this style */}
              {g.lines.map((l) => (
                <LineRow key={l.orderLineId} poId={poId} line={l} canEdit={canEdit} />
              ))}
            </div>
          ))}
        </div>
        {/* Style-wise breakdown (one row per style) */}
        {groups.length > 1 && (
          <div className="mt-6 overflow-x-auto rounded-sm border border-line bg-paper p-3">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">By style</p>
            <table className="w-full whitespace-nowrap text-xs">
              <thead>
                <tr className="border-b border-line text-left text-ink-soft">
                  <th className="px-2 py-1.5 font-semibold">Style</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Ordered</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Cut</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Sew</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Finish</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.style} className="border-b border-line last:border-0">
                    <td className="px-2 py-1.5 font-medium">{g.style}</td>
                    <td className="px-2 py-1.5 text-right tnum">{g.orderedQty}</td>
                    <td className="px-2 py-1.5 text-right tnum">{g.cutQty} · {pctOf(g.cutQty, g.orderedQty)}%</td>
                    <td className="px-2 py-1.5 text-right tnum">{g.sewQty} · {pctOf(g.sewQty, g.orderedQty)}%</td>
                    <td className="px-2 py-1.5 text-right tnum">{g.finishQty} · {pctOf(g.finishQty, g.orderedQty)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink font-semibold">
                  <td className="px-2 py-1.5">All styles</td>
                  <td className="px-2 py-1.5 text-right tnum">{production.orderedQty}</td>
                  <td className="px-2 py-1.5 text-right tnum">{production.cutQty} · {production.progress.cutPct}%</td>
                  <td className="px-2 py-1.5 text-right tnum">{production.sewQty} · {production.progress.sewPct}%</td>
                  <td className="px-2 py-1.5 text-right tnum">{production.finishQty} · {production.progress.finishPct}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {/* Grand total across ALL styles (bottom summary) */}
        <div className="mt-6 rounded-sm border-2 border-ink/20 bg-paper p-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            All styles — PO total <span className="font-normal normal-case">· {production.orderedQty} pcs</span>
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Bar label="Cut" qty={production.cutQty} pct={production.progress.cutPct} />
            <Bar label="Sew" qty={production.sewQty} pct={production.progress.sewPct} />
            <Bar label="Finish" qty={production.finishQty} pct={production.progress.finishPct} />
          </div>
        </div>
        </>
      ) : (
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-soft">No order lines yet.</p>
      )}
    </div>
  );
}
