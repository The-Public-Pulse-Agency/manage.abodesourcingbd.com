import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { openOrdersReport, type StatusCell } from "@/lib/reports/open-orders";
import { formatDate, formatMoney, formatQty } from "@/lib/format";

function Cell({ c }: { c: StatusCell }) {
  if (c.state === "na") return <span className="text-ink-soft">—</span>;
  if (c.state === "done")
    return <span className="inline-flex rounded-sm bg-ok-soft px-1.5 py-0.5 text-[0.625rem] font-semibold text-ok">✓ {c.date ? formatDate(c.date) : "done"}</span>;
  if (c.state === "overdue")
    return <span className="inline-flex rounded-sm bg-bad-soft px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-bad">overdue</span>;
  return <span className="inline-flex rounded-sm bg-warn-soft px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-warn">pending</span>;
}

export default async function OpenOrdersReportPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "orders", "view")) redirect("/dashboard");
  const rows = await openOrdersReport(actor, { now: new Date() });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Report</p>
        <h1 className="text-2xl font-semibold tracking-tight">Open / Running Orders</h1>
        <p className="mt-1 text-sm text-ink-soft">{rows.length} open orders · status columns track the critical path live.</p>
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface elevate">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">PO</th>
              <th className="px-3 py-2 font-semibold">PO recvd</th>
              <th className="px-3 py-2 font-semibold">Factory</th>
              <th className="px-3 py-2 font-semibold">Buyer</th>
              <th className="px-3 py-2 font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">Colour</th>
              <th className="px-3 py-2 font-semibold">Conf. ship</th>
              <th className="px-3 py-2 text-right font-semibold">Price</th>
              <th className="px-3 py-2 text-right font-semibold">Total value</th>
              <th className="px-3 py-2 font-semibold">Trims</th>
              <th className="px-3 py-2 font-semibold">Yarn</th>
              <th className="px-3 py-2 font-semibold">Dyeing</th>
              <th className="px-3 py-2 font-semibold">Bulk shade</th>
              <th className="px-3 py-2 font-semibold">PP sample</th>
              <th className="px-3 py-2 font-semibold">Bulk sewing</th>
              <th className="px-3 py-2 font-semibold">Final insp.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={16} className="px-3 py-10 text-center text-ink-soft">No open orders.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2"><Link href={`/orders/${r.id}`} className="font-mono font-medium text-accent hover:underline">{r.poNumber}</Link></td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(r.poReceiveDate)}</td>
                <td className="px-3 py-2">{r.factory}</td>
                <td className="px-3 py-2">{r.buyer}</td>
                <td className="px-3 py-2 text-xs">{r.sizes}</td>
                <td className="px-3 py-2 text-xs">{r.colours}</td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(r.confirmedShipDate)}</td>
                <td className="px-3 py-2 text-right tnum">{r.pricePerUnit ? formatMoney(r.pricePerUnit, r.currency) : "—"}</td>
                <td className="px-3 py-2 text-right tnum">{formatMoney(r.totalValue, r.currency)}</td>
                <td className="px-3 py-2"><Cell c={r.trims} /></td>
                <td className="px-3 py-2"><Cell c={r.yarn} /></td>
                <td className="px-3 py-2"><Cell c={r.dyeing} /></td>
                <td className="px-3 py-2"><Cell c={r.bulkShade} /></td>
                <td className="px-3 py-2"><Cell c={r.ppSample} /></td>
                <td className="px-3 py-2"><Cell c={r.bulkSewing} /></td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(r.finalInspectionDate)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink bg-paper font-semibold">
                <td className="px-3 py-2" colSpan={8}>{formatQty(rows.length)} orders</td>
                <td className="px-3 py-2 text-right tnum">{formatMoney(rows.reduce((a, r) => a + r.totalValue, 0))}</td>
                <td colSpan={7} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
