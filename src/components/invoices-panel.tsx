"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createInvoiceAction,
  recordPaymentAction,
  setInvoiceNumber,
  setInvoiceAmount,
  setInvoiceStatus,
  setInvoiceIssueDate,
  setInvoiceDueDate,
  setPaymentAmount,
  setPaymentMethod,
  setPaymentDate,
  deletePaymentAction,
  deleteInvoiceAction,
} from "@/lib/finance/form-actions";
import { EditableCell } from "@/components/reports/editable-cell";
import { RowDeleteButton } from "@/components/reports/row-delete-button";

export type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  paidDate: string; // YYYY-MM-DD
};

export type InvoiceRow = {
  id: string;
  type: string;
  number: string;
  amount: number;
  outstanding: number;
  status: string;
  currency: string;
  poId: string | null;
  poNumber?: string | null;
  issueDate?: string | null; // YYYY-MM-DD
  dueDate?: string | null; // YYYY-MM-DD
  payments?: PaymentRow[];
};

const STATUS_CLS: Record<string, string> = {
  ISSUED: "bg-warn-soft text-warn",
  PARTIALLY_PAID: "bg-warn-soft text-warn",
  PAID: "bg-ok-soft text-ok",
};
const STATUS_OPTS = [
  { value: "ISSUED", label: "ISSUED" },
  { value: "PARTIALLY_PAID", label: "PARTIALLY PAID" },
  { value: "PAID", label: "PAID" },
];
const METHOD_OPTS = [
  { value: "TT", label: "TT" },
  { value: "LC", label: "LC" },
  { value: "OTHER", label: "OTHER" },
];
const TODAY = new Date().toISOString().slice(0, 10);

export function InvoicesPanel({
  invoices,
  poId,
  canManage,
  canDelete = false,
  showPo = false,
  title = "Invoices",
  defaultNumber,
  defaultAmount,
  shipmentId,
}: {
  invoices: InvoiceRow[];
  poId?: string;
  canManage: boolean;
  canDelete?: boolean;
  showPo?: boolean;
  title?: string;
  // Optional pre-fill for the add-invoice form (e.g. from a shipment: reference + shipped value).
  defaultNumber?: string;
  defaultAmount?: number;
  // When set, a created invoice is also linked to this shipment (shows on the shipped register).
  shipmentId?: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [openPayments, setOpenPayments] = useState<string | null>(null);

  // Type / PO / Number / Amount / Outstanding / Issue / Due / Status (+ actions)
  const showActions = canManage || canDelete;
  const colCount = 7 + (showPo ? 1 : 0) + (showActions ? 1 : 0);

  return (
    <div className="rounded-sm border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{title}</h3>
        {msg && <span className="text-xs text-bad">{msg}</span>}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="px-3 py-1.5 font-semibold">Type</th>
            <th className="px-3 py-1.5 font-semibold">Number</th>
            {showPo && <th className="px-3 py-1.5 font-semibold">PO</th>}
            <th className="px-3 py-1.5 text-right font-semibold">Amount</th>
            <th className="px-3 py-1.5 text-right font-semibold">Outstanding</th>
            <th className="px-3 py-1.5 font-semibold">Issue</th>
            <th className="px-3 py-1.5 font-semibold">Due</th>
            <th className="px-3 py-1.5 font-semibold">Status</th>
            {showActions && <th className="px-3 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 && (
            <tr><td colSpan={colCount} className="px-3 py-4 text-center text-ink-soft">No invoices yet.</td></tr>
          )}
          {invoices.map((inv) => {
            const payments = inv.payments ?? [];
            const showingPayments = openPayments === inv.id;
            return (
            <Fragment key={inv.id}>
            <tr className="border-b border-line last:border-0 align-top">
              <td className="px-3 py-1.5 font-mono text-xs">{inv.type}</td>
              <td className="px-3 py-1.5 font-mono text-xs">
                <span className="inline-flex items-center gap-1.5">
                  {canManage ? (
                    <EditableCell id={inv.id} raw={inv.number} type="text" action={setInvoiceNumber}>
                      {inv.number}
                    </EditableCell>
                  ) : inv.number}
                  <a href={`/api/invoices/${inv.id}`} className="text-accent hover:underline" title="Download invoice (Excel)">⬇</a>
                </span>
              </td>
              {showPo && (
                <td className="px-3 py-1.5">
                  {inv.poId ? (
                    <Link href={`/orders/${inv.poId}`} className="font-mono text-xs text-accent hover:underline">
                      {inv.poNumber ?? inv.poId.slice(0, 6)}
                    </Link>
                  ) : "—"}
                </td>
              )}
              <td className="px-3 py-1.5 text-right tnum">
                {canManage ? (
                  <EditableCell id={inv.id} raw={String(inv.amount)} type="number" align="right" action={setInvoiceAmount}>
                    {inv.amount.toFixed(2)} {inv.currency}
                  </EditableCell>
                ) : <>{inv.amount.toFixed(2)} {inv.currency}</>}
              </td>
              <td className="px-3 py-1.5 text-right tnum font-medium">{inv.outstanding.toFixed(2)}</td>
              <td className="px-3 py-1.5 tnum text-xs">
                {canManage ? (
                  <EditableCell id={inv.id} raw={inv.issueDate ?? ""} type="date" action={setInvoiceIssueDate}>
                    {inv.issueDate ?? "—"}
                  </EditableCell>
                ) : (inv.issueDate ?? "—")}
              </td>
              <td className="px-3 py-1.5 tnum text-xs">
                {canManage ? (
                  <EditableCell id={inv.id} raw={inv.dueDate ?? ""} type="date" action={setInvoiceDueDate}>
                    {inv.dueDate ?? "—"}
                  </EditableCell>
                ) : (inv.dueDate ?? "—")}
              </td>
              <td className="px-3 py-1.5">
                {canManage ? (
                  <EditableCell
                    id={inv.id}
                    raw={inv.status}
                    type="select"
                    options={STATUS_OPTS}
                    action={setInvoiceStatus}
                  >
                    <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${STATUS_CLS[inv.status] ?? ""}`}>
                      {inv.status.replace(/_/g, " ")}
                    </span>
                  </EditableCell>
                ) : (
                  <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${STATUS_CLS[inv.status] ?? ""}`}>
                    {inv.status.replace(/_/g, " ")}
                  </span>
                )}
                {canManage && inv.outstanding > 0 && (
                  <form
                    action={async (fd) => {
                      const res = await recordPaymentAction(inv.id, fd);
                      if (res.error) setMsg(res.error);
                      else { setMsg(null); setPayFor(null); router.refresh(); }
                    }}
                    className={`mt-2 flex flex-wrap items-end gap-2 ${payFor === inv.id ? "" : "hidden"}`}
                  >
                    <input name="amount" inputMode="decimal" placeholder="Pay amount" className="input tnum w-24 text-right text-xs" />
                    <select name="method" aria-label="Payment method" className="select text-xs"><option>TT</option><option>LC</option><option>OTHER</option></select>
                    <input name="date" type="date" defaultValue={TODAY} className="input text-xs" aria-label="Payment date" />
                    <button type="submit" className="rounded-sm bg-ink px-2 py-1 text-xs font-medium text-white">Save</button>
                  </form>
                )}
              </td>
              {showActions && (
                <td className="px-3 py-1.5 text-right">
                  <div className="flex flex-col items-end gap-1">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setOpenPayments(showingPayments ? null : inv.id)}
                        className="text-xs text-ink-soft hover:text-accent"
                      >
                        {showingPayments ? "Hide" : `Payments (${payments.length})`}
                      </button>
                    )}
                    {canManage && inv.outstanding > 0 && (
                      <button type="button" onClick={() => setPayFor(payFor === inv.id ? null : inv.id)} className="text-xs text-ink-soft hover:text-accent">
                        {payFor === inv.id ? "Cancel" : "Record payment"}
                      </button>
                    )}
                    {canDelete && <RowDeleteButton id={inv.id} action={deleteInvoiceAction} />}
                  </div>
                </td>
              )}
            </tr>
            {canManage && showingPayments && (
              <tr className="border-b border-line last:border-0 bg-paper">
                <td colSpan={colCount} className="px-3 py-2">
                  {payments.length === 0 ? (
                    <p className="text-xs text-ink-soft">No payments recorded for this invoice.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left uppercase tracking-wide text-ink-soft">
                          <th className="px-2 py-1 text-right font-semibold">Amount</th>
                          <th className="px-2 py-1 font-semibold">Method</th>
                          <th className="px-2 py-1 font-semibold">Date</th>
                          <th className="px-2 py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id} className="border-t border-line">
                            <td className="px-2 py-1 text-right tnum">
                              <EditableCell id={p.id} raw={String(p.amount)} type="number" align="right" action={setPaymentAmount}>
                                {p.amount.toFixed(2)}
                              </EditableCell>
                            </td>
                            <td className="px-2 py-1">
                              <EditableCell id={p.id} raw={p.method} type="select" options={METHOD_OPTS} action={setPaymentMethod}>
                                {p.method}
                              </EditableCell>
                            </td>
                            <td className="px-2 py-1 tnum">
                              <EditableCell id={p.id} raw={p.paidDate} type="date" action={setPaymentDate}>
                                {p.paidDate || "—"}
                              </EditableCell>
                            </td>
                            <td className="px-2 py-1 text-right">
                              <RowDeleteButton id={p.id} action={deletePaymentAction} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </td>
              </tr>
            )}
            </Fragment>
          );})}
        </tbody>
      </table>
      {poId && canManage && (
        <form
          action={async (fd) => {
            const res = await createInvoiceAction(poId, fd);
            if (res.error) setMsg(res.error);
            else { setMsg(null); router.refresh(); }
          }}
          className="flex flex-wrap items-end gap-2 border-t border-line p-3"
        >
          {shipmentId && <input type="hidden" name="shipmentId" value={shipmentId} />}
          <select name="type" required className="select text-xs" aria-label="Invoice type">
            <option value="BUYER">BUYER (Abode→buyer)</option>
            <option value="FACTORY">FACTORY (payable)</option>
          </select>
          <input name="number" defaultValue={defaultNumber ?? ""} placeholder="Invoice number" required className="input text-xs" />
          <input name="amount" defaultValue={defaultAmount && defaultAmount > 0 ? defaultAmount : ""} inputMode="decimal" placeholder="Amount" required className="input tnum w-28 text-right text-xs" />
          <input name="issueDate" type="date" defaultValue={TODAY} required className="input text-xs" aria-label="Issue date" title="Issue date" />
          <input name="dueDate" type="date" className="input text-xs" aria-label="Payment due date" title="Payment due date" />
          <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Add invoice</button>
        </form>
      )}
    </div>
  );
}
