import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { financeSummary } from "@/lib/finance/summary";
import { listInvoicesPaged } from "@/lib/finance/invoices";
import { outstanding } from "@/lib/finance/money";
import { formatMoney, formatDate } from "@/lib/format";
import { InvoicesPanel, type InvoiceRow } from "@/components/invoices-panel";
import { Pagination } from "@/components/pagination";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "finance", "view")) redirect("/dashboard");

  const sp = await searchParams;
  const [summary, book] = await Promise.all([
    financeSummary(actor, { now: new Date() }),
    listInvoicesPaged(actor, {}, { page: Math.max(1, Number(sp.page) || 1) }),
  ]);
  const invoices = book.rows;

  const rows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    type: inv.type,
    number: inv.number,
    amount: Number(inv.amount),
    outstanding: outstanding(inv.amount, inv.payments),
    status: inv.status,
    currency: inv.currency,
    poId: inv.poId,
    poNumber: inv.po?.poNumber ?? null,
  }));

  const buckets = ["0-30", "31-60", "61-90", "90+"] as const;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Finance</p>
        <h1 className="text-2xl font-semibold tracking-tight">Receivables &amp; Payables</h1>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-3">
        <Stat label="Receivable (AR) outstanding" value={formatMoney(summary.receivableOutstanding)} />
        <Stat label="Payable (AP) outstanding" value={formatMoney(summary.payableOutstanding)} />
        <Stat label="Realised margin" value={formatMoney(summary.realisedMargin)} accent />
      </div>

      <div className="overflow-hidden rounded-sm border border-line bg-surface">
        <div className="border-b border-line bg-paper px-4 py-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Aging (outstanding by age)</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-1.5 font-semibold">Invoice</th>
              <th className="px-3 py-1.5 font-semibold">Type</th>
              <th className="px-3 py-1.5 font-semibold">Due</th>
              {buckets.map((b) => (
                <th key={b} className="px-3 py-1.5 text-right font-semibold">{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.aging.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-ink-soft">Nothing outstanding. 🎉</td></tr>
            )}
            {summary.aging.map((a) => (
              <tr key={a.invoiceId} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5 font-mono text-xs">{a.number}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{a.type}</td>
                <td className="px-3 py-1.5 tnum text-xs">{a.dueDate ? formatDate(a.dueDate) : "—"}</td>
                {buckets.map((b) => (
                  <td key={b} className="px-3 py-1.5 text-right tnum">{a.bucket === b ? a.outstanding.toFixed(2) : ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InvoicesPanel invoices={rows} canManage={can(actor.role, "finance", "create")} showPo title="All invoices" />
      <Pagination page={book.page} totalPages={book.totalPages} total={book.total} pageSize={book.pageSize} params={sp} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-surface p-4">
      <p className="eyebrow">{label}</p>
      <p className={`tnum mt-1 text-xl font-semibold ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}
