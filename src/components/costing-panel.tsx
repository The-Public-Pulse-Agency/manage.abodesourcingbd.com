"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addCostItemAction, removeCostItemAction } from "@/lib/orders/cost-item-form-actions";
import { ConfirmButton } from "@/components/confirm-button";

export type CostItemRow = { id: string; category: string; label: string; amountPerUnit: number; note: string | null };

const CATEGORIES = ["FABRIC", "CM", "TRIMS", "TEST", "FREIGHT", "COMMISSION", "OTHER"];

export function CostingPanel({
  poId,
  items,
  netPerUnit,
  sellPerUnit,
  marginPct,
  minMarginPct,
  canEdit,
}: {
  poId: string;
  items: CostItemRow[];
  netPerUnit: number;
  sellPerUnit: number;
  marginPct: number | null;
  minMarginPct: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  const buildUp = items.reduce((a, i) => a + i.amountPerUnit, 0);
  const belowFloor = minMarginPct > 0 && marginPct !== null && marginPct < minMarginPct;

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface elevate">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Costing build-up</h3>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-3 py-1.5 font-semibold">Category</th>
            <th className="px-3 py-1.5 font-semibold">Item</th>
            <th className="px-3 py-1.5 text-right font-semibold">Per unit</th>
            {canEdit && <th className="px-3 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={canEdit ? 4 : 3} className="px-3 py-4 text-center text-ink-soft">No cost items yet.</td></tr>
          )}
          {items.map((i) => (
            <tr key={i.id} className="border-b border-line last:border-0">
              <td className="px-3 py-1.5"><span className="rounded-sm bg-paper px-1.5 py-0.5 font-mono text-[0.6875rem] uppercase">{i.category}</span></td>
              <td className="px-3 py-1.5">{i.label}{i.note ? <span className="ml-1 text-xs text-ink-soft">· {i.note}</span> : null}</td>
              <td className="px-3 py-1.5 text-right tnum">{i.amountPerUnit.toFixed(4)}</td>
              {canEdit && (
                <td className="px-3 py-1.5 text-right">
                  <ConfirmButton onConfirm={async () => { const r = await removeCostItemAction(i.id); if (r.error) setMsg(r.error); else router.refresh(); }} className="text-xs text-ink-soft hover:text-bad">Remove</ConfirmButton>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line bg-paper text-xs">
            <td className="px-3 py-2 font-semibold uppercase text-ink-soft" colSpan={2}>Build-up cost / unit</td>
            <td className="px-3 py-2 text-right tnum font-semibold">{buildUp.toFixed(4)}</td>
            {canEdit && <td />}
          </tr>
        </tfoot>
      </table>

      <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
        <Cell label="Booked NET / unit" value={netPerUnit.toFixed(4)} />
        <Cell label="Sell FOB / unit" value={sellPerUnit.toFixed(4)} />
        <Cell label="Margin %" value={marginPct === null ? "—" : `${marginPct}%`} tone={belowFloor ? "bad" : "ok"} />
        <Cell label="Margin floor" value={minMarginPct > 0 ? `${minMarginPct}%` : "—"} hint={minMarginPct > 0 ? (belowFloor ? "below floor — approval blocked" : "meets floor") : "no floor set"} />
      </div>

      {canEdit && (
        <form
          action={async (fd) => { const r = await addCostItemAction(poId, fd); if (r.error) setMsg(r.error); else { setMsg(null); router.refresh(); } }}
          className="flex flex-wrap items-end gap-2 border-t border-line p-3"
        >
          <select name="category" aria-label="Cost category" className="select text-xs">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <input name="label" placeholder="e.g. Yarn 30s" required className="input text-xs" aria-label="Cost item label" />
          <input name="amountPerUnit" inputMode="decimal" placeholder="Per unit" required className="input tnum w-24 text-right text-xs" aria-label="Amount per unit" />
          <input name="note" placeholder="Note (optional)" className="input text-xs" aria-label="Note" />
          <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Add cost</button>
        </form>
      )}
    </div>
  );
}

function Cell({ label, value, tone, hint }: { label: string; value: string; tone?: "ok" | "bad"; hint?: string }) {
  return (
    <div className="bg-surface p-3">
      <p className="eyebrow">{label}</p>
      <p className={`tnum mt-0.5 text-sm font-semibold ${tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[0.625rem] text-ink-soft">{hint}</p>}
    </div>
  );
}
