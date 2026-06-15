import type { NotificationType } from "@prisma/client";
import type { Role } from "@/lib/auth/permissions";

// Recipients per rule. dedup is per-(user,key), so each named role's active users each
// get exactly one row. Merch-flow rules go to merchandisers; money rules to accounts.
const MERCH: Role[] = ["MERCHANDISER", "ADMIN"];
const ACCOUNTS: Role[] = ["ACCOUNTS", "ADMIN"];

export type AlertDraft = {
  type: NotificationType;
  message: string;
  link: string;
  dedupKey: string;
  roles: Role[];
};

export type AlertData = {
  milestonesOverdue: { id: string; poId: string; poNumber: string; name: string }[];
  exFtySoon: { poId: string; poNumber: string; exFactoryDate: Date }[];
  paymentsOverdue: { invoiceId: string; number: string; poId: string | null }[];
  samplesPending: { id: string; poId: string; poNumber: string; type: string }[];
  docsMissing: { poId: string; poNumber: string }[];
};

const ISO = (d: Date) => d.toISOString().slice(0, 10);

/** Map current state to desired alerts. Pure & deterministic — no `now`, no DB. */
export function computeAlerts(d: AlertData): AlertDraft[] {
  const out: AlertDraft[] = [];

  for (const m of d.milestonesOverdue) {
    out.push({
      type: "MILESTONE_OVERDUE",
      message: `Milestone overdue: ${m.name} (PO ${m.poNumber})`,
      link: `/orders/${m.poId}`,
      dedupKey: `milestone-overdue:${m.id}`,
      roles: MERCH,
    });
  }

  for (const p of d.exFtySoon) {
    out.push({
      type: "EX_FACTORY_SOON",
      message: `Ex-factory due ${ISO(p.exFactoryDate)} (PO ${p.poNumber})`,
      link: `/orders/${p.poId}`,
      dedupKey: `ex-fty-7d:${p.poId}`,
      roles: MERCH,
    });
  }

  for (const p of d.paymentsOverdue) {
    out.push({
      type: "PAYMENT_OVERDUE",
      message: `Payment overdue: invoice ${p.number}`,
      link: p.poId ? `/orders/${p.poId}` : "/finance",
      dedupKey: `payment-overdue:${p.invoiceId}`,
      roles: ACCOUNTS,
    });
  }

  for (const s of d.samplesPending) {
    out.push({
      type: "SAMPLE_PENDING",
      message: `Sample awaiting approval: ${s.type} (PO ${s.poNumber})`,
      link: `/orders/${s.poId}`,
      dedupKey: `sample-pending:${s.id}`,
      roles: MERCH,
    });
  }

  for (const p of d.docsMissing) {
    out.push({
      type: "DOC_MISSING",
      message: `Shipping docs missing before ex-factory (PO ${p.poNumber})`,
      link: `/orders/${p.poId}`,
      dedupKey: `doc-missing:${p.poId}`,
      roles: MERCH,
    });
  }

  return out;
}
