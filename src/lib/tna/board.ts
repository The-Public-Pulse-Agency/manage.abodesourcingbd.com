import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { addDaysUtc, computeRag, startOfUtcDay, DUE_SOON_DAYS, type Rag } from "./schedule";

// The attention board is an exception view: paused (ON_HOLD) and finished orders are
// intentionally excluded (this differs from the full Open Order Book on purpose).
const ATTENTION_EXCLUDED = ["CLOSED", "CANCELLED", "ON_HOLD"] as const;

export type BoardItem = {
  id: string;
  poId: string;
  poNumber: string;
  buyer: string;
  factory: string;
  name: string;
  stage: string;
  plannedDate: Date | null;
  actualDate: Date | null;
  rag: Rag;
};

export type StageProgress = { stage: string; total: number; done: number; overdue: number };
export type CriticalPathSummary = {
  total: number; done: number; overdue: number; dueSoon: number; pending: number;
  pctComplete: number | null; byStage: StageProgress[];
};

const STAGE_ORDER = ["PRE_PRODUCTION", "SAMPLING", "PRODUCTION_QC", "SHIPPING"];

/** Milestone-completion overview across all live orders (for the Critical Path summary). */
export async function criticalPathSummary(actor: SessionUser, opts: { now: Date }): Promise<CriticalPathSummary> {
  assertPermission(actor, "criticalPath", "view");
  const nowFloor = startOfUtcDay(opts.now);
  const due = addDaysUtc(nowFloor, DUE_SOON_DAYS + 1);
  const rows = await prisma.taMilestone.findMany({
    where: { companyId: tenantId(actor), po: { status: { notIn: [...ATTENTION_EXCLUDED] } } },
    select: { stage: true, actualDate: true, plannedDate: true },
  });
  let done = 0, overdue = 0, dueSoon = 0, pending = 0;
  const stageMap = new Map<string, StageProgress>();
  for (const m of rows) {
    const sp = stageMap.get(m.stage) ?? { stage: m.stage, total: 0, done: 0, overdue: 0 };
    sp.total++;
    if (m.actualDate) { done++; sp.done++; }
    else if (m.plannedDate && m.plannedDate < nowFloor) { overdue++; sp.overdue++; }
    else if (m.plannedDate && m.plannedDate < due) dueSoon++;
    else pending++;
    stageMap.set(m.stage, sp);
  }
  const byStage = [...stageMap.values()].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  return {
    total: rows.length, done, overdue, dueSoon, pending,
    pctComplete: rows.length ? Math.round((done / rows.length) * 100) : null,
    byStage,
  };
}

export async function criticalPathBoard(
  actor: SessionUser,
  opts: { now: Date; withinDays?: number },
): Promise<BoardItem[]> {
  assertPermission(actor, "criticalPath", "view");
  const withinDays = opts.withinDays ?? DUE_SOON_DAYS;
  const nowFloor = startOfUtcDay(opts.now);
  // Exclusive upper bound = midnight of the day AFTER the last due-soon day, so the
  // SQL window is day-aligned and matches computeRag exactly (time-of-day independent).
  const horizon = addDaysUtc(nowFloor, withinDays + 1);

  const rows = await prisma.taMilestone.findMany({
    where: {
      companyId: tenantId(actor),
      actualDate: null,
      plannedDate: { not: null, lt: horizon },
      po: { status: { notIn: [...ATTENTION_EXCLUDED] } },
    },
    include: { po: { include: { buyer: true, factory: true } } },
    orderBy: { plannedDate: "asc" },
  });

  return rows
    .map((m) => ({
      id: m.id,
      poId: m.poId,
      poNumber: m.po.poNumber,
      buyer: m.po.buyer.name,
      factory: m.po.factory.name,
      name: m.name,
      stage: m.stage,
      plannedDate: m.plannedDate,
      actualDate: m.actualDate,
      // RAG uses the canonical due-soon window so a milestone's colour is identical here
      // and on the per-PO timeline; withinDays only widens which rows are fetched.
      rag: computeRag(m.plannedDate, m.actualDate, nowFloor),
    }))
    .filter((b) => b.rag === "OVERDUE" || b.rag === "DUE_SOON");
}
