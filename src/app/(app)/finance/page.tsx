import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { financeSummary } from "@/lib/finance/summary";
import { listInvoicesPaged } from "@/lib/finance/invoices";
import { outstanding } from "@/lib/finance/money";
import { formatMoney, formatDate } from "@/lib/format";
import { InvoicesPanel, type InvoiceRow } from "@/components/invoices-panel";
import { listCashEntries, EXPENSE_HEADS, RECEIVED_PURPOSES } from "@/lib/finance/cash";
import { CashLedger, type CashRow } from "@/components/finance/cash-ledger";
import { Pagination } from "@/components/pagination";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !can(actor, "finance", "view")) redirect("/dashboard");

  const sp = await searchParams;
  const [summary, book, cashEntries] = await Promise.all([
    financeSummary(actor, { now: new Date() }),
    listInvoicesPaged(actor, {}, { page: Math.max(1, Number(sp.page) || 1) }),
    listCashEntries(actor),
  ]);
  const invoices = book.rows;
  const cashRows: CashRow[] = cashEntries.map((e) => ({
    id: e.id,
    kind: e.kind,
    date: new Date(e.entryDate).toISOString().slice(0, 10),
    amountBdt: e.amountBdt,
    sender: e.sender,
    purpose: e.purpose,
    head: e.head,
    note: e.note,
  }));
  const currentMonth = new Date().toISOString().slice(0, 7);

  const isoDay = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const rows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    type: inv.type,
    number: inv.number,
    amount: Number(inv.amount),
    outstanding: inv.status === "PAID" ? 0 : outstanding(inv.amount, inv.payments),
    status: inv.status,
    currency: inv.currency,
    poId: inv.poId,
    poNumber: inv.po?.poNumber ?? null,
    issueDate: isoDay(inv.issueDate),
    dueDate: isoDay(inv.dueDate),
    payments: inv.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      paidDate: isoDay(p.date) ?? "",
    })),
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

      <div className="overflow-x-auto rounded-sm border border-line bg-surface">
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

      <InvoicesPanel invoices={rows} canManage={can(actor, "finance", "create")} canDelete={can(actor, "finance", "delete")} showPo title="All invoices" />
      <Pagination page={book.page} totalPages={book.totalPages} total={book.total} pageSize={book.pageSize} params={sp} />

      <CashLedger
        entries={cashRows}
        canManage={can(actor, "finance", "create")}
        canDelete={can(actor, "finance", "delete")}
        expenseHeads={[...EXPENSE_HEADS]}
        purposes={[...RECEIVED_PURPOSES]}
        defaultMonth={currentMonth}
      />
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
