"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { editLineAction } from "@/lib/orders/form-actions";

type SizeRow = { label: string; qty: number; netFob: number; sellFob: number };
type Opt = { value: string; label: string };

/** Inline structure editor for one order line — change style, colour & per-size qty (price has its own editor). */
export function LineEditor({ poId, lineId, styleId, colourId, sizes, styles, colours }: {
  poId: string; lineId: string; styleId: string; colourId: string;
  sizes: SizeRow[]; styles: Opt[]; colours: Opt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState(styleId);
  const [colour, setColour] = useState(colourId);
  const [rows, setRows] = useState(() => sizes.map((s) => ({ label: s.label, qty: String(s.qty), netFob: s.netFob, sellFob: s.sellFob })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    const sizesPayload = rows.map((r) => ({ label: r.label, qty: Number(r.qty) || 0, netFob: r.netFob, sellFob: r.sellFob }));
    if (sizesPayload.length === 0) {
      setMsg("A line needs at least one size.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await editLineAction(poId, lineId, {
      styleId: style,
      colourId: colour || undefined,
      sizes: sizesPayload,
    });
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
        Edit line
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-sm border border-line bg-paper p-2">
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-semibold text-ink-soft">Style</span>
        <select
          aria-label="Style"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="input text-xs"
        >
          {styles.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="font-semibold text-ink-soft">Colour</span>
        <select
          aria-label="Colour"
          value={colour}
          onChange={(e) => setColour(e.target.value)}
          className="input text-xs"
        >
          {[{ value: "", label: "— none —" }, ...colours].map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-semibold text-ink-soft">Size</span>
        <span className="text-right font-semibold text-ink-soft">Qty</span>
        {rows.map((r, i) => (
          <Fragment key={r.label}>
            <span className="tnum">{r.label}</span>
            <input
              inputMode="numeric"
              aria-label={`Qty ${r.label}`}
              value={r.qty}
              onChange={(e) => setRows((s) => s.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
              className="input tnum w-16 text-right text-xs"
            />
          </Fragment>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={busy} className="rounded-sm bg-ink px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save line"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-soft hover:text-accent">Cancel</button>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>
    </div>
  );
}
