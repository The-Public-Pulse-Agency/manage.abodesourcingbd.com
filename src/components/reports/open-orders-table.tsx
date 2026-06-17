"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { OpenOrderRow, StatusCell } from "@/lib/reports/open-orders";
import { formatDate, formatMoney, formatQty } from "@/lib/format";

const STATUS_CLS: Record<string, string> = {
  DRAFT: "bg-paper text-ink-soft",
  CONFIRMED: "bg-accent-soft text-accent",
  IN_PRODUCTION: "bg-warn-soft text-warn",
  PARTLY_SHIPPED: "bg-ok-soft text-ok",
};

function Cell({ c }: { c: StatusCell }) {
  if (c.state === "na") return <span className="text-ink-soft">—</span>;
  if (c.state === "done")
    return <span className="inline-flex rounded-sm bg-ok-soft px-1.5 py-0.5 text-[0.625rem] font-semibold text-ok">✓ {c.date ? formatDate(c.date) : "done"}</span>;
  if (c.state === "overdue")
    return <span className="inline-flex rounded-sm bg-bad-soft px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-bad">overdue</span>;
  return <span className="inline-flex rounded-sm bg-warn-soft px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-warn">pending</span>;
}

export function OpenOrdersTable({ rows }: { rows: OpenOrderRow[] }) {
  const [q, setQ] = useState("");
  const [factory, setFactory] = useState("");
  const [buyer, setBuyer] = useState("");
  const [status, setStatus] = useState("");

  const factories = useMemo(() => [...new Set(rows.map((r) => r.factory))].sort(), [rows]);
  const buyers = useMemo(() => [...new Set(rows.map((r) => r.buyer))].sort(), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) =>
      (!factory || r.factory === factory) &&
      (!buyer || r.buyer === buyer) &&
      (!status || r.status === status) &&
      (!needle || `${r.poNumber} ${r.factory} ${r.buyer} ${r.colours} ${r.sizes}`.toLowerCase().includes(needle)),
    );
  }, [rows, q, factory, buyer, status]);

  const totalQty = filtered.reduce((a, r) => a + r.qty, 0);
  const totalValue = filtered.reduce((a, r) => a + r.totalValue, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PO, factory, buyer, colour…" className="input min-w-[16rem] flex-1" aria-label="Search orders" />
        <select value={factory} onChange={(e) => setFactory(e.target.value)} className="select" aria-label="Filter factory">
          <option value="">All factories</option>
          {factories.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={buyer} onChange={(e) => setBuyer(e.target.value)} className="select" aria-label="Filter buyer">
          <option value="">All buyers</option>
          {buyers.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="select" aria-label="Filter status">
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
        </select>
        {(q || factory || buyer || status) && (
          <button onClick={() => { setQ(""); setFactory(""); setBuyer(""); setStatus(""); }} className="rounded-sm border border-line px-2.5 py-1.5 text-xs text-ink-soft hover:border-accent hover:text-accent">Clear</button>
        )}
        <span className="ml-auto text-xs text-ink-soft">{filtered.length} of {rows.length}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface elevate">
        <table className="list-table w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5 font-semibold">PO</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">PO recvd</th>
              <th className="px-3 py-2.5 font-semibold">Factory</th>
              <th className="px-3 py-2.5 font-semibold">Buyer</th>
              <th className="px-3 py-2.5 font-semibold">Size</th>
              <th className="px-3 py-2.5 font-semibold">Colour</th>
              <th className="px-3 py-2.5 font-semibold">Conf. ship</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
              <th className="px-3 py-2.5 text-right font-semibold">Value</th>
              <th className="px-3 py-2.5 font-semibold">Trims</th>
              <th className="px-3 py-2.5 font-semibold">Yarn</th>
              <th className="px-3 py-2.5 font-semibold">Dyeing</th>
              <th className="px-3 py-2.5 font-semibold">Bulk shade</th>
              <th className="px-3 py-2.5 font-semibold">PP sample</th>
              <th className="px-3 py-2.5 font-semibold">Bulk sewing</th>
              <th className="px-3 py-2.5 font-semibold">Final insp.</th>
              <th className="px-3 py-2.5 font-semibold">Edit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={18} className="px-3 py-10 text-center text-ink-soft">No orders match.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2"><Link href={`/orders/${r.id}`} className="font-mono font-medium text-accent hover:underline">{r.poNumber}</Link></td>
                <td className="px-3 py-2"><span className={`inline-flex rounded-sm px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase ${STATUS_CLS[r.status] ?? "bg-paper text-ink-soft"}`}>{r.status.replace("_", " ").toLowerCase()}</span></td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(r.poReceiveDate)}</td>
                <td className="px-3 py-2">{r.factory}</td>
                <td className="px-3 py-2">{r.buyer}</td>
                <td className="px-3 py-2 text-xs">{r.sizes}</td>
                <td className="px-3 py-2 text-xs">{r.colours}</td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(r.confirmedShipDate)}</td>
                <td className="px-3 py-2 text-right tnum">{formatQty(r.qty)}</td>
                <td className="px-3 py-2 text-right tnum">{r.totalValue > 0 ? formatMoney(r.totalValue, r.currency) : "—"}</td>
                <td className="px-3 py-2"><Cell c={r.trims} /></td>
                <td className="px-3 py-2"><Cell c={r.yarn} /></td>
                <td className="px-3 py-2"><Cell c={r.dyeing} /></td>
                <td className="px-3 py-2"><Cell c={r.bulkShade} /></td>
                <td className="px-3 py-2"><Cell c={r.ppSample} /></td>
                <td className="px-3 py-2"><Cell c={r.bulkSewing} /></td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(r.finalInspectionDate)}</td>
                <td className="px-3 py-2"><Link href={`/orders/${r.id}`} className="text-xs font-medium text-accent hover:underline">Edit →</Link></td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink bg-paper font-semibold">
                <td className="px-3 py-2.5" colSpan={8}>{formatQty(filtered.length)} orders</td>
                <td className="px-3 py-2.5 text-right tnum">{formatQty(totalQty)}</td>
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
