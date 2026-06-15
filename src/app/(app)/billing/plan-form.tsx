"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlanAction } from "@/lib/billing/form-actions";

export function PlanForm({
  amountBdt,
  periodDays,
  planName,
  planNotes,
  minMarginPct,
}: {
  amountBdt: number;
  periodDays: number;
  planName: string;
  planNotes: string;
  minMarginPct: number;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await updatePlanAction(fd);
        setIsError(!res.ok);
        setMsg(res.ok ? "Plan updated" : res.error);
        if (res.ok) router.refresh();
      }}
      className="space-y-3 rounded-md border border-line bg-surface p-4 elevate"
    >
      <p className="eyebrow">Plan settings (dynamic)</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Amount (৳)</span>
          <input name="amountBdt" type="number" min="1" defaultValue={amountBdt} className="input tnum w-32" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Period (days)</span>
          <input name="periodDays" type="number" min="1" defaultValue={periodDays} className="input tnum w-28" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Margin floor %</span>
          <input name="minMarginPct" type="number" min="0" defaultValue={minMarginPct} className="input tnum w-28" title="Block costing approval below this margin %" />
        </label>
        <label className="flex flex-1 flex-col gap-1" style={{ minWidth: 200 }}>
          <span className="eyebrow">Plan name</span>
          <input name="planName" defaultValue={planName} className="input w-full" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">SLA / notes</span>
        <input name="planNotes" defaultValue={planNotes} className="input w-full" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
          Save plan
        </button>
        {msg && <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>{msg}</span>}
      </div>
    </form>
  );
}
