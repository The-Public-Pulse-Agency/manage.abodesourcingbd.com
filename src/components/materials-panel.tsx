"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMaterialAction,
  receiveMaterialAction,
  removeMaterialAction,
  setMaterialDescription,
  setMaterialSupplier,
  setMaterialBookedQty,
  setMaterialUnit,
  setMaterialBookingRef,
  setMaterialEta,
} from "@/lib/materials/form-actions";
import { ConfirmButton } from "@/components/confirm-button";
import { EditableCell } from "@/components/reports/editable-cell";

export type MaterialRow = {
  id: string;
  kind: string;
  description: string;
  supplier: string | null;
  bookedQty: number | null;
  unit: string | null;
  bookingRef: string | null;
  etaDate: string | null;
  etaDateRaw: string; // ISO yyyy-mm-dd for the date editor ("" when unset)
  receivedQty: number | null;
  receivedDate: string | null;
  status: string;
};

const KINDS = ["FABRIC", "TRIM", "ACCESSORY"];
const STATUS_CLS: Record<string, string> = {
  BOOKED: "bg-warn-soft text-warn",
  PARTIAL: "bg-warn-soft text-warn",
  IN_HOUSE: "bg-ok-soft text-ok",
};

export function MaterialsPanel({ poId, materials, canEdit }: { poId: string; materials: MaterialRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface elevate">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Materials / BOM</h3>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-3 py-1.5 font-semibold">Kind</th>
            <th className="px-3 py-1.5 font-semibold">Material</th>
            <th className="px-3 py-1.5 font-semibold">Supplier</th>
            <th className="px-3 py-1.5 text-right font-semibold">Booked</th>
            <th className="px-3 py-1.5 font-semibold">ETA</th>
            <th className="px-3 py-1.5 font-semibold">Status</th>
            {canEdit && <th className="px-3 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {materials.length === 0 && (
            <tr><td colSpan={canEdit ? 7 : 6} className="px-3 py-4 text-center text-ink-soft">No materials booked yet.</td></tr>
          )}
          {materials.map((m) => (
            <tr key={m.id} className="border-b border-line last:border-0 align-top">
              <td className="px-3 py-1.5"><span className="rounded-sm bg-paper px-1.5 py-0.5 font-mono text-[0.6875rem] uppercase">{m.kind}</span></td>
              <td className="px-3 py-1.5">
                {canEdit ? (
                  <div className="space-y-0.5">
                    <EditableCell id={m.id} raw={m.description} type="text" action={setMaterialDescription}>{m.description}</EditableCell>
                    <EditableCell id={m.id} raw={m.bookingRef ?? ""} type="text" placeholder="ref" action={setMaterialBookingRef}>
                      <span className="text-xs text-ink-soft">{m.bookingRef ? `· ${m.bookingRef}` : ""}</span>
                    </EditableCell>
                  </div>
                ) : (
                  <>{m.description}{m.bookingRef ? <span className="ml-1 text-xs text-ink-soft">· {m.bookingRef}</span> : null}</>
                )}
              </td>
              <td className="px-3 py-1.5">
                {canEdit ? (
                  <EditableCell id={m.id} raw={m.supplier ?? ""} type="text" action={setMaterialSupplier}>{m.supplier ?? "—"}</EditableCell>
                ) : (m.supplier ?? "—")}
              </td>
              <td className="px-3 py-1.5 text-right tnum">
                {canEdit ? (
                  <div className="flex items-center justify-end gap-1">
                    <span className="w-20"><EditableCell id={m.id} raw={m.bookedQty != null ? String(m.bookedQty) : ""} type="number" align="right" action={setMaterialBookedQty}>{m.bookedQty != null ? m.bookedQty : "—"}</EditableCell></span>
                    <span className="w-12"><EditableCell id={m.id} raw={m.unit ?? ""} type="text" placeholder="unit" action={setMaterialUnit}>{m.unit ?? ""}</EditableCell></span>
                  </div>
                ) : (m.bookedQty != null ? `${m.bookedQty}${m.unit ? ` ${m.unit}` : ""}` : "—")}
              </td>
              <td className="px-3 py-1.5 tnum text-xs">
                {canEdit ? (
                  <EditableCell id={m.id} raw={m.etaDateRaw} type="date" action={setMaterialEta}>{m.etaDate ?? "—"}</EditableCell>
                ) : (m.etaDate ?? "—")}
              </td>
              <td className="px-3 py-1.5">
                <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${STATUS_CLS[m.status] ?? ""}`}>
                  {m.status.replace(/_/g, " ")}
                </span>
                {m.receivedDate && <div className="mt-0.5 text-[0.625rem] text-ink-soft">in {m.receivedQty} on {m.receivedDate}</div>}
                {canEdit && m.status !== "IN_HOUSE" && (
                  <form
                    action={async (fd) => { const r = await receiveMaterialAction(m.id, fd); if (r.error) setMsg(r.error); else { setReceiving(null); router.refresh(); } }}
                    className={`mt-2 flex items-end gap-2 ${receiving === m.id ? "" : "hidden"}`}
                  >
                    <input name="receivedQty" inputMode="decimal" placeholder="Qty in" defaultValue={m.bookedQty ?? ""} className="input tnum w-20 text-right text-xs" aria-label="Received qty" />
                    <input name="receivedDate" type="date" className="input text-xs" aria-label="Received date" />
                    <button type="submit" className="rounded-sm bg-ink px-2 py-1 text-xs font-medium text-white">Save</button>
                  </form>
                )}
              </td>
              {canEdit && (
                <td className="px-3 py-1.5 text-right">
                  {m.status !== "IN_HOUSE" && (
                    <button type="button" onClick={() => setReceiving(receiving === m.id ? null : m.id)} className="mr-2 text-xs text-accent hover:underline">
                      {receiving === m.id ? "Cancel" : "Receive"}
                    </button>
                  )}
                  <ConfirmButton onConfirm={async () => { const r = await removeMaterialAction(m.id); if (r.error) setMsg(r.error); else router.refresh(); }} className="text-xs text-ink-soft hover:text-bad">Remove</ConfirmButton>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <form
          action={async (fd) => { const r = await addMaterialAction(poId, fd); if (r.error) setMsg(r.error); else { setMsg(null); router.refresh(); } }}
          className="flex flex-wrap items-end gap-2 border-t border-line p-3"
        >
          <select name="kind" aria-label="Material kind" className="select text-xs">{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
          <input name="description" placeholder="Material (e.g. 30s combed cotton)" required className="input text-xs" aria-label="Material description" />
          <input name="supplier" placeholder="Supplier" className="input text-xs" aria-label="Supplier" />
          <input name="bookedQty" inputMode="decimal" placeholder="Qty" className="input tnum w-20 text-right text-xs" aria-label="Booked qty" />
          <input name="unit" placeholder="Unit" className="input w-16 text-xs" aria-label="Unit" />
          <input name="bookingRef" placeholder="Ref" className="input w-20 text-xs" aria-label="Booking ref" />
          <input name="etaDate" type="date" className="input text-xs" aria-label="ETA date" />
          <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Book material</button>
        </form>
      )}
    </div>
  );
}
