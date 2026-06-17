"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditableCell } from "./editable-cell";
import { RowDeleteButton } from "./row-delete-button";
import {
  createCommissionAction, deleteCommissionAction,
  setCommFactoryInvNo, setCommFactoryValue, setCommPct, setCommOwnInvNo, setCommIssueDate, setCommDueDate, setCommPaymentStatus, setCommRemarks,
} from "@/lib/commission/form-actions";
import { formatMoney } from "@/lib/format";

export type CommRow = {
  id: string; factory: string; buyer: string;
  factoryInvoiceNo: string; factoryInvoiceValue: number | null; factoryInvoiceValueRaw: string;
  commissionPct: number | null; commissionPctRaw: string; commissionAmount: number | null;
  ownInvoiceNo: string; issueRaw: string; issueDisplay: string; dueRaw: string; dueDisplay: string;
  paymentStatus: string; remarks: string;
};
type Opt = { value: string; label: string };
const PAY_OPTIONS = [{ value: "", label: "—" }, { value: "Due", label: "Due" }, { value: "Partial", label: "Partial" }, { value: "Paid", label: "Paid" }];

export function CommissionTable({ rows, canEdit, factories, buyers }: { rows: CommRow[]; canEdit: boolean; factories: Opt[]; buyers: Opt[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = (v: string) => (v ? v : "—");

  return (
    <div className="space-y-3">
      {canEdit && (
        <form
          action={async (fd) => { setBusy(true); const r = await createCommissionAction(fd); setBusy(false); if (r.error) setErr(r.error); else { setErr(null); router.refresh(); (document.getElementById("comm-add") as HTMLFormElement)?.reset(); } }}
          id="comm-add"
          className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3 elevate"
        >
          <select name="buyerId" className="select text-sm" aria-label="Buyer"><option value="">Buyer…</option>{buyers.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select>
          <select name="factoryId" className="select text-sm" aria-label="Factory"><option value="">Factory…</option>{factories.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
          <input name="factoryInvoiceNo" placeholder="Factory inv #" className="input text-sm" aria-label="Factory invoice no" />
          <input name="factoryInvoiceValue" type="number" step="0.01" placeholder="Factory value" className="input text-sm w-28" aria-label="Factory value" />
          <input name="commissionPct" type="number" step="0.01" placeholder="Comm %" className="input text-sm w-20" aria-label="Commission percent" />
          <button type="submit" disabled={busy} className="rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">{busy ? "Adding…" : "+ Add commission"}</button>
          {err && <span className="text-xs text-bad">{err}</span>}
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
        <table className="list-table w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5 font-semibold">Factory</th><th className="px-3 py-2.5 font-semibold">Buyer</th>
              <th className="px-3 py-2.5 font-semibold">Factory inv #</th><th className="px-3 py-2.5 text-right font-semibold">Factory value</th>
              <th className="px-3 py-2.5 text-right font-semibold">Comm %</th><th className="px-3 py-2.5 text-right font-semibold">Comm value</th>
              <th className="px-3 py-2.5 font-semibold">Own inv #</th><th className="px-3 py-2.5 font-semibold">Issue date</th>
              <th className="px-3 py-2.5 font-semibold">Due date</th><th className="px-3 py-2.5 font-semibold">Payment</th>
              <th className="px-3 py-2.5 font-semibold">Remarks</th>{canEdit && <th className="px-3 py-2.5 font-semibold">Delete</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={canEdit ? 12 : 11} className="px-3 py-10 text-center text-ink-soft">No commission entries yet{canEdit ? " — add one above." : "."}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{r.factory}</td>
                <td className="px-3 py-2">{r.buyer}</td>
                {canEdit ? <>
                  <td className="px-3 py-2 font-mono text-xs"><EditableCell id={r.id} raw={r.factoryInvoiceNo} type="text" action={setCommFactoryInvNo}>{t(r.factoryInvoiceNo)}</EditableCell></td>
                  <td className="px-3 py-2 text-right tnum"><EditableCell id={r.id} raw={r.factoryInvoiceValueRaw} type="number" align="right" action={setCommFactoryValue}>{r.factoryInvoiceValue != null ? formatMoney(r.factoryInvoiceValue) : "—"}</EditableCell></td>
                  <td className="px-3 py-2 text-right tnum"><EditableCell id={r.id} raw={r.commissionPctRaw} type="number" align="right" action={setCommPct}>{r.commissionPct != null ? `${r.commissionPct}%` : "—"}</EditableCell></td>
                  <td className="px-3 py-2 text-right tnum">{r.commissionAmount != null ? formatMoney(r.commissionAmount) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs"><EditableCell id={r.id} raw={r.ownInvoiceNo} type="text" action={setCommOwnInvNo}>{t(r.ownInvoiceNo)}</EditableCell></td>
                  <td className="px-3 py-2 tnum text-xs"><EditableCell id={r.id} raw={r.issueRaw} type="date" action={setCommIssueDate}>{r.issueDisplay}</EditableCell></td>
                  <td className="px-3 py-2 tnum text-xs"><EditableCell id={r.id} raw={r.dueRaw} type="date" action={setCommDueDate}>{r.dueDisplay}</EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.paymentStatus} type="select" options={PAY_OPTIONS} action={setCommPaymentStatus}><span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.625rem] font-semibold uppercase ${r.paymentStatus === "Paid" ? "bg-ok-soft text-ok" : r.paymentStatus ? "bg-warn-soft text-warn" : "bg-paper text-ink-soft"}`}>{t(r.paymentStatus)}</span></EditableCell></td>
                  <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.remarks} type="text" action={setCommRemarks}>{t(r.remarks)}</EditableCell></td>
                  <td className="px-3 py-2"><RowDeleteButton action={deleteCommissionAction} id={r.id} /></td>
                </> : <>
                  <td className="px-3 py-2 font-mono text-xs">{t(r.factoryInvoiceNo)}</td>
                  <td className="px-3 py-2 text-right tnum">{r.factoryInvoiceValue != null ? formatMoney(r.factoryInvoiceValue) : "—"}</td>
                  <td className="px-3 py-2 text-right tnum">{r.commissionPct != null ? `${r.commissionPct}%` : "—"}</td>
                  <td className="px-3 py-2 text-right tnum">{r.commissionAmount != null ? formatMoney(r.commissionAmount) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{t(r.ownInvoiceNo)}</td>
                  <td className="px-3 py-2 tnum text-xs">{r.issueDisplay}</td>
                  <td className="px-3 py-2 tnum text-xs">{r.dueDisplay}</td>
                  <td className="px-3 py-2 text-xs">{t(r.paymentStatus)}</td>
                  <td className="px-3 py-2 text-xs">{t(r.remarks)}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
