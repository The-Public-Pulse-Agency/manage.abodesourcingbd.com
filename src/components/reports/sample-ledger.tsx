"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { EditableCell } from "./editable-cell";
import { RowDeleteButton } from "./row-delete-button";
import {
  createMovementAction, deleteMovementAction,
  setMovementDate, setMovementSampleType, setMovementQty, setMovementArtNo, setMovementBuyer,
  setMovementPoNumber, setMovementFactory, setMovementColour, setMovementReceivedFrom,
  setMovementSentTo, setMovementCourier, setMovementAwb, setMovementRemarks,
} from "@/lib/sample-ledger/form-actions";

export type MovementRow = {
  id: string;
  direction: string;
  dateRaw: string;
  dateDisplay: string;
  sampleType: string;
  qty: string;
  artNo: string;
  buyer: string;
  poNumber: string;
  factoryName: string;
  colour: string;
  receivedFrom: string;
  sentTo: string;
  courierName: string;
  awbNumber: string;
  remarks: string;
};

export type ArtInfo = {
  buyer?: string;
  sampleType?: string;
  factory?: string;
  colour?: string;
  // Internal marker: whether this entry was derived from an IN row (preferred source).
  _fromIn?: boolean;
};

type Suggestions = {
  artNos: string[];
  buyers: string[];
  factories: string[];
  poNumbers: string[];
  sampleTypes: string[];
  artInfo: Record<string, ArtInfo>;
};

type ArtRow = {
  artNo: string;
  totalIn: number;
  totalOut: number;
  balance: number;
  lastMovement: Date | string | null;
  status: "In Stock" | "Partially Sent" | "Fully Sent";
};

const STATUS_CLASS: Record<ArtRow["status"], string> = {
  "In Stock": "text-ink",
  "Partially Sent": "text-warn",
  "Fully Sent": "text-ok",
};

export function SampleLedger({
  inRows, outRows, perArt, canEdit,
  artNos, buyers, factories, poNumbers, sampleTypes, artInfo,
}: {
  inRows: MovementRow[]; outRows: MovementRow[]; perArt: ArtRow[]; canEdit: boolean;
  artNos: string[]; buyers: string[]; factories: string[]; poNumbers: string[]; sampleTypes: string[];
  artInfo: Record<string, ArtInfo>;
}) {
  const router = useRouter();
  const txt = (v: string) => (v ? v : "—");
  const suggestions: Suggestions = { artNos, buyers, factories, poNumbers, sampleTypes, artInfo };

  return (
    <div className="space-y-8">
      <Datalists suggestions={suggestions} />
      <SampleInSection rows={inRows} canEdit={canEdit} router={router} txt={txt} suggestions={suggestions} />
      <SampleOutSection rows={outRows} canEdit={canEdit} router={router} txt={txt} suggestions={suggestions} />
      <BalanceSection perArt={perArt} />
    </div>
  );
}

function Datalists({ suggestions }: { suggestions: Suggestions }) {
  const list = (id: string, opts: string[]) => (
    <datalist id={id}>{opts.map((o) => <option key={o} value={o} />)}</datalist>
  );
  return (
    <>
      {list("sl-art-nos", suggestions.artNos)}
      {list("sl-buyers", suggestions.buyers)}
      {list("sl-factories", suggestions.factories)}
      {list("sl-po-numbers", suggestions.poNumbers)}
      {list("sl-sample-types", suggestions.sampleTypes)}
    </>
  );
}

type Router = ReturnType<typeof useRouter>;

function CreateForm({ id, direction, canEdit, router, label, onReset, children }: { id: string; direction: "IN" | "OUT"; canEdit: boolean; router: Router; label: string; onReset?: () => void; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!canEdit) return null;
  return (
    <form
      action={async (fd) => { setBusy(true); const r = await createMovementAction(fd); setBusy(false); if (r.error) setErr(r.error); else { setErr(null); router.refresh(); (document.getElementById(id) as HTMLFormElement)?.reset(); onReset?.(); } }}
      id={id}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3 elevate"
    >
      <input type="hidden" name="direction" value={direction} />
      {children}
      <button type="submit" disabled={busy} className="rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">{busy ? "Adding…" : label}</button>
      {err && <span className="text-xs text-bad">{err}</span>}
    </form>
  );
}

function SampleInSection({ rows, canEdit, router, txt, suggestions }: { rows: MovementRow[]; canEdit: boolean; router: Router; txt: (v: string) => string; suggestions: Suggestions }) {
  const cols = 10 + (canEdit ? 1 : 0);
  // Controlled fields needed for auto-fill; the rest stay uncontrolled.
  const [artNo, setArtNo] = useState("");
  const [buyer, setBuyer] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [factory, setFactory] = useState("");
  const [colour, setColour] = useState("");
  const reset = () => { setArtNo(""); setBuyer(""); setSampleType(""); setFactory(""); setColour(""); };
  const onArtChange = (v: string) => {
    setArtNo(v);
    const info = suggestions.artInfo[v.trim()];
    if (info) {
      if (info.buyer) setBuyer(info.buyer);
      if (info.sampleType) setSampleType(info.sampleType);
      if (info.factory) setFactory(info.factory);
      if (info.colour) setColour(info.colour);
    }
  };
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Sample IN</h2>
      <CreateForm id="sample-in-add" direction="IN" canEdit={canEdit} router={router} label="+ Add sample in" onReset={reset}>
        <input type="date" name="movementDate" className="input text-sm" aria-label="Date received" />
        <input name="artNo" required value={artNo} onChange={(e) => onArtChange(e.target.value)} list="sl-art-nos" placeholder="Art/Style no" className="input text-sm" aria-label="Art/Style no" />
        <input name="buyer" value={buyer} onChange={(e) => setBuyer(e.target.value)} list="sl-buyers" placeholder="Buyer" className="input text-sm" aria-label="Buyer" />
        <input name="sampleType" value={sampleType} onChange={(e) => setSampleType(e.target.value)} list="sl-sample-types" placeholder="Sample type" className="input text-sm" aria-label="Sample type" />
        <input type="number" name="qty" placeholder="Qty" className="input text-sm w-24" aria-label="Qty" />
        <input name="poNumber" list="sl-po-numbers" placeholder="PO number" className="input text-sm" aria-label="PO number" />
        <input name="factoryName" value={factory} onChange={(e) => setFactory(e.target.value)} list="sl-factories" placeholder="Factory" className="input text-sm" aria-label="Factory" />
        <input name="colour" value={colour} onChange={(e) => setColour(e.target.value)} placeholder="Colour" className="input text-sm" aria-label="Colour" />
        <input name="receivedFrom" placeholder="Received from" className="input text-sm" aria-label="Received from" />
        <input name="remarks" placeholder="Remarks" className="input text-sm" aria-label="Remarks" />
      </CreateForm>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
        <table className="list-table w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5 font-semibold">Date Received</th><th className="px-3 py-2.5 font-semibold">Art/Style No</th><th className="px-3 py-2.5 font-semibold">Buyer</th>
              <th className="px-3 py-2.5 font-semibold">Sample Type</th><th className="px-3 py-2.5 font-semibold">Qty</th><th className="px-3 py-2.5 font-semibold">PO Number</th>
              <th className="px-3 py-2.5 font-semibold">Factory</th><th className="px-3 py-2.5 font-semibold">Colour</th><th className="px-3 py-2.5 font-semibold">Received From</th>
              <th className="px-3 py-2.5 font-semibold">Remarks</th>{canEdit && <th className="px-3 py-2.5 font-semibold">Delete</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols} className="px-3 py-10 text-center text-ink-soft">No samples received yet{canEdit ? " — add one above." : "."}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                {canEdit ? <>
                  <td className="px-3 py-2 tnum text-xs"><EditableCell id={r.id} raw={r.dateRaw} type="date" action={setMovementDate}>{r.dateDisplay}</EditableCell></td>
                  <td className="px-3 py-2 font-mono text-xs"><EditableCell id={r.id} raw={r.artNo} type="text" action={setMovementArtNo}>{r.artNo}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.buyer} type="text" action={setMovementBuyer}>{txt(r.buyer)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.sampleType} type="text" action={setMovementSampleType}>{txt(r.sampleType)}</EditableCell></td>
                  <td className="px-3 py-2 tnum text-xs"><EditableCell id={r.id} raw={r.qty} type="number" align="right" action={setMovementQty}>{txt(r.qty)}</EditableCell></td>
                  <td className="px-3 py-2 font-mono text-xs"><EditableCell id={r.id} raw={r.poNumber} type="text" action={setMovementPoNumber}>{txt(r.poNumber)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.factoryName} type="text" action={setMovementFactory}>{txt(r.factoryName)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.colour} type="text" action={setMovementColour}>{txt(r.colour)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.receivedFrom} type="text" action={setMovementReceivedFrom}>{txt(r.receivedFrom)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.remarks} type="text" action={setMovementRemarks}>{txt(r.remarks)}</EditableCell></td>
                  <td className="px-3 py-2"><RowDeleteButton action={deleteMovementAction} id={r.id} /></td>
                </> : <>
                  <td className="px-3 py-2 tnum text-xs">{r.dateDisplay}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.artNo}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.buyer)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.sampleType)}</td>
                  <td className="px-3 py-2 tnum text-xs text-right">{txt(r.qty)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{txt(r.poNumber)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.factoryName)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.colour)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.receivedFrom)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.remarks)}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SampleOutSection({ rows, canEdit, router, txt, suggestions }: { rows: MovementRow[]; canEdit: boolean; router: Router; txt: (v: string) => string; suggestions: Suggestions }) {
  const cols = 9 + (canEdit ? 1 : 0);
  // Controlled fields needed for auto-fill; the rest stay uncontrolled.
  const [artNo, setArtNo] = useState("");
  const [buyer, setBuyer] = useState("");
  const [sampleType, setSampleType] = useState("");
  const reset = () => { setArtNo(""); setBuyer(""); setSampleType(""); };
  const onArtChange = (v: string) => {
    setArtNo(v);
    const info = suggestions.artInfo[v.trim()];
    if (info) {
      if (info.buyer) setBuyer(info.buyer);
      if (info.sampleType) setSampleType(info.sampleType);
    }
  };
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Sample OUT</h2>
      <CreateForm id="sample-out-add" direction="OUT" canEdit={canEdit} router={router} label="+ Add sample out" onReset={reset}>
        <input type="date" name="movementDate" className="input text-sm" aria-label="Date sent" />
        <input name="artNo" required value={artNo} onChange={(e) => onArtChange(e.target.value)} list="sl-art-nos" placeholder="Art/Style no" className="input text-sm" aria-label="Art/Style no" />
        <input name="buyer" value={buyer} onChange={(e) => setBuyer(e.target.value)} list="sl-buyers" placeholder="Buyer" className="input text-sm" aria-label="Buyer" />
        <input name="sampleType" value={sampleType} onChange={(e) => setSampleType(e.target.value)} list="sl-sample-types" placeholder="Sample type" className="input text-sm" aria-label="Sample type" />
        <input type="number" name="qty" placeholder="Qty" className="input text-sm w-24" aria-label="Qty" />
        <input name="sentTo" placeholder="Sent to / carried by" className="input text-sm" aria-label="Sent to / carried by" />
        <input name="courierName" placeholder="Courier" className="input text-sm" aria-label="Courier" />
        <input name="awbNumber" placeholder="AWB" className="input text-sm" aria-label="AWB" />
        <input name="remarks" placeholder="Remarks" className="input text-sm" aria-label="Remarks" />
      </CreateForm>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
        <table className="list-table w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5 font-semibold">Date Sent</th><th className="px-3 py-2.5 font-semibold">Art/Style No</th><th className="px-3 py-2.5 font-semibold">Buyer</th>
              <th className="px-3 py-2.5 font-semibold">Sample Type</th><th className="px-3 py-2.5 font-semibold">Qty</th><th className="px-3 py-2.5 font-semibold">Sent To/Carried By</th>
              <th className="px-3 py-2.5 font-semibold">Courier</th><th className="px-3 py-2.5 font-semibold">AWB</th><th className="px-3 py-2.5 font-semibold">Remarks</th>
              {canEdit && <th className="px-3 py-2.5 font-semibold">Delete</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols} className="px-3 py-10 text-center text-ink-soft">No samples sent yet{canEdit ? " — add one above." : "."}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                {canEdit ? <>
                  <td className="px-3 py-2 tnum text-xs"><EditableCell id={r.id} raw={r.dateRaw} type="date" action={setMovementDate}>{r.dateDisplay}</EditableCell></td>
                  <td className="px-3 py-2 font-mono text-xs"><EditableCell id={r.id} raw={r.artNo} type="text" action={setMovementArtNo}>{r.artNo}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.buyer} type="text" action={setMovementBuyer}>{txt(r.buyer)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.sampleType} type="text" action={setMovementSampleType}>{txt(r.sampleType)}</EditableCell></td>
                  <td className="px-3 py-2 tnum text-xs"><EditableCell id={r.id} raw={r.qty} type="number" align="right" action={setMovementQty}>{txt(r.qty)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.sentTo} type="text" action={setMovementSentTo}>{txt(r.sentTo)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.courierName} type="text" action={setMovementCourier}>{txt(r.courierName)}</EditableCell></td>
                  <td className="px-3 py-2 font-mono text-xs"><EditableCell id={r.id} raw={r.awbNumber} type="text" action={setMovementAwb}>{txt(r.awbNumber)}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.remarks} type="text" action={setMovementRemarks}>{txt(r.remarks)}</EditableCell></td>
                  <td className="px-3 py-2"><RowDeleteButton action={deleteMovementAction} id={r.id} /></td>
                </> : <>
                  <td className="px-3 py-2 tnum text-xs">{r.dateDisplay}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.artNo}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.buyer)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.sampleType)}</td>
                  <td className="px-3 py-2 tnum text-xs text-right">{txt(r.qty)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.sentTo)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.courierName)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{txt(r.awbNumber)}</td>
                  <td className="px-3 py-2 text-xs">{txt(r.remarks)}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BalanceSection({ perArt }: { perArt: ArtRow[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Balance by Art/Style (auto-sync)</h2>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
        <table className="list-table w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5 font-semibold">Art/Style No</th><th className="px-3 py-2.5 font-semibold">Total Received</th><th className="px-3 py-2.5 font-semibold">Total Sent</th>
              <th className="px-3 py-2.5 font-semibold">Current Balance</th><th className="px-3 py-2.5 font-semibold">Last Movement</th><th className="px-3 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {perArt.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-soft">No movements yet.</td></tr>}
            {perArt.map((a) => (
              <tr key={a.artNo} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{a.artNo || "—"}</td>
                <td className="px-3 py-2 tnum text-xs">{a.totalIn}</td>
                <td className="px-3 py-2 tnum text-xs">{a.totalOut}</td>
                <td className="px-3 py-2 tnum text-xs">{a.balance}</td>
                <td className="px-3 py-2 tnum text-xs">{a.lastMovement ? formatDate(a.lastMovement) : "—"}</td>
                <td className="px-3 py-2 text-xs"><span className={`font-medium ${STATUS_CLASS[a.status]}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
