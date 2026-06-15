"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setLineAction } from "@/lib/orders/form-actions";

type Opt = { id: string; name: string };
type SizeScale = { id: string; name: string; sizes: { label: string }[] };
type Row = { qty: string; net: string; sell: string };

export function SizeGridForm({
  poId,
  styles,
  colours,
  sizeScales,
}: {
  poId: string;
  styles: Opt[];
  colours: Opt[];
  sizeScales: SizeScale[];
}) {
  const router = useRouter();
  const [styleId, setStyleId] = useState("");
  const [colourId, setColourId] = useState("");
  const [scaleId, setScaleId] = useState("");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const scale = sizeScales.find((s) => s.id === scaleId);
  const labels = scale?.sizes.map((s) => s.label) ?? [];

  function set(label: string, key: keyof Row, value: string) {
    setRows((r) => {
      const prev = r[label] ?? { qty: "", net: "", sell: "" };
      return { ...r, [label]: { ...prev, [key]: value } };
    });
  }

  const totals = useMemo(() => {
    let qty = 0;
    let value = 0;
    let cost = 0;
    for (const label of labels) {
      const r = rows[label];
      if (!r) continue;
      const q = Number(r.qty) || 0;
      qty += q;
      value += q * (Number(r.sell) || 0);
      cost += q * (Number(r.net) || 0);
    }
    return {
      qty,
      value: Math.round(value * 100) / 100,
      margin: Math.round((value - cost) * 100) / 100,
    };
  }, [rows, labels]);

  async function submit() {
    if (!styleId) return setMsg({ kind: "err", text: "Pick a style" });
    if (!scaleId) return setMsg({ kind: "err", text: "Pick a size scale" });
    const sizes = labels
      .map((label) => {
        const r = rows[label] ?? { qty: "", net: "", sell: "" };
        return {
          label,
          qty: Number(r.qty) || 0,
          netFob: Number(r.net) || 0,
          sellFob: Number(r.sell) || 0,
        };
      })
      .filter((s) => s.qty > 0);
    if (sizes.length === 0) return setMsg({ kind: "err", text: "Enter a quantity for at least one size" });

    setPending(true);
    setMsg(null);
    const res = await setLineAction(poId, {
      styleId,
      colourId: colourId || undefined,
      sizeScaleId: scaleId,
      sizes,
    });
    setPending(false);
    if (res.error) {
      setMsg({ kind: "err", text: res.error });
    } else {
      setMsg({ kind: "ok", text: "Line saved" });
      setRows({});
      setStyleId("");
      setColourId("");
      setScaleId("");
      router.refresh();
    }
  }

  return (
    <div className="rounded-sm border border-line bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        Add / replace a line
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Style *</span>
          <select aria-label="Style" value={styleId} onChange={(e) => setStyleId(e.target.value)} className="select">
            <option value="">Select style…</option>
            {styles.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Colour</span>
          <select aria-label="Colour" value={colourId} onChange={(e) => setColourId(e.target.value)} className="select">
            <option value="">(none)</option>
            {colours.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Size scale *</span>
          <select aria-label="Size scale" value={scaleId} onChange={(e) => setScaleId(e.target.value)} className="select">
            <option value="">Select scale…</option>
            {sizeScales.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>

      {scale && (
        <div className="mt-5 overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-2 py-1 font-semibold">Field</th>
                {labels.map((l) => (
                  <th key={l} className="px-2 py-1 text-center font-semibold">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["qty", "net", "sell"] as const).map((field) => (
                <tr key={field}>
                  <td className="px-2 py-1 text-xs font-medium text-ink-soft">
                    {field === "qty" ? "Qty" : field === "net" ? "Net FOB" : "Sell FOB"}
                  </td>
                  {labels.map((l) => (
                    <td key={l} className="px-1 py-1">
                      <input
                        inputMode="decimal"
                        aria-label={`${field} ${l}`}
                        value={rows[l]?.[field] ?? ""}
                        onChange={(e) => set(l, field, e.target.value)}
                        className="input tnum w-16 px-1.5 py-1 text-right"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save line"}
        </button>
        <span className="text-sm text-ink-soft">
          Line: <span className="tnum">{totals.qty}</span> pcs · value{" "}
          <span className="tnum">{totals.value.toFixed(2)}</span> · margin{" "}
          <span className="tnum">{totals.margin.toFixed(2)}</span>
        </span>
        {msg && (
          <span className={`text-sm ${msg.kind === "ok" ? "text-ok" : "text-bad"}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
