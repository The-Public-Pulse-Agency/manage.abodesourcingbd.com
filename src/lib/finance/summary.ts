import type { Invoice, Payment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { outstanding, ageBucket, isSettled, type AgeBucketKey } from "./money";

export type AgingRow = {
  invoiceId: string;
  type: string;
  number: string;
  outstanding: number;
  bucket: AgeBucketKey;
  dueDate: Date | null;
};

export type FinanceSummary = {
  receivableOutstanding: number;
  payableOutstanding: number;
  realisedMargin: number;
  aging: AgingRow[];
};

function cents(v: { toString(): string }): number {
  return Math.round(Number(v.toString()) * 100);
}

export async function financeSummary(actor: SessionUser, opts: { now: Date }): Promise<FinanceSummary> {
  assertPermission(actor, "finance", "view");
  // Platform finance KPIs are USD-scoped (single-currency contract — see
  // lib/orders/money.ts): receivable/payable/realised-margin must not mix
  // currencies, and these totals carry no FX conversion. Non-USD invoices
  // (EUR/BDT/etc.) are intentionally excluded from these rollups.
  const invoices = await prisma.invoice.findMany({
    where: { companyId: tenantId(actor), currency: "USD" },
    include: { payments: true },
  });

  let receivableOutstanding = 0;
  let payableOutstanding = 0;
  const aging: AgingRow[] = [];
  type InvWithPayments = Invoice & { payments: Payment[] };
  const byPo = new Map<string, { buyer: InvWithPayments[]; factory: InvWithPayments[] }>();

  for (const inv of invoices as InvWithPayments[]) {
    const out = outstanding(inv.amount, inv.payments);
    if (out > 0) {
      if (inv.type === "BUYER") receivableOutstanding += out;
      else payableOutstanding += out;
      aging.push({
        invoiceId: inv.id,
        type: inv.type,
        number: inv.number,
        outstanding: out,
        // Age off the payment due date when set (true past-due); fall back to issue date.
        bucket: ageBucket(inv.dueDate ?? inv.issueDate, opts.now),
        dueDate: inv.dueDate,
      });
    }
    if (inv.poId) {
      const g = byPo.get(inv.poId) ?? { buyer: [], factory: [] };
      (inv.type === "BUYER" ? g.buyer : g.factory).push(inv);
      byPo.set(inv.poId, g);
    }
  }

  // Realised margin (spec §9④): a PO's margin is realised only when every buyer AND
  // every factory invoice for it is fully settled per the payment ledger (not the status flag,
  // which a manual override could desync from the actual payments).
  let realisedCents = 0;
  for (const g of byPo.values()) {
    if (g.buyer.length === 0 || g.factory.length === 0) continue;
    if (![...g.buyer, ...g.factory].every((i) => isSettled(i.amount, i.payments))) continue;
    realisedCents += g.buyer.reduce((a, i) => a + cents(i.amount), 0);
    realisedCents -= g.factory.reduce((a, i) => a + cents(i.amount), 0);
  }

  return {
    receivableOutstanding: Math.round(receivableOutstanding * 100) / 100,
    payableOutstanding: Math.round(payableOutstanding * 100) / 100,
    realisedMargin: realisedCents / 100,
    aging,
  };
}
