import type { Invoice, Payment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { outstanding, ageBucket, type AgeBucketKey } from "./money";

export type AgingRow = {
  invoiceId: string;
  type: string;
  number: string;
  outstanding: number;
  bucket: AgeBucketKey;
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
  const invoices = await prisma.invoice.findMany({ include: { payments: true } });

  let receivableOutstanding = 0;
  let payableOutstanding = 0;
  const aging: AgingRow[] = [];
  const byPo = new Map<string, { buyer: Invoice[]; factory: Invoice[] }>();

  for (const inv of invoices as (Invoice & { payments: Payment[] })[]) {
    const out = outstanding(inv.amount, inv.payments);
    if (out > 0) {
      if (inv.type === "BUYER") receivableOutstanding += out;
      else payableOutstanding += out;
      aging.push({
        invoiceId: inv.id,
        type: inv.type,
        number: inv.number,
        outstanding: out,
        bucket: ageBucket(inv.issueDate, opts.now),
      });
    }
    if (inv.poId) {
      const g = byPo.get(inv.poId) ?? { buyer: [], factory: [] };
      (inv.type === "BUYER" ? g.buyer : g.factory).push(inv);
      byPo.set(inv.poId, g);
    }
  }

  // Realised margin (spec §9④): a PO's margin is realised only when every buyer AND
  // every factory invoice for it is PAID.
  let realisedCents = 0;
  for (const g of byPo.values()) {
    if (g.buyer.length === 0 || g.factory.length === 0) continue;
    if (![...g.buyer, ...g.factory].every((i) => i.status === "PAID")) continue;
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
