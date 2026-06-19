"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditableCell } from "./editable-cell";
import { RowDeleteButton } from "./row-delete-button";
import {
  createBuyerSampleAction, deleteBuyerSampleAction,
  setBuyerSampleBuyerName, setBuyerSampleSampleType, setBuyerSampleArtNo, setBuyerSampleStyleName, setBuyerSampleFactoryName,
  setBuyerSampleCourierName, setBuyerSampleAwb, setBuyerSampleSendDate, setBuyerSampleNumSamples, setBuyerSampleApproxArrival, setBuyerSampleNotes,
} from "@/lib/buyer-samples/form-actions";

export type BuyerSampleRow = {
  id: string; buyerName: string; sampleType: string; artNo: string; styleName: string; factoryName: string;
  courierName: string; awbNumber: string;
  sendDateRaw: string; sendDateDisplay: string; numSamples: string;
  approxArrivalRaw: string; approxArrivalDisplay: string; notes: string;
};

export function BuyerSampleTable({ rows, canEdit }: { rows: BuyerSampleRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const txt = (v: string) => (v ? v : "—");

  return (
    <div className="space-y-3">
      {canEdit && (
        <form
          action={async (fd) => { setBusy(true); const r = await createBuyerSampleAction(fd); setBusy(false); if (r.error) setErr(r.error); else { setErr(null); router.refresh(); (document.getElementById("buyer-sample-add") as HTMLFormElement)?.reset(); } }}
          id="buyer-sample-add"
          className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3 elevate"
        >
          <input name="buyerName" placeholder="Buyer" className="input text-sm" aria-label="Buyer" />
          <input name="sampleType" placeholder="Sample type" className="input text-sm" aria-label="Sample type" />
          <input name="artNo" required placeholder="Art no" className="input text-sm" aria-label="Art no" />
          <input name="styleName" placeholder="Style" className="input text-sm" aria-label="Style" />
          <input name="factoryName" placeholder="Factory" className="input text-sm" aria-label="Factory" />
          <input name="courierName" placeholder="Courier" className="input text-sm" aria-label="Courier" />
          <input name="awbNumber" placeholder="AWB" className="input text-sm" aria-label="AWB" />
          <input name="sendDate" type="date" className="input text-sm" aria-label="Send date" />
          <input name="numSamples" type="number" placeholder="#Samples" className="input text-sm" aria-label="Number of samples" />
          <input name="approxArrival" type="date" className="input text-sm" aria-label="Approx arrival" />
          <input name="notes" placeholder="Notes" className="input text-sm" aria-label="Notes" />
          <button type="submit" disabled={busy} className="rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">{busy ? "Adding…" : "+ Add sample"}</button>
          {err && <span className="text-xs text-bad">{err}</span>}
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
        <table className="list-table w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5 font-semibold">Buyer</th><th className="px-3 py-2.5 font-semibold">Sample Type</th><th className="px-3 py-2.5 font-semibold">Art No</th>
              <th className="px-3 py-2.5 font-semibold">Style</th><th className="px-3 py-2.5 font-semibold">Factory</th><th className="px-3 py-2.5 font-semibold">Courier</th>
              <th className="px-3 py-2.5 font-semibold">AWB</th><th className="px-3 py-2.5 font-semibold">Send Date</th><th className="px-3 py-2.5 font-semibold">#Samples</th>
              <th className="px-3 py-2.5 font-semibold">Approx Arrival</th><th className="px-3 py-2.5 font-semibold">Notes</th>{canEdit && <th className="px-3 py-2.5 font-semibold">Delete</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={canEdit ? 12 : 11} className="px-3 py-10 text-center text-ink-soft">No buyer samples yet{canEdit ? " — add one above." : "."}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                {canEdit ? <>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.buyerName} type="text" action={setBuyerSampleBuyerName}>{txt(r.buyerName)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.sampleType} type="text" action={setBuyerSampleSampleType}>{txt(r.sampleType)}</EditableCell></td>
                  <td className="px-3 py-2 font-mono text-xs"><EditableCell id={r.id} raw={r.artNo} type="text" action={setBuyerSampleArtNo}>{r.artNo}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.styleName} type="text" action={setBuyerSampleStyleName}>{txt(r.styleName)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.factoryName} type="text" action={setBuyerSampleFactoryName}>{txt(r.factoryName)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.courierName} type="text" action={setBuyerSampleCourierName}>{txt(r.courierName)}</EditableCell></td>
                  <td className="px-3 py-2 font-mono text-xs"><EditableCell id={r.id} raw={r.awbNumber} type="text" action={setBuyerSampleAwb}>{txt(r.awbNumber)}</EditableCell></td>
                  <td className="px-3 py-2 tnum text-xs"><EditableCell id={r.id} raw={r.sendDateRaw} type="date" action={setBuyerSampleSendDate}>{r.sendDateDisplay}</EditableCell></td>
                  <td className="px-3 py-2 tnum text-xs"><EditableCell id={r.id} raw={r.numSamples} type="number" align="right" action={setBuyerSampleNumSamples}>{txt(r.numSamples)}</EditableCell></td>
                  <td className="px-3 py-2 tnum text-xs"><EditableCell id={r.id} raw={r.approxArrivalRaw} type="date" action={setBuyerSampleApproxArrival}>{r.approxArrivalDisplay}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.notes} type="text" action={setBuyerSampleNotes}>{txt(r.notes)}</EditableCell></td>
                  <td className="px-3 py-2"><RowDeleteButton action={deleteBuyerSampleAction} id={r.id} /></td>
                </> : <>
                  <td className="px-3 py-2 text-xs">{txt(r.buyerName)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.sampleType)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.artNo}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.styleName)}</td><td className="px-3 py-2 text-xs">{txt(r.factoryName)}</td><td className="px-3 py-2 text-xs">{txt(r.courierName)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{txt(r.awbNumber)}</td><td className="px-3 py-2 tnum text-xs">{r.sendDateDisplay}</td><td className="px-3 py-2 tnum text-xs">{txt(r.numSamples)}</td>
                  <td className="px-3 py-2 tnum text-xs">{r.approxArrivalDisplay}</td><td className="px-3 py-2 text-xs">{txt(r.notes)}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
