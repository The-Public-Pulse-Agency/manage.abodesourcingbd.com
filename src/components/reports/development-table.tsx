"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditableCell } from "./editable-cell";
import { RowDeleteButton } from "./row-delete-button";
import {
  createDevelopmentAction, deleteDevelopmentAction,
  setDevLabDip, setDevKnitting, setDevFirstSample, setDevSecondSample, setDevFinalSample, setDevRemarks, setDevColour,
} from "@/lib/development/form-actions";

export type DevRow = {
  id: string; factory: string; buyer: string; styleRef: string; colour: string;
  labDip: string; knitting: string; firstSample: string; secondSample: string;
  finalSampleRaw: string; finalSampleDisplay: string; remarks: string;
};
type Opt = { value: string; label: string };

export function DevelopmentTable({ rows, canEdit, factories, buyers }: { rows: DevRow[]; canEdit: boolean; factories: Opt[]; buyers: Opt[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const txt = (v: string) => (v ? v : "—");

  return (
    <div className="space-y-3">
      {canEdit && (
        <form
          action={async (fd) => { setBusy(true); const r = await createDevelopmentAction(fd); setBusy(false); if (r.error) setErr(r.error); else { setErr(null); router.refresh(); (document.getElementById("dev-add") as HTMLFormElement)?.reset(); } }}
          id="dev-add"
          className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3 elevate"
        >
          <select name="buyerId" className="select text-sm" aria-label="Buyer"><option value="">Buyer…</option>{buyers.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select>
          <select name="factoryId" className="select text-sm" aria-label="Factory"><option value="">Factory…</option>{factories.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
          <input name="styleRef" required placeholder="Style ref" className="input text-sm" aria-label="Style ref" />
          <input name="colour" placeholder="Colour" className="input text-sm" aria-label="Colour" />
          <button type="submit" disabled={busy} className="rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">{busy ? "Adding…" : "+ Add development"}</button>
          {err && <span className="text-xs text-bad">{err}</span>}
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
        <table className="list-table w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5 font-semibold">Factory</th><th className="px-3 py-2.5 font-semibold">Buyer</th><th className="px-3 py-2.5 font-semibold">Style</th>
              <th className="px-3 py-2.5 font-semibold">Colour</th><th className="px-3 py-2.5 font-semibold">Lab dip</th><th className="px-3 py-2.5 font-semibold">Knitting</th>
              <th className="px-3 py-2.5 font-semibold">1st sample</th><th className="px-3 py-2.5 font-semibold">2nd sample</th><th className="px-3 py-2.5 font-semibold">Final sample sent</th>
              <th className="px-3 py-2.5 font-semibold">Remarks</th>{canEdit && <th className="px-3 py-2.5 font-semibold">Delete</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={canEdit ? 11 : 10} className="px-3 py-10 text-center text-ink-soft">No development items yet{canEdit ? " — add one above." : "."}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{r.factory}</td>
                <td className="px-3 py-2">{r.buyer}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.styleRef}</td>
                {canEdit ? <>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.colour} type="text" action={setDevColour}>{txt(r.colour)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.labDip} type="text" action={setDevLabDip}>{txt(r.labDip)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.knitting} type="text" action={setDevKnitting}>{txt(r.knitting)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.firstSample} type="text" action={setDevFirstSample}>{txt(r.firstSample)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.secondSample} type="text" action={setDevSecondSample}>{txt(r.secondSample)}</EditableCell></td>
                  <td className="px-3 py-2 tnum text-xs"><EditableCell id={r.id} raw={r.finalSampleRaw} type="date" action={setDevFinalSample}>{r.finalSampleDisplay}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.remarks} type="text" action={setDevRemarks}>{txt(r.remarks)}</EditableCell></td>
                  <td className="px-3 py-2"><RowDeleteButton action={deleteDevelopmentAction} id={r.id} /></td>
                </> : <>
                  <td className="px-3 py-2 text-xs">{txt(r.colour)}</td><td className="px-3 py-2 text-xs">{txt(r.labDip)}</td><td className="px-3 py-2 text-xs">{txt(r.knitting)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.firstSample)}</td><td className="px-3 py-2 text-xs">{txt(r.secondSample)}</td>
                  <td className="px-3 py-2 tnum text-xs">{r.finalSampleDisplay}</td><td className="px-3 py-2 text-xs">{txt(r.remarks)}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
