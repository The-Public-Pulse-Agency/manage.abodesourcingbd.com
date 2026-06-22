import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

/** Fixed expense heads for the BDT cash book (office expenses). */
export const EXPENSE_HEADS = [
  "Salary & Allowances",
  "Festival Bonus",
  "Office Rent",
  "Utility Bill & Service Charges",
  "Internet Bill",
  "Mobile Bill",
  "Office Supplies & Maintenance",
  "Conveyance & Rent-a-Car",
  "Fuel, Oil & Vehicle Maintenance",
  "Fooding Expense / Lunch Bill",
  "Entertainment Expense",
  "Business Tour Expense",
  "Postage & Courier Charges",
  "C&F Bill (Clearing & Forwarding)",
  "Lab Expense / Lab Test Charges",
  "Bank Charges",
  "AIT on Remittance",
  "Tax & VAT on Expenses",
  "Annual Tax Return Submission / Withholding Tax Return Expenses",
  "Other Administrative Expenses",
  "Miscellaneous Expenses",
  "Others (if any)",
] as const;

/** Example purposes for received money (suggestions only — any text allowed). */
export const RECEIVED_PURPOSES = [
  "Commission Income",
  "Service Charge",
  "Sample Cost Reimbursement",
  "Inspection Charge",
  "Capital Introduction",
  "Loan Received",
  "Other Income",
] as const;

export type CashKind = "RECEIVED" | "EXPENSE";
export type CashEntryRow = {
  id: string;
  kind: CashKind;
  entryDate: Date;
  amountBdt: number;
  sender: string | null;
  purpose: string | null;
  head: string | null;
  note: string | null;
};

export async function listCashEntries(actor: SessionUser): Promise<CashEntryRow[]> {
  assertPermission(actor, "finance", "view");
  const rows = await prisma.cashEntry.findMany({
    where: { companyId: tenantId(actor) },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as CashKind,
    entryDate: r.entryDate,
    amountBdt: Number(r.amountBdt),
    sender: r.sender,
    purpose: r.purpose,
    head: r.head,
    note: r.note,
  }));
}

const cashSchema = z.object({
  kind: z.enum(["RECEIVED", "EXPENSE"]),
  entryDate: z.coerce.date(),
  amountBdt: z.coerce.number().positive("Amount must be greater than 0"),
  sender: z.string().optional(),
  purpose: z.string().optional(),
  head: z.string().optional(),
  note: z.string().optional(),
});
export type CreateCashInput = z.input<typeof cashSchema>;

export async function createCashEntry(actor: SessionUser, input: CreateCashInput) {
  assertPermission(actor, "finance", "create");
  const d = cashSchema.parse(input);
  if (d.kind === "EXPENSE" && !(d.head && d.head.trim())) throw new Error("Choose an expense head");
  const entry = await prisma.cashEntry.create({
    data: {
      companyId: tenantId(actor),
      kind: d.kind,
      entryDate: d.entryDate,
      amountBdt: d.amountBdt,
      sender: d.kind === "RECEIVED" ? d.sender?.trim() || null : null,
      purpose: d.kind === "RECEIVED" ? d.purpose?.trim() || null : null,
      head: d.kind === "EXPENSE" ? d.head?.trim() || null : null,
      note: d.note?.trim() || null,
      createdById: actor.id,
    },
  });
  await recordAudit({ userId: actor.id, entityType: "CashEntry", entityId: entry.id, action: "create", after: { kind: d.kind, amountBdt: d.amountBdt, head: entry.head, sender: entry.sender } });
  return entry;
}

export async function deleteCashEntry(actor: SessionUser, id: string) {
  assertPermission(actor, "finance", "delete");
  await prisma.cashEntry.deleteMany({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "CashEntry", entityId: id, action: "delete" });
}

/** Month bucket key, e.g. "2026-06" (UTC — entries are stored at day granularity). */
export function monthKey(d: Date): string {
  return new Date(d).toISOString().slice(0, 7);
}

/**
 * Monthly cash-book summary: opening balance (net of all prior months), this month's
 * received + expenses, closing balance, and a per-expense-head breakdown.
 */
export function cashSummary(rows: CashEntryRow[], month: string) {
  let opening = 0;
  for (const r of rows) {
    if (monthKey(r.entryDate) < month) opening += r.kind === "RECEIVED" ? r.amountBdt : -r.amountBdt;
  }
  const inMonth = rows.filter((r) => monthKey(r.entryDate) === month);
  const received = inMonth.filter((r) => r.kind === "RECEIVED").reduce((a, r) => a + r.amountBdt, 0);
  const expenses = inMonth.filter((r) => r.kind === "EXPENSE").reduce((a, r) => a + r.amountBdt, 0);
  const byHeadMap = new Map<string, number>();
  for (const r of inMonth) if (r.kind === "EXPENSE") byHeadMap.set(r.head ?? "—", (byHeadMap.get(r.head ?? "—") ?? 0) + r.amountBdt);
  const byHead = [...byHeadMap.entries()].map(([head, amount]) => ({ head, amount })).sort((a, b) => b.amount - a.amount);
  return { opening, received, expenses, closing: opening + received - expenses, byHead };
}
