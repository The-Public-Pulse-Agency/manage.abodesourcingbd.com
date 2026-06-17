import { prisma } from "@/lib/db";
import { businessToday, addDaysUtc } from "@/lib/tna/schedule";
import { outstanding } from "@/lib/finance/money";
import type { AlertData } from "./rules";

// Same live-order set the dashboard's exFtyDue7d uses — keep these identical.
const LIVE_STATUSES = ["CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED"] as const;
// Milestones can only exist on confirmed+ orders; exclude paused/finished (matches board).
const BOARD_EXCLUDED = ["CLOSED", "CANCELLED", "ON_HOLD"] as const;
const DOC_TYPES = ["BL", "COMMERCIAL_INVOICE", "PACKING_LIST"] as const;
const PAYMENT_OVERDUE_DAYS = 30; // issue-age proxy; aligns with ageBucket (overdue at age >=31)

/** Fetch everything the alert rules need for ONE company, windowed on the Dhaka day. */
export async function fetchAlertData(now: Date, companyId: string): Promise<AlertData> {
  const today = businessToday(now);
  const windowEnd = addDaysUtc(today, 8); // [today, today+8) = today..+7 inclusive
  const paymentCutoff = addDaysUtc(today, -PAYMENT_OVERDUE_DAYS); // issueDate < cutoff => age >= 31

  const [milestones, exFtyPos, agedInvoices, samples] = await Promise.all([
    prisma.taMilestone.findMany({
      where: {
        companyId,
        actualDate: null,
        plannedDate: { not: null, lt: today },
        po: { status: { notIn: [...BOARD_EXCLUDED] } },
      },
      include: { po: true },
      orderBy: { plannedDate: "asc" },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        companyId,
        status: { in: [...LIVE_STATUSES] },
        exFactoryDate: { gte: today, lt: windowEnd },
      },
      orderBy: { exFactoryDate: "asc" },
    }),
    prisma.invoice.findMany({
      // Overdue = past its due date, or (no due date set) aged >30d since issue.
      where: {
        companyId,
        OR: [
          { dueDate: { lt: today } },
          { dueDate: null, issueDate: { lt: paymentCutoff } },
        ],
      },
      include: { payments: true },
    }),
    prisma.sampleRequest.findMany({
      where: { companyId, status: "PENDING", sentDate: { not: null } },
      include: { po: true },
    }),
  ]);

  // docsMissing: live POs in the ex-fty window with NO BL/CI/PL document — one set query.
  const poIds = exFtyPos.map((p) => p.id);
  const docs = poIds.length
    ? await prisma.document.findMany({
        where: { companyId, entityType: "PurchaseOrder", type: { in: [...DOC_TYPES] }, entityId: { in: poIds } },
        select: { entityId: true },
      })
    : [];
  const haveDocs = new Set(docs.map((d) => d.entityId));

  return {
    milestonesOverdue: milestones.map((m) => ({
      id: m.id,
      poId: m.poId,
      poNumber: m.po.poNumber,
      name: m.name,
    })),
    exFtySoon: exFtyPos.map((p) => ({
      poId: p.id,
      poNumber: p.poNumber,
      exFactoryDate: p.exFactoryDate!,
    })),
    paymentsOverdue: agedInvoices
      .filter((inv) => outstanding(inv.amount, inv.payments) > 0)
      .map((inv) => ({ invoiceId: inv.id, number: inv.number, poId: inv.poId })),
    samplesPending: samples.map((s) => ({
      id: s.id,
      poId: s.poId,
      poNumber: s.po.poNumber,
      type: s.type,
      daysPending: Math.floor((today.getTime() - s.sentDate!.getTime()) / 86_400_000),
    })),
    docsMissing: exFtyPos
      .filter((p) => !haveDocs.has(p.id))
      .map((p) => ({ poId: p.id, poNumber: p.poNumber })),
  };
}
