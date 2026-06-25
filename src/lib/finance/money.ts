type Decimalish = number | string | { toString(): string };
type Paid = { amount: Decimalish };

function cents(v: Decimalish): number {
  return Math.round(Number(v.toString()) * 100);
}

/** Invoice amount minus all payments, floored at 0, computed in integer cents. */
export function outstanding(amount: Decimalish, payments: Paid[]): number {
  const paid = payments.reduce((a, p) => a + cents(p.amount), 0);
  return Math.max(0, cents(amount) - paid) / 100;
}

/** Fully settled per the payment ledger — the single source of truth for "is this paid". */
export function isSettled(amount: Decimalish, payments: Paid[]): boolean {
  return outstanding(amount, payments) <= 0;
}

/** Payment status derived from the ledger (mirrors recomputeInvoiceStatus), not the stored flag. */
export function derivedPaymentStatus(amount: Decimalish, payments: Paid[]): "ISSUED" | "PARTIALLY_PAID" | "PAID" {
  if (outstanding(amount, payments) <= 0) return "PAID";
  return payments.length ? "PARTIALLY_PAID" : "ISSUED";
}

export type AgeBucketKey = "0-30" | "31-60" | "61-90" | "90+";

export function ageBucket(issueDate: Date, now: Date): AgeBucketKey {
  const days = Math.floor((now.getTime() - issueDate.getTime()) / 86_400_000);
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}
