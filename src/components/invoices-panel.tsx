"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createInvoiceAction, recordPaymentAction } from "@/lib/finance/form-actions";

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
};

const STATUS_CLS: Record<string, string> = {
  ISSUED: "bg-warn-soft text-warn",
  PARTIALLY_PAID: "bg-warn-soft text-warn",
  PAID: "bg-ok-soft text-ok",
};
const TODAY = new Date().toISOString().slice(0, 10);

export function InvoicesPanel({
  invoices,
  poId,
  canManage,
  showPo = false,
  title = "Invoices",
}: {
  invoices: InvoiceRow[];
  poId?: string;
  canManage: boolean;
  showPo?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);

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
            <th className="px-3 py-1.5 font-semibold">Status</th>
            {canManage && <th className="px-3 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 && (
            <tr><td colSpan={showPo ? 7 : 6} className="px-3 py-4 text-center text-ink-soft">No invoices yet.</td></tr>
          )}
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-line last:border-0 align-top">
              <td className="px-3 py-1.5 font-mono text-xs">{inv.type}</td>
              <td className="px-3 py-1.5 font-mono text-xs">{inv.number}</td>
              {showPo && (
                <td className="px-3 py-1.5">
                  {inv.poId ? (
                    <Link href={`/orders/${inv.poId}`} className="font-mono text-xs text-accent hover:underline">
                      {inv.poNumber ?? inv.poId.slice(0, 6)}
                    </Link>
                  ) : "—"}
                </td>
              )}
              <td className="px-3 py-1.5 text-right tnum">{inv.amount.toFixed(2)} {inv.currency}</td>
              <td className="px-3 py-1.5 text-right tnum font-medium">{inv.outstanding.toFixed(2)}</td>
              <td className="px-3 py-1.5">
                <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${STATUS_CLS[inv.status] ?? ""}`}>
                  {inv.status.replace(/_/g, " ")}
                </span>
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
              {canManage && (
                <td className="px-3 py-1.5 text-right">
                  {inv.outstanding > 0 && (
                    <button type="button" onClick={() => setPayFor(payFor === inv.id ? null : inv.id)} className="text-xs text-ink-soft hover:text-accent">
                      {payFor === inv.id ? "Cancel" : "Record payment"}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
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
          <select name="type" required className="select text-xs" aria-label="Invoice type">
            <option value="BUYER">BUYER (Abode→buyer)</option>
            <option value="FACTORY">FACTORY (payable)</option>
          </select>
          <input name="number" placeholder="Invoice number" required className="input text-xs" />
          <input name="amount" inputMode="decimal" placeholder="Amount" required className="input tnum w-28 text-right text-xs" />
          <input name="issueDate" type="date" defaultValue={TODAY} required className="input text-xs" aria-label="Issue date" title="Issue date" />
          <input name="dueDate" type="date" className="input text-xs" aria-label="Payment due date" title="Payment due date" />
          <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Add invoice</button>
        </form>
      )}
    </div>
  );
}
