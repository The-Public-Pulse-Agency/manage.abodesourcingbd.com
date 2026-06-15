"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProductionAction } from "@/lib/production/form-actions";

type Production = {
  cutQty: number;
  sewQty: number;
  finishQty: number;
  orderedQty: number;
  progress: { cutPct: number; sewPct: number; finishPct: number };
};

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

export function ProductionPanel({
  poId,
  production,
  canEdit,
}: {
  poId: string;
  production: Production;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [cut, setCut] = useState(String(production.cutQty));
  const [sew, setSew] = useState(String(production.sewQty));
  const [fin, setFin] = useState(String(production.finishQty));
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    const res = await saveProductionAction(poId, {
      cutQty: Number(cut) || 0,
      sewQty: Number(sew) || 0,
      finishQty: Number(fin) || 0,
    });
    if (res.error) setMsg(res.error);
    else router.refresh();
  }

  return (
    <div className="rounded-sm border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Production · {production.orderedQty} pcs ordered
        </h3>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Bar label="Cut" qty={production.cutQty} pct={production.progress.cutPct} />
        <Bar label="Sew" qty={production.sewQty} pct={production.progress.sewPct} />
        <Bar label="Finish" qty={production.finishQty} pct={production.progress.finishPct} />
      </div>
      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <Num label="Cut" value={cut} onChange={setCut} />
          <Num label="Sew" value={sew} onChange={setSew} />
          <Num label="Finish" value={fin} onChange={setFin} />
          <button
            type="button"
            onClick={save}
            className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Save progress
          </button>
        </div>
      )}
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
        className="input tnum w-24 text-right text-sm"
      />
    </label>
  );
}
