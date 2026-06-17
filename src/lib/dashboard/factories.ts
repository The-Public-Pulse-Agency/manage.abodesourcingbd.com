import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { lineMills, rollup, type Decimalish } from "@/lib/orders/money";
import { otdPercent } from "./kpi";

const LIVE_STATUSES = ["DRAFT", "CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED"] as const;

export type FactoryScore = {
  factoryId: string;
  name: string;
  type: string;
  openOrders: number;
  openValueUsd: number;
  otdPct: number | null; // on-time % on completed ex-factory milestones
  otdCompleted: number;
  aqlPct: number | null; // final-inspection pass rate
  aqlCount: number;
};

/** Per-factory performance league table — OTD %, final-AQL pass rate, open-order load. */
export async function factoryLeagueTable(actor: SessionUser, opts: { now?: Date } = {}): Promise<FactoryScore[]> {
  assertPermission(actor, "dashboards", "view");

  const [factories, livePos, exMilestones, finalInspections] = await Promise.all([
    prisma.factory.findMany({ where: { active: true, companyId: tenantId(actor) }, select: { id: true, name: true, type: true } }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: [...LIVE_STATUSES] }, currency: "USD", companyId: tenantId(actor) },
      select: { factoryId: true, lines: { select: { sizes: true } } },
    }),
    prisma.taMilestone.findMany({
      where: { key: "EX_FACTORY", actualDate: { not: null }, companyId: tenantId(actor) },
      select: { plannedDate: true, actualDate: true, po: { select: { factoryId: true } } },
    }),
    prisma.inspection.findMany({
      // Final-AQL pass rate: only inspections on live orders count (exclude CANCELLED/CLOSED
      // POs); re-inspections are deduped to the latest FINAL per PO below.
      where: { type: "FINAL", companyId: tenantId(actor), po: { status: { notIn: ["CANCELLED", "CLOSED"] } } },
      select: { poId: true, result: true, date: true, createdAt: true, po: { select: { factoryId: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const openByFactory = new Map<string, { count: number; mills: ReturnType<typeof lineMills>[] }>();
  for (const po of livePos) {
    const g = openByFactory.get(po.factoryId) ?? { count: 0, mills: [] };
    g.count += 1;
    for (const l of po.lines) g.mills.push(lineMills(l.sizes as { qty: number; netFob: Decimalish; sellFob: Decimalish }[]));
    openByFactory.set(po.factoryId, g);
  }

  const exByFactory = new Map<string, { plannedDate: Date | null; actualDate: Date | null }[]>();
  for (const m of exMilestones) {
    const fid = m.po.factoryId;
    const arr = exByFactory.get(fid) ?? [];
    arr.push({ plannedDate: m.plannedDate, actualDate: m.actualDate });
    exByFactory.set(fid, arr);
  }

  // Dedup to the latest FINAL inspection per PO so a re-inspection doesn't double-count.
  // Rows arrive ordered by (date, createdAt) asc, so the last write per PO is the newest
  // (createdAt breaks same-day ties).
  const latestByPo = new Map<string, (typeof finalInspections)[number]>();
  for (const i of finalInspections) latestByPo.set(i.poId, i);

  const aqlByFactory = new Map<string, { pass: number; total: number }>();
  for (const i of latestByPo.values()) {
    const fid = i.po.factoryId;
    const a = aqlByFactory.get(fid) ?? { pass: 0, total: 0 };
    a.total += 1;
    if (i.result === "PASS") a.pass += 1;
    aqlByFactory.set(fid, a);
  }

  return factories
    .map((f) => {
      const open = openByFactory.get(f.id);
      const otd = otdPercent(exByFactory.get(f.id) ?? []);
      const aql = aqlByFactory.get(f.id);
      return {
        factoryId: f.id,
        name: f.name,
        type: f.type,
        openOrders: open?.count ?? 0,
        openValueUsd: open ? rollup(open.mills).value : 0,
        otdPct: otd.pct,
        otdCompleted: otd.completed,
        aqlPct: aql && aql.total > 0 ? Math.round((aql.pass / aql.total) * 10000) / 100 : null,
        aqlCount: aql?.total ?? 0,
      };
    })
    .sort((a, b) => b.openValueUsd - a.openValueUsd || b.openOrders - a.openOrders);
}
