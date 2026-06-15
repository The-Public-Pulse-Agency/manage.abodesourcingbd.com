"use client";

import { useState } from "react";
import { createShipmentAction } from "@/lib/shipment/form-actions";

type Line = { orderLineId: string; styleCode: string; colour: string | null; sizes: { label: string; balance: number }[] };
type Opt = { id: string; name: string };

export function NewShipmentForm({
  poNumber,
  lines,
  forwarders,
  ports,
}: {
  poNumber: string;
  lines: Line[];
  forwarders: Opt[];
  ports: Opt[];
}) {
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [h, setH] = useState({
    reference: "", mode: "SEA", containerNo: "", cartons: "", exFactoryDate: "",
    blNumber: "", blDate: "", telexStatus: "PENDING", forwarderId: "", portId: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof h, v: string) => setH((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!h.reference.trim()) return setMsg("Reference is required");
    const built = lines
      .map((l) => ({
        orderLineId: l.orderLineId,
        sizes: l.sizes
          .map((s) => ({ label: s.label, qty: Number(qtys[`${l.orderLineId}:${s.label}`]) || 0 }))
          .filter((s) => s.qty > 0),
      }))
      .filter((l) => l.sizes.length > 0);
    if (built.length === 0) return setMsg("Enter a quantity for at least one size");
    setPending(true);
    setMsg(null);
    const res = await createShipmentAction({
      reference: h.reference.trim(),
      mode: h.mode as "SEA" | "AIR",
      containerNo: h.containerNo || undefined,
      cartons: h.cartons ? Number(h.cartons) : undefined,
      exFactoryDate: h.exFactoryDate || undefined,
      blNumber: h.blNumber || undefined,
      blDate: h.blDate || undefined,
      telexStatus: h.telexStatus as "PENDING" | "RECEIVED" | "RELEASED",
      forwarderId: h.forwarderId || undefined,
      portId: h.portId || undefined,
      lines: built,
    });
    setPending(false);
    if (res?.error) setMsg(res.error);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-sm border border-line bg-surface p-5 sm:grid-cols-3">
        <Field label="Reference *"><input value={h.reference} onChange={(e) => set("reference", e.target.value)} className="input w-full" placeholder="e.g. SHP-2026-001" /></Field>
        <Field label="Mode">
          <select value={h.mode} onChange={(e) => set("mode", e.target.value)} className="select w-full">
            <option value="SEA">SEA</option><option value="AIR">AIR</option>
          </select>
        </Field>
        <Field label="Container"><input value={h.containerNo} onChange={(e) => set("containerNo", e.target.value)} className="input w-full" /></Field>
        <Field label="Cartons"><input inputMode="numeric" value={h.cartons} onChange={(e) => set("cartons", e.target.value)} className="input w-full tnum" /></Field>
        <Field label="Ex-factory"><input type="date" value={h.exFactoryDate} onChange={(e) => set("exFactoryDate", e.target.value)} className="input w-full" /></Field>
        <Field label="Telex">
          <select value={h.telexStatus} onChange={(e) => set("telexStatus", e.target.value)} className="select w-full">
            <option value="PENDING">PENDING</option><option value="RECEIVED">RECEIVED</option><option value="RELEASED">RELEASED</option>
          </select>
        </Field>
        <Field label="BL number"><input value={h.blNumber} onChange={(e) => set("blNumber", e.target.value)} className="input w-full" /></Field>
        <Field label="BL date"><input type="date" value={h.blDate} onChange={(e) => set("blDate", e.target.value)} className="input w-full" /></Field>
        <Field label="Forwarder">
          <select value={h.forwarderId} onChange={(e) => set("forwarderId", e.target.value)} className="select w-full">
            <option value="">—</option>{forwarders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
        <Field label="Port">
          <select value={h.portId} onChange={(e) => set("portId", e.target.value)} className="select w-full">
            <option value="">—</option>{ports.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="space-y-3 rounded-sm border border-line bg-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Lines to ship · {poNumber}</h3>
        {lines.length === 0 && <p className="text-sm text-ink-soft">Nothing left to ship on this order.</p>}
        {lines.map((l) => (
          <div key={l.orderLineId} className="rounded-sm border border-line p-3">
            <div className="mb-2 text-sm font-medium">
              <span className="font-mono">{l.styleCode}</span> {l.colour ? `· ${l.colour}` : ""}
            </div>
            <div className="flex flex-wrap gap-3">
              {l.sizes.map((s) => (
                <label key={s.label} className="flex flex-col gap-1">
                  <span className="eyebrow">{s.label} <span className="text-ink-soft">(bal {s.balance})</span></span>
                  <input
                    inputMode="numeric"
                    aria-label={`${l.styleCode} ${s.label}`}
                    value={qtys[`${l.orderLineId}:${s.label}`] ?? ""}
                    onChange={(e) => setQtys((q) => ({ ...q, [`${l.orderLineId}:${s.label}`]: e.target.value }))}
                    className="input tnum w-20 text-right"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" disabled={pending || lines.length === 0} onClick={submit} className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {pending ? "Creating…" : "Create shipment"}
        </button>
        {msg && <span className="text-sm text-bad">{msg}</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
