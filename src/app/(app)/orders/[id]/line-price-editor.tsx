"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { updateLinePricesAction } from "@/lib/orders/form-actions";

type Size = { id: string; label: string; qty: number; netFob: number; sellFob: number };

/** Inline price correction for one order line — net/sell FOB per size, usable after confirm. */
export function LinePriceEditor({ poId, lineId, sizes }: { poId: string; lineId: string; sizes: Size[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => sizes.map((s) => ({ id: s.id, label: s.label, qty: s.qty, net: String(s.netFob), sell: String(s.sellFob) })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await updateLinePricesAction(
      poId,
      lineId,
      rows.map((r) => ({ sizeId: r.id, netFob: Number(r.net) || 0, sellFob: Number(r.sell) || 0 })),
    );
    setBusy(false);
    if (res.error) setMsg(res.error);
    else {
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 text-xs text-accent hover:underline">
        Edit prices
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-sm border border-line bg-paper p-2">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-semibold text-ink-soft">Size</span>
        <span className="text-right font-semibold text-ink-soft">Net FOB</span>
        <span className="text-right font-semibold text-ink-soft">Sell FOB</span>
        {rows.map((r, i) => (
          <Fragment key={r.id}>
            <span className="tnum">{r.label} · {r.qty}</span>
            <input
              inputMode="decimal"
              aria-label={`Net FOB ${r.label}`}
              value={r.net}
              onChange={(e) => setRows((s) => s.map((x, j) => (j === i ? { ...x, net: e.target.value } : x)))}
              className="input tnum w-20 text-right text-xs"
            />
            <input
              inputMode="decimal"
              aria-label={`Sell FOB ${r.label}`}
              value={r.sell}
              onChange={(e) => setRows((s) => s.map((x, j) => (j === i ? { ...x, sell: e.target.value } : x)))}
              className="input tnum w-20 text-right text-xs"
            />
          </Fragment>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={busy} className="rounded-sm bg-ink px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save prices"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-soft hover:text-accent">Cancel</button>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>
    </div>
  );
}
