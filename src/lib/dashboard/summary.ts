import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { financeSummary, type FinanceSummary } from "@/lib/finance/summary";
import { criticalPathBoard } from "@/lib/tna/board";
import { businessToday, addDaysUtc } from "@/lib/tna/schedule";
import { lineMills, rollup, type Decimalish } from "@/lib/orders/money";
import { otdPercent, type OtdResult } from "./kpi";

// Live = active pipeline shown on the Open Order Book (everything not finished/cancelled).
// Includes DRAFT so newly-imported/negotiating orders count toward the pipeline.
const LIVE_STATUSES = ["DRAFT", "CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED"] as const;

export type ExFtyDueItem = {
  poId: string;
  poNumber: string;
  buyer: string;
  factory: string;
  exFactoryDate: Date;
};

export type TelexPendingItem = { id: string; reference: string; blNumber: string | null };

export type DashboardSummary = {
  openOrders: { count: number; value: number }; // value = USD sell value of live POs
  otd: OtdResult;
  finance: { receivable: number; payable: number; realisedMargin: number };
  exceptions: {
    exFtyDue7d: ExFtyDueItem[];
    overdueMilestones: number;
    dueSoonMilestones: number;
    telexPending: TelexPendingItem[];
    paymentOverdue: number; // outstanding invoices aged >30d since issue (issue-age proxy)
  };
};

export async function dashboardSummary(
  actor: SessionUser,
  opts: { now: Date },
): Promise<DashboardSummary> {
  assertPermission(actor, "dashboards", "view");
  // Floor `now` to the Dhaka business day ONCE and pass it everywhere a `now` is
  // expected — keeps the dashboard's finance aging + milestone RAG in lock-step with
  // the alert engine for evening-UTC renders. startOfUtcDay/ageBucket are idempotent
  // on an already-floored date.
  const today = businessToday(opts.now);

  // The dashboard only requires dashboards:view. Its finance + critical-path widgets are
  // enrichment — gate each on its own permission so a role with dashboard access but reduced
  // permissions (e.g. a merchandiser without finance:view) sees zeros instead of a 500.
  const zeroFinance: FinanceSummary = { receivableOutstanding: 0, payableOutstanding: 0, realisedMargin: 0, aging: [] };
  const [livePos, exFtyMilestones, finance, board] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { status: { in: [...LIVE_STATUSES] }, companyId: tenantId(actor) },
      include: { buyer: true, factory: true, lines: { include: { sizes: true } } },
    }),
    prisma.taMilestone.findMany({ where: { key: "EX_FACTORY", actualDate: { not: null }, companyId: tenantId(actor) } }),
    can(actor, "finance", "view") ? financeSummary(actor, { now: today }) : Promise.resolve(zeroFinance),
    can(actor, "criticalPath", "view") ? criticalPathBoard(actor, { now: today }) : Promise.resolve([]),
  ]);

  // Open Order Book value: sum sell totals only over USD POs (the money lib forbids
  // mixing currencies in one rollup; order-line FOB carries no currency tag).
  const usdLines = livePos
    .filter((p) => p.currency === "USD")
    .flatMap((p) => p.lines.map((l) => lineMills(l.sizes as { qty: number; netFob: Decimalish; sellFob: Decimalish }[])));
  const openOrdersValue = rollup(usdLines).value;

  const windowEnd = addDaysUtc(today, 8); // [today, today+8) = today..+7 inclusive
  const exFtyDue7d: ExFtyDueItem[] = livePos
    .filter((p) => p.exFactoryDate && p.exFactoryDate >= today && p.exFactoryDate < windowEnd)
    .sort((a, b) => a.exFactoryDate!.getTime() - b.exFactoryDate!.getTime())
    .map((p) => ({
      poId: p.id,
      poNumber: p.poNumber,
      buyer: p.buyer.name,
      factory: p.factory.name,
      exFactoryDate: p.exFactoryDate!,
    }));

  // "Telex pending" = telex not yet in hand. RECEIVED (and RELEASED) count as done; only a
  // shipment still at PENDING (with a BL issued) is awaiting telex.
  const telex = await prisma.shipment.findMany({
    where: { blNumber: { not: null }, telexStatus: "PENDING", companyId: tenantId(actor) },
    orderBy: { createdAt: "asc" },
  });

  return {
    openOrders: { count: livePos.length, value: openOrdersValue },
    otd: otdPercent(exFtyMilestones),
    finance: {
      receivable: finance.receivableOutstanding,
      payable: finance.payableOutstanding,
      realisedMargin: finance.realisedMargin,
    },
    exceptions: {
      exFtyDue7d,
      overdueMilestones: board.filter((b) => b.rag === "OVERDUE").length,
      dueSoonMilestones: board.filter((b) => b.rag === "DUE_SOON").length,
      telexPending: telex.map((s) => ({ id: s.id, reference: s.reference, blNumber: s.blNumber })),
      paymentOverdue: finance.aging.filter((a) => a.bucket !== "0-30").length,
    },
  };
}
