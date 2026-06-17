import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listShipmentsPaged } from "@/lib/shipment/shipment";
import { Pagination } from "@/components/pagination";
import { formatDate, formatMoney } from "@/lib/format";

const TELEX_CLS: Record<string, string> = {
  PENDING: "bg-line text-ink-soft",
  RECEIVED: "bg-warn-soft text-warn",
  RELEASED: "bg-ok-soft text-ok",
};
const PAY_CLS: Record<string, string> = {
  ISSUED: "bg-warn-soft text-warn",
  PARTIALLY_PAID: "bg-warn-soft text-warn",
  PAID: "bg-ok-soft text-ok",
};

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "shipment", "view")) redirect("/dashboard");
  const sp = await searchParams;
  const book = await listShipmentsPaged(actor, { page: Math.max(1, Number(sp.page) || 1) });
  const shipments = book.rows;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Logistics</p>
          <h1 className="text-2xl font-semibold tracking-tight">Shipment Tracker</h1>
        </div>
        {can(actor.role, "shipment", "create") && (
          <Link href="/shipments/new" className="rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90">
            + New shipment
          </Link>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface elevate">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">BL / Ref</th>
              <th className="px-3 py-2 font-semibold">Factory</th>
              <th className="px-3 py-2 font-semibold">Container</th>
              <th className="px-3 py-2 font-semibold">Invoice #</th>
              <th className="px-3 py-2 text-right font-semibold">Inv value</th>
              <th className="px-3 py-2 font-semibold">Due</th>
              <th className="px-3 py-2 font-semibold">Payment</th>
              <th className="px-3 py-2 font-semibold">TC</th>
              <th className="px-3 py-2 font-semibold">Telex</th>
              <th className="px-3 py-2 font-semibold">Ex-fty</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-ink-soft">No shipments yet.</td></tr>
            )}
            {shipments.map((s) => {
              const factory = s.lines.find((l) => l.orderLine?.po?.factory)?.orderLine?.po?.factory?.name;
              const invoice = s.invoices[0];
              return (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-ink-soft">{s.blNumber ?? s.reference}</td>
                  <td className="px-3 py-2">{factory ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.containerNo ?? "—"}</td>
                  <td className="px-3 py-2">
                    {invoice?.number ? (
                      <Link href={`/shipments/${s.id}`} className="font-mono text-xs font-medium text-accent hover:underline">{invoice.number}</Link>
                    ) : (
                      <Link href={`/shipments/${s.id}`} className="font-mono text-xs text-ink-soft hover:text-accent">open →</Link>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tnum">{invoice && Number(invoice.amount) > 0 ? formatMoney(Number(invoice.amount), invoice.currency) : "—"}</td>
                  <td className="px-3 py-2 tnum text-xs">{invoice?.dueDate ? formatDate(invoice.dueDate) : "—"}</td>
                  <td className="px-3 py-2">
                    {invoice ? (
                      <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${PAY_CLS[invoice.status] ?? ""}`}>
                        {invoice.status === "PAID" ? "Paid" : "Due"}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{s.tcStatus ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-sm px-2 py-0.5 text-[0.6875rem] font-semibold uppercase ${TELEX_CLS[s.telexStatus] ?? ""}`}>
                      {s.telexStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 tnum text-xs">{formatDate(s.exFactoryDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={book.page} totalPages={book.totalPages} total={book.total} pageSize={book.pageSize} params={sp} />
    </div>
  );
}
