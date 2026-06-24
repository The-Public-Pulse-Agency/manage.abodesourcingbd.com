"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ShippedRow } from "@/lib/reports/shipped";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { EditableCell } from "./editable-cell";
import { ExportButton } from "./export-button";
import { RowDeleteButton } from "./row-delete-button";
import { MultiSelect } from "./multi-select";
import { setInvoiceValue, setInvoiceDue, setInvoicePaymentStatus, setShipmentTc, setShipmentContainer, setShipmentEta, setShipmentRemarks, deleteShipmentAction } from "@/lib/reports/inline-actions";

const PAY_OPTIONS = [{ value: "ISSUED", label: "Due" }, { value: "PARTIALLY_PAID", label: "Partial" }, { value: "PAID", label: "Paid" }];

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const EXPORT_HEADERS = ["PO Number", "BL / Ref", "Factory", "Buyer", "Brand", "Style", "Size", "Colour", "Qty", "Short shipped", "Ship date", "ETA destination", "Invoice #", "Invoice value", "Due date", "Payment", "Container", "TC status", "Remarks"];

const PAY_CLS: Record<string, string> = {
  ISSUED: "bg-warn-soft text-warn",
  PARTIALLY_PAID: "bg-warn-soft text-warn",
  PAID: "bg-ok-soft text-ok",
};

export function ShippedTable({ rows, canEditShipment, canEditFinance, canDeleteShipment }: { rows: ShippedRow[]; canEditShipment: boolean; canEditFinance: boolean; canDeleteShipment: boolean }) {
  const [q, setQ] = useState("");
  const [factorySel, setFactorySel] = useState<string[]>([]);
  const [buyerSel, setBuyerSel] = useState<string[]>([]);
  const [pay, setPay] = useState("");

  const factories = useMemo(() => [...new Set(rows.map((r) => r.factory))].sort(), [rows]);
  const buyers = useMemo(() => [...new Set(rows.map((r) => r.buyer))].sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) =>
      (factorySel.length === 0 || factorySel.includes(r.factory)) &&
      (buyerSel.length === 0 || buyerSel.includes(r.buyer)) &&
      (!pay || (pay === "PAID" ? r.paymentStatus === "PAID" : r.paymentStatus && r.paymentStatus !== "PAID")) &&
      (!needle || `${r.poNumber} ${r.reference} ${r.invoiceNumber ?? ""} ${r.factory} ${r.buyer} ${r.containerNo ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [rows, q, factorySel, buyerSel, pay]);

  const totalQty = filtered.reduce((a, r) => a + r.qty, 0);
  const totalValue = filtered.reduce((a, r) => a + (r.invoiceValue ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search BL, invoice, factory, container…" className="input min-w-[16rem] flex-1" aria-label="Search shipments" />
        <MultiSelect allLabel="All factories" options={factories.map((f) => ({ value: f, label: f }))} selected={factorySel} onChange={setFactorySel} />
        <MultiSelect allLabel="All buyers" options={buyers.map((b) => ({ value: b, label: b }))} selected={buyerSel} onChange={setBuyerSel} />
        <select value={pay} onChange={(e) => setPay(e.target.value)} className="select" aria-label="Filter payment">
          <option value="">Any payment</option>
          <option value="PAID">Paid</option>
          <option value="DUE">Due</option>
        </select>
        {(q || factorySel.length || buyerSel.length || pay) && (
          <button type="button" onClick={() => { setQ(""); setFactorySel([]); setBuyerSel([]); setPay(""); }} className="rounded-sm border border-line px-2.5 py-1.5 text-xs text-ink-soft hover:border-accent hover:text-accent">Clear</button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <ExportButton
            filename="shipped-goods.csv"
            headers={EXPORT_HEADERS}
            rows={filtered.map((r) => [r.poNumber, r.reference, r.factory, r.buyer, r.brand, r.styles, r.sizes, r.colours, r.qty, r.shortShip ?? "", formatDate(r.shipDate), formatDate(r.etaDestination), r.invoiceNumber ?? "", r.invoiceValue ?? 0, formatDate(r.invoiceDueDate), r.paymentStatus ?? "", r.containerNo ?? "", r.tcStatus ?? "", r.remarks])}
          />
          <span className="text-xs text-ink-soft">{filtered.length} of {rows.length}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
        <table className="list-table w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5 font-semibold">PO</th>
              <th className="px-3 py-2.5 font-semibold">BL / Ref</th>
              <th className="px-3 py-2.5 font-semibold">Factory</th>
              <th className="px-3 py-2.5 font-semibold">Buyer</th>
              <th className="px-3 py-2.5 font-semibold">Brand</th>
              <th className="px-3 py-2.5 font-semibold">Style</th>
              <th className="px-3 py-2.5 font-semibold">Size</th>
              <th className="px-3 py-2.5 font-semibold">Colour</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
              <th className="px-3 py-2.5 font-semibold">Ship date</th>
              <th className="px-3 py-2.5 font-semibold">ETA dest.</th>
              <th className="px-3 py-2.5 font-semibold">Invoice #</th>
              <th className="px-3 py-2.5 text-right font-semibold">Inv value</th>
              <th className="px-3 py-2.5 font-semibold">Due date</th>
              <th className="px-3 py-2.5 font-semibold">Payment</th>
              <th className="px-3 py-2.5 font-semibold">Container</th>
              <th className="px-3 py-2.5 font-semibold">TC status</th>
              <th className="px-3 py-2.5 font-semibold">Remarks</th>
              <th className="px-3 py-2.5 font-semibold">Invoice doc</th>
              <th className="px-3 py-2.5 font-semibold">Edit</th>
              <th className="px-3 py-2.5 font-semibold">Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={21} className="px-3 py-10 text-center text-ink-soft">No shipments match.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{r.poId ? <Link href={`/orders/${r.poId}`} className="font-mono text-xs font-medium text-accent hover:underline">{r.poNumber}</Link> : <span className="font-mono text-xs text-ink-soft">{r.poNumber}</span>}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink-soft">{r.reference}</td>
                <td className="px-3 py-2">{r.factory}</td>
                <td className="px-3 py-2">{r.buyer}</td>
                <td className="px-3 py-2">{r.brand}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.styles}</td>
                <td className="px-3 py-2 text-xs">{r.sizes}</td>
                <td className="px-3 py-2 text-xs">{r.colours}</td>
                <td className="px-3 py-2 text-right tnum">
                  {formatQty(r.qty)}
                  {r.overShip && <div title={r.overShip} className="mt-0.5 inline-flex rounded-sm bg-warn-soft px-1 py-0.5 text-[0.5625rem] font-semibold uppercase text-warn">⚠ over</div>}
                  {r.shortShip && <div title={`Short shipped — ${r.shortShip}`} className="mt-0.5 inline-flex rounded-sm bg-bad-soft px-1 py-0.5 text-[0.5625rem] font-semibold uppercase text-bad">⚠ {r.shortShip}</div>}
                </td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(r.shipDate)}</td>
                <td className="px-3 py-2 tnum text-xs">{canEditShipment ? <EditableCell id={r.id} raw={iso(r.etaDestination)} type="date" action={setShipmentEta}>{formatDate(r.etaDestination)}</EditableCell> : formatDate(r.etaDestination)}</td>
                <td className="px-3 py-2">{r.invoiceNumber ? <Link href={`/shipments/${r.id}`} className="font-mono text-xs font-medium text-accent hover:underline">{r.invoiceNumber}</Link> : <span className="font-mono text-xs text-ink-soft">—</span>}</td>
                <td className="px-3 py-2 text-right tnum">
                  {r.invoiceId ? (
                    canEditFinance ? (
                      <EditableCell id={r.invoiceId} raw={r.invoiceValue && r.invoiceValue > 0 ? String(r.invoiceValue) : ""} type="number" align="right" action={setInvoiceValue}>{r.invoiceValue && r.invoiceValue > 0 ? formatMoney(r.invoiceValue) : "—"}</EditableCell>
                    ) : (r.invoiceValue && r.invoiceValue > 0 ? formatMoney(r.invoiceValue) : "—")
                  ) : "—"}
                </td>
                <td className="px-3 py-2 tnum text-xs">
                  {r.invoiceId ? (
                    canEditFinance ? (
                      <EditableCell id={r.invoiceId} raw={iso(r.invoiceDueDate)} type="date" action={setInvoiceDue}>{formatDate(r.invoiceDueDate)}</EditableCell>
                    ) : formatDate(r.invoiceDueDate)
                  ) : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.invoiceId ? (
                    (() => {
                      const badge = <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.625rem] font-semibold uppercase ${PAY_CLS[r.paymentStatus ?? ""] ?? "bg-paper text-ink-soft"}`}>{r.paymentStatus === "PAID" ? "Paid" : r.paymentStatus === "PARTIALLY_PAID" ? "Partial" : "Due"}</span>;
                      return canEditFinance ? (
                        <EditableCell id={r.invoiceId} raw={r.paymentStatus ?? "ISSUED"} type="select" options={PAY_OPTIONS} action={setInvoicePaymentStatus}>{badge}</EditableCell>
                      ) : badge;
                    })()
                  ) : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{canEditShipment ? <EditableCell id={r.id} raw={r.containerNo ?? ""} type="text" action={setShipmentContainer}>{r.containerNo ?? "—"}</EditableCell> : (r.containerNo ?? "—")}</td>
                <td className="px-3 py-2 text-xs">{canEditShipment ? <EditableCell id={r.id} raw={r.tcStatus ?? ""} type="text" action={setShipmentTc}>{r.tcStatus ?? "—"}</EditableCell> : (r.tcStatus ?? "—")}</td>
                <td className="px-3 py-2 text-xs">{canEditShipment ? <EditableCell id={r.id} raw={r.remarks} type="text" action={setShipmentRemarks}>{r.remarks || "—"}</EditableCell> : (r.remarks || "—")}</td>
                <td className="px-3 py-2">{r.invoiceId ? <a href={`/api/invoices/${r.invoiceId}`} className="text-xs font-medium text-accent hover:underline" title="Download invoice (Excel)">Invoice ⬇</a> : <span className="text-xs text-ink-soft">—</span>}</td>
                <td className="px-3 py-2"><Link href={`/shipments/${r.id}`} className="text-xs font-medium text-accent hover:underline">{canEditShipment ? "Edit →" : "View →"}</Link></td>
                <td className="px-3 py-2">{canDeleteShipment ? <RowDeleteButton action={deleteShipmentAction} id={r.id} /> : <span className="text-ink-soft">—</span>}</td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink bg-paper font-semibold">
                <td className="px-3 py-2.5" colSpan={8}>{formatQty(filtered.length)} shipments</td>
                <td className="px-3 py-2.5 text-right tnum">{formatQty(totalQty)}</td>
                <td className="px-3 py-2.5" colSpan={3} />
                <td className="px-3 py-2.5 text-right tnum">{totalValue > 0 ? formatMoney(totalValue) : "—"}</td>
                <td colSpan={8} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
