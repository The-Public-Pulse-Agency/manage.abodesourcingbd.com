"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { RowDeleteButton } from "@/components/reports/row-delete-button";
import { createCashEntryAction, deleteCashEntryAction } from "@/lib/finance/cash-form-actions";

export type CashRow = {
  id: string;
  kind: "RECEIVED" | "EXPENSE";
  date: string; // YYYY-MM-DD
  amountBdt: number;
  sender: string | null;
  purpose: string | null;
  head: string | null;
  note: string | null;
};

const bdt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthOf = (d: string) => d.slice(0, 7);

export function CashLedger({
  entries,
  canManage,
  canDelete,
  expenseHeads,
  purposes,
  defaultMonth,
}: {
  entries: CashRow[];
  canManage: boolean;
  canDelete: boolean;
  expenseHeads: string[];
  purposes: string[];
  defaultMonth: string;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(defaultMonth);
  const [err, setErr] = useState<string | null>(null);

  // Datalists: defaults + any custom values already used.
  const headOpts = useMemo(
    () => [...new Set([...expenseHeads, ...entries.filter((e) => e.kind === "EXPENSE" && e.head).map((e) => e.head as string)])],
    [expenseHeads, entries],
  );
  const purposeOpts = useMemo(
    () => [...new Set([...purposes, ...entries.filter((e) => e.kind === "RECEIVED" && e.purpose).map((e) => e.purpose as string)])],
    [purposes, entries],
  );

  const received = entries.filter((e) => e.kind === "RECEIVED" && monthOf(e.date) === month);
  const expenses = entries.filter((e) => e.kind === "EXPENSE" && monthOf(e.date) === month);
  const totalReceived = received.reduce((a, e) => a + e.amountBdt, 0);
  const totalExpenses = expenses.reduce((a, e) => a + e.amountBdt, 0);
  const opening = entries.reduce((a, e) => (monthOf(e.date) < month ? a + (e.kind === "RECEIVED" ? e.amountBdt : -e.amountBdt) : a), 0);
  const closing = opening + totalReceived - totalExpenses;

  async function add(kind: "RECEIVED" | "EXPENSE", form: HTMLFormElement) {
    const fd = new FormData(form);
    fd.set("kind", kind);
    const res = await createCashEntryAction(fd);
    if (res.error) setErr(res.error);
    else { setErr(null); form.reset(); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">BDT Cash Book</h2>
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          Month
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input text-sm" aria-label="Month" />
        </label>
      </div>
      {err && <p className="text-xs text-bad">{err}</p>}

      {/* Monthly summary */}
      <div className="overflow-x-auto rounded-sm border border-line bg-surface">
        <div className="border-b border-line bg-paper px-4 py-2"><h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Monthly summary</h3></div>
        <table className="w-full text-sm">
          <tbody>
            <SumRow label="Opening balance" value={opening} />
            <SumRow label="Total BDT received" value={totalReceived} tone="ok" />
            <SumRow label="Total BDT expenses" value={totalExpenses} tone="bad" />
            <tr className="border-t-2 border-ink font-semibold"><td className="px-4 py-2">Closing balance</td><td className="px-4 py-2 text-right tnum">{bdt(closing)}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Received */}
      <Section title="Monthly BDT received">
        {canManage && (
          <form onSubmit={(e) => { e.preventDefault(); add("RECEIVED", e.currentTarget); }} className="flex flex-wrap items-end gap-2 border-b border-line p-3">
            <input name="entryDate" type="date" required className="input text-xs" aria-label="Date" />
            <input name="amountBdt" inputMode="decimal" placeholder="Amount (BDT)" required className="input tnum w-28 text-right text-xs" aria-label="Amount" />
            <input name="sender" placeholder="Sender name" className="input text-xs" aria-label="Sender name" />
            <input name="purpose" list="cash-purposes" placeholder="Purpose" className="input text-xs" aria-label="Purpose" />
            <input name="note" placeholder="Remarks" className="input text-xs" aria-label="Remarks" />
            <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">+ Add received</button>
          </form>
        )}
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">Date</th><th className="px-3 py-2 text-right font-semibold">Amount (BDT)</th>
              <th className="px-3 py-2 font-semibold">Sender name</th><th className="px-3 py-2 font-semibold">Purpose</th>
              <th className="px-3 py-2 font-semibold">Remarks</th>{canDelete && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {received.length === 0 && <tr><td colSpan={canDelete ? 6 : 5} className="px-3 py-6 text-center text-ink-soft">No received entries this month.</td></tr>}
            {received.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 tnum text-xs">{formatDate(e.date)}</td>
                <td className="px-3 py-2 text-right tnum">{bdt(e.amountBdt)}</td>
                <td className="px-3 py-2">{e.sender || "—"}</td>
                <td className="px-3 py-2 text-xs">{e.purpose || "—"}</td>
                <td className="px-3 py-2 text-xs text-ink-soft">{e.note || "—"}</td>
                {canDelete && <td className="px-3 py-2"><RowDeleteButton id={e.id} action={deleteCashEntryAction} /></td>}
              </tr>
            ))}
          </tbody>
          {received.length > 0 && <tfoot><tr className="border-t-2 border-ink bg-paper font-semibold"><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right tnum">{bdt(totalReceived)}</td><td colSpan={canDelete ? 4 : 3} /></tr></tfoot>}
        </table>
      </Section>

      {/* Expenses */}
      <Section title="Monthly BDT expenses">
        {canManage && (
          <form onSubmit={(e) => { e.preventDefault(); add("EXPENSE", e.currentTarget); }} className="flex flex-wrap items-end gap-2 border-b border-line p-3">
            <input name="entryDate" type="date" required className="input text-xs" aria-label="Date" />
            <input name="amountBdt" inputMode="decimal" placeholder="Amount (BDT)" required className="input tnum w-28 text-right text-xs" aria-label="Amount" />
            <input name="head" list="cash-heads" placeholder="Expense head (or type a new one)" required className="input min-w-[14rem] text-xs" aria-label="Expense head" />
            <input name="note" placeholder="Remarks" className="input text-xs" aria-label="Remarks" />
            <button type="submit" className="rounded-sm bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">+ Add expense</button>
          </form>
        )}
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-semibold">Date</th><th className="px-3 py-2 text-right font-semibold">Amount (BDT)</th>
              <th className="px-3 py-2 font-semibold">Expense head</th><th className="px-3 py-2 font-semibold">Remarks</th>{canDelete && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && <tr><td colSpan={canDelete ? 5 : 4} className="px-3 py-6 text-center text-ink-soft">No expense entries this month.</td></tr>}
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 tnum text-xs">{formatDate(e.date)}</td>
                <td className="px-3 py-2 text-right tnum">{bdt(e.amountBdt)}</td>
                <td className="px-3 py-2 text-xs">{e.head || "—"}</td>
                <td className="px-3 py-2 text-xs text-ink-soft">{e.note || "—"}</td>
                {canDelete && <td className="px-3 py-2"><RowDeleteButton id={e.id} action={deleteCashEntryAction} /></td>}
              </tr>
            ))}
          </tbody>
          {expenses.length > 0 && <tfoot><tr className="border-t-2 border-ink bg-paper font-semibold"><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right tnum">{bdt(totalExpenses)}</td><td colSpan={canDelete ? 3 : 2} /></tr></tfoot>}
        </table>
      </Section>

      <datalist id="cash-heads">{headOpts.map((h) => <option key={h} value={h} />)}</datalist>
      <datalist id="cash-purposes">{purposeOpts.map((p) => <option key={p} value={p} />)}</datalist>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-sm border border-line bg-surface">
      <div className="border-b border-line bg-paper px-4 py-2"><h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{title}</h3></div>
      {children}
    </div>
  );
}

function SumRow({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" }) {
  const cls = tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "";
  return (
    <tr className="border-b border-line">
      <td className="px-4 py-2 text-ink-soft">{label}</td>
      <td className={`px-4 py-2 text-right tnum ${cls}`}>{bdt(value)}</td>
    </tr>
  );
}
