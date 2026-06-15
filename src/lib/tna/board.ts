import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
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
