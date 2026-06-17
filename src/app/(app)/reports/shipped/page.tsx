import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { shippedGoodsReport } from "@/lib/reports/shipped";
import { formatDate, formatMoney, formatQty } from "@/lib/format";

const PAY_CLS: Record<string, string> = {
  ISSUED: "bg-warn-soft text-warn",
  PARTIALLY_PAID: "bg-warn-soft text-warn",
  PAID: "bg-ok-soft text-ok",
};

export default async function ShippedReportPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "shipment", "view")) redirect("/dashboard");
  const rows = await shippedGoodsReport(actor);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Report</p>
        <h1 className="text-2xl font-semibold tracking-tight">Shipped Goods</h1>
        <p className="mt-1 text-sm text-ink-soft">{rows.length} shipments · invoice, payment &amp; TC status.</p>
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface elevate">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">BL / Ref</th>
              <th className="px-3 py-2 font-semibold">Factory</th>
              <th className="px-3 py-2 font-semibold">Buyer</th>
              <th className="px-3 py-2 font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">Colour</th>
              <th className="px-3 py-2 font-semibold">Ship date</th>
              <th className="px-3 py-2 font-semibold">Invoice #</th>
              <th className="px-3 py-2 text-right font-semibold">Inv value</th>
              <th className="px-3 py-2 font-semibold">Due date</th>
              <th className="px-3 py-2 font-semibold">Payment</th>
              <th className="px-3 py-2 font-semibold">Container</th>
              <th className="px-3 py-2 font-semibold">TC status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={12} className="px-3 py-10 text-center text-ink-soft">No shipped goods yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2"><Link href={`/shipments/${r.id}`} className="font-mono font-medium text-accent hover:underline">{r.reference}</Link></td>
                <td className="px-3 py-2">{r.factory}</td>
                <td className="px-3 py-2">{r.buyer}</td>
                <td className="px-3 py-2 text-xs">{r.sizes}</td>
                <td className="px-3 py-2 text-xs">{r.colours}</td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(r.shipDate)}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.invoiceNumber ?? "—"}</td>
                <td className="px-3 py-2 text-right tnum">{r.invoiceValue && r.invoiceValue > 0 ? formatMoney(r.invoiceValue) : "—"}</td>
                <td className="px-3 py-2 tnum text-xs">{formatDate(r.invoiceDueDate)}</td>
                <td className="px-3 py-2">
                  {r.paymentStatus ? (
                    <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.625rem] font-semibold uppercase ${PAY_CLS[r.paymentStatus] ?? ""}`}>
                      {r.paymentStatus === "PAID" ? "Paid" : "Due"}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.containerNo ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.tcStatus ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink bg-paper font-semibold">
                <td className="px-3 py-2" colSpan={7}>{formatQty(rows.length)} shipments</td>
                <td className="px-3 py-2 text-right tnum">{formatMoney(rows.reduce((a, r) => a + (r.invoiceValue ?? 0), 0))}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
