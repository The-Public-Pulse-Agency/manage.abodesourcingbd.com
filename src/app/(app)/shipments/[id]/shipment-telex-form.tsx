"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShipmentAction } from "@/lib/shipment/form-actions";

export function ShipmentTelexForm({
  shipmentId,
  current,
}: {
  shipmentId: string;
  current: { containerNo: string; cartons: string; blNumber: string; blDate: string; telexStatus: string };
}) {
  const router = useRouter();
  const [f, setF] = useState(current);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    setPending(true);
    setMsg(null);
    const res = await updateShipmentAction(shipmentId, {
      containerNo: f.containerNo || undefined,
      cartons: f.cartons ? Number(f.cartons) : undefined,
      blNumber: f.blNumber || undefined,
      blDate: f.blDate || undefined,
      telexStatus: f.telexStatus as "PENDING" | "RECEIVED" | "RELEASED",
    });
    setPending(false);
    if (res.error) setMsg(res.error);
    else router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-sm border border-line bg-surface p-5">
      <F label="Container"><input value={f.containerNo} onChange={(e) => set("containerNo", e.target.value)} className="input" /></F>
      <F label="Cartons"><input inputMode="numeric" value={f.cartons} onChange={(e) => set("cartons", e.target.value)} className="input tnum w-20 text-right" /></F>
      <F label="BL number"><input value={f.blNumber} onChange={(e) => set("blNumber", e.target.value)} className="input" /></F>
      <F label="BL date"><input type="date" value={f.blDate} onChange={(e) => set("blDate", e.target.value)} className="input" /></F>
      <F label="Telex">
        <select value={f.telexStatus} onChange={(e) => set("telexStatus", e.target.value)} className="select">
          <option value="PENDING">PENDING</option>
          <option value="RECEIVED">RECEIVED</option>
          <option value="RELEASED">RELEASED</option>
        </select>
      </F>
      <button type="button" onClick={save} disabled={pending} className="rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
      {msg && <span className="self-center text-sm text-bad">{msg}</span>}
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
