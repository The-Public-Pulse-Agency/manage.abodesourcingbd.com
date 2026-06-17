"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ShippedRow } from "@/lib/reports/shipped";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { EditableCell } from "./editable-cell";
import { setInvoiceValue, setInvoiceDue, setShipmentTc, setShipmentContainer } from "@/lib/reports/inline-actions";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const PAY_CLS: Record<string, string> = {
  ISSUED: "bg-warn-soft text-warn",
  PARTIALLY_PAID: "bg-warn-soft text-warn",
  PAID: "bg-ok-soft text-ok",
};

export function ShippedTable({ rows }: { rows: ShippedRow[] }) {
  const [q, setQ] = useState("");
  const [factory, setFactory] = useState("");
  const [buyer, setBuyer] = useState("");
  const [pay, setPay] = useState("");

  const factories = useMemo(() => [...new Set(rows.map((r) => r.factory))].sort(), [rows]);
  const buyers = useMemo(() => [...new Set(rows.map((r) => r.buyer))].sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) =>
      (!factory || r.factory === factory) &&
      (!buyer || r.buyer === buyer) &&
      (!pay || (pay === "PAID" ? r.paymentStatus === "PAID" : r.paymentStatus && r.paymentStatus !== "PAID")) &&
      (!needle || `${r.reference} ${r.invoiceNumber ?? ""} ${r.factory} ${r.buyer} ${r.containerNo ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [rows, q, factory, buyer, pay]);

  const totalQty = filtered.reduce((a, r) => a + r.qty, 0);
  const totalValue = filtered.reduce((a, r) => a + (r.invoiceValue ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search BL, invoice, factory, container…" className="input min-w-[16rem] flex-1" aria-label="Search shipments" />
        <select value={factory} onChange={(e) => setFactory(e.target.value)} className="select" aria-label="Filter factory">
          <option value="">All factories</option>
          {factories.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={buyer} onChange={(e) => setBuyer(e.target.value)} className="select" aria-label="Filter buyer">
          <option value="">All buyers</option>
          {buyers.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={pay} onChange={(e) => setPay(e.target.value)} className="select" aria-label="Filter payment">
          <option value="">Any payment</option>
          <option value="PAID">Paid</option>
          <option value="DUE">Due</option>
        </select>
        {(q || factory || buyer || pay) && (
          <button type="button" onClick={() => { setQ(""); setFactory(""); setBuyer(""); setPay(""); }} className="rounded-sm border border-line px-2.5 py-1.5 text-xs text-ink-soft hover:border-accent hover:text-accent">Clear</button>
        )}
        <span className="ml-auto text-xs text-ink-soft">{filtered.length} of {rows.length}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
        <table className="list-table w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5 font-semibold">BL / Ref</th>
              <th className="px-3 py-2.5 font-semibold">Factory</th>
              <th className="px-3 py-2.5 font-semibold">Buyer</th>
              <th className="px-3 py-2.5 font-semibold">Size</th>
              <th className="px-3 py-2.5 font-semibold">Colour</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
              <th className="px-3 py-2.5 font-semibold">Ship date</th>
              <th className="px-3 py-2.5 font-semibold">Invoice #</th>
              <th className="px-3 py-2.5 text-right font-semibold">Inv value</th>
              <th className="px-3 py-2.5 font-semibold">Due date</th>
              <th className="px-3 py-2.5 font-semibold">Payment</th>
              <th className="px-3 py-2.5 font-semibold">Container</th>
              <th className="px-3 py-2.5 font-semibold">TC status</th>
              <th className="px-3 py-2.5 font-semibold">Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={14} className="px-3 py-10 text-center text-ink-soft">No shipments match.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-mono text-xs text-ink-soft">{r.reference}</td>
                <td className="px-3 py-2">{r.factory}</td>
                <td className="px-3 py-2">{r.buyer}</td>
                <td className="px-3 py-2 text-xs">{r.sizes}</td>
                <td className="px-3 py-2 text-xs">{r.colours}</td>
                <td className="px-3 py-2 text-right tnum">{formatQty(r.qty)}</td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(r.shipDate)}</td>
                <td className="px-3 py-2">{r.invoiceNumber ? <Link href={`/shipments/${r.id}`} className="font-mono text-xs font-medium text-accent hover:underline">{r.invoiceNumber}</Link> : <span className="font-mono text-xs text-ink-soft">—</span>}</td>
                <td className="px-3 py-2 text-right tnum">
                  {r.invoiceId ? (
                    <EditableCell id={r.invoiceId} raw={r.invoiceValue && r.invoiceValue > 0 ? String(r.invoiceValue) : ""} type="number" align="right" action={setInvoiceValue}>{r.invoiceValue && r.invoiceValue > 0 ? formatMoney(r.invoiceValue) : "—"}</EditableCell>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 tnum text-xs">
                  {r.invoiceId ? (
                    <EditableCell id={r.invoiceId} raw={iso(r.invoiceDueDate)} type="date" action={setInvoiceDue}>{formatDate(r.invoiceDueDate)}</EditableCell>
                  ) : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.paymentStatus ? <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.625rem] font-semibold uppercase ${PAY_CLS[r.paymentStatus] ?? ""}`}>{r.paymentStatus === "PAID" ? "Paid" : "Due"}</span> : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs"><EditableCell id={r.id} raw={r.containerNo ?? ""} type="text" action={setShipmentContainer}>{r.containerNo ?? "—"}</EditableCell></td>
                <td className="px-3 py-2 text-xs"><EditableCell id={r.id} raw={r.tcStatus ?? ""} type="text" action={setShipmentTc}>{r.tcStatus ?? "—"}</EditableCell></td>
                <td className="px-3 py-2"><Link href={`/shipments/${r.id}`} className="text-xs font-medium text-accent hover:underline">Edit →</Link></td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink bg-paper font-semibold">
                <td className="px-3 py-2.5" colSpan={5}>{formatQty(filtered.length)} shipments</td>
                <td className="px-3 py-2.5 text-right tnum">{formatQty(totalQty)}</td>
                <td className="px-3 py-2.5" colSpan={2} />
                <td className="px-3 py-2.5 text-right tnum">{totalValue > 0 ? formatMoney(totalValue) : "—"}</td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
