"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShipmentAction } from "@/lib/shipment/form-actions";
import { setInvoicePaymentStatus } from "@/lib/reports/inline-actions";

type Opt = { id: string; name: string };
export type ShipmentFormValues = {
  containerNo: string; cartons: string; mode: string; exFactoryDate: string;
  blNumber: string; blDate: string; etaDestination: string; telexStatus: string;
  tcStatus: string; forwarderId: string; portId: string; remarks: string;
  invoiceId: string | null; paymentStatus: string;
};

export function ShipmentTelexForm({ shipmentId, current, forwarders, ports }: { shipmentId: string; current: ShipmentFormValues; forwarders: Opt[]; ports: Opt[] }) {
  const router = useRouter();
  const [f, setF] = useState(current);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (k: keyof ShipmentFormValues, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    setPending(true);
    setMsg(null);
    const res = await updateShipmentAction(shipmentId, {
      containerNo: f.containerNo || undefined,
      cartons: f.cartons ? Number(f.cartons) : undefined,
      mode: f.mode as "SEA" | "AIR",
      exFactoryDate: f.exFactoryDate || null,
      blNumber: f.blNumber || undefined,
      blDate: f.blDate || null,
      etaDestination: f.etaDestination || null,
      telexStatus: f.telexStatus as "PENDING" | "RECEIVED" | "RELEASED",
      tcStatus: f.tcStatus || undefined,
      forwarderId: f.forwarderId || null,
      portId: f.portId || null,
      remarks: f.remarks || undefined,
    });
    if (res.error) { setPending(false); setMsg(res.error); return; }
    if (f.invoiceId && f.paymentStatus !== current.paymentStatus) {
      const pr = await setInvoicePaymentStatus(f.invoiceId, f.paymentStatus);
      if (pr.error) { setPending(false); setMsg(pr.error); return; }
    }
    setPending(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-5 elevate">
      <div className="flex flex-wrap items-end gap-3">
        <F label="Container"><input value={f.containerNo} onChange={(e) => set("containerNo", e.target.value)} className="input" /></F>
        <F label="Cartons"><input inputMode="numeric" value={f.cartons} onChange={(e) => set("cartons", e.target.value)} className="input tnum w-20 text-right" /></F>
        <F label="Mode">
          <select value={f.mode} onChange={(e) => set("mode", e.target.value)} className="select"><option value="SEA">SEA</option><option value="AIR">AIR</option></select>
        </F>
        <F label="Ex-factory"><input type="date" value={f.exFactoryDate} onChange={(e) => set("exFactoryDate", e.target.value)} className="input" /></F>
        <F label="BL number"><input value={f.blNumber} onChange={(e) => set("blNumber", e.target.value)} className="input" /></F>
        <F label="BL date"><input type="date" value={f.blDate} onChange={(e) => set("blDate", e.target.value)} className="input" /></F>
        <F label="ETA destination"><input type="date" value={f.etaDestination} onChange={(e) => set("etaDestination", e.target.value)} className="input" /></F>
        <F label="Telex">
          <select value={f.telexStatus} onChange={(e) => set("telexStatus", e.target.value)} className="select">
            <option value="PENDING">PENDING</option><option value="RECEIVED">RECEIVED</option><option value="RELEASED">RELEASED</option>
          </select>
        </F>
        <F label="Forwarder">
          <select value={f.forwarderId} onChange={(e) => set("forwarderId", e.target.value)} className="select"><option value="">—</option>{forwarders.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        </F>
        <F label="Port">
          <select value={f.portId} onChange={(e) => set("portId", e.target.value)} className="select"><option value="">—</option>{ports.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        </F>
        <F label="Payment status">
          {f.invoiceId ? (
            <select value={f.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)} className="select">
              <option value="ISSUED">Due</option><option value="PARTIALLY_PAID">Partial</option><option value="PAID">Paid</option>
            </select>
          ) : <span className="text-xs text-ink-soft">No invoice</span>}
        </F>
        <F label="TC status"><input value={f.tcStatus} onChange={(e) => set("tcStatus", e.target.value)} placeholder="Working / NO TC / Send…" className="input" /></F>
        <F label="Remarks"><input value={f.remarks} onChange={(e) => set("remarks", e.target.value)} className="input min-w-[12rem]" /></F>
        <button type="button" onClick={save} disabled={pending} className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        {msg && <span className="self-center text-sm text-bad">{msg}</span>}
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
