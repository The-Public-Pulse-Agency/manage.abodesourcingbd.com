import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { computeRag, plannedDateFor, startOfUtcDay, type Rag } from "./schedule";

/**
 * Create milestones for a PO from active templates. Idempotent: the `count > 0`
 * fast-path skips work, and @@unique([poId, key]) + skipDuplicates is the real guarantee.
 * Accepts a transaction client so confirm can run this atomically with the status flip.
 */
export async function instantiateMilestones(
  poId: string,
  client: Prisma.TransactionClient = prisma,
): Promise<void> {
  // No `actor` here (called inside confirm's transaction). The parent PO is the tenancy
  // anchor: derive companyId from it and scope all dependent queries + stamp created rows.
  const po = await client.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  const companyId = po.companyId;
  const existing = await client.taMilestone.count({ where: { poId, companyId } });
  if (existing > 0) return;
  const templates = await client.taMilestoneTemplate.findMany({
    where: { active: true, companyId },
    orderBy: { position: "asc" },
  });
  if (templates.length === 0) return; // seed must run; no milestones rather than a crash
  // Per-style follow-up: one milestone set per DISTINCT style on the PO. If the PO has no
  // lines yet, fall back to a single PO-level set (styleId null).
  const lines = await client.orderLine.findMany({ where: { poId, companyId }, select: { styleId: true } });
  const styleIds = [...new Set(lines.map((l) => l.styleId).filter(Boolean) as string[])];
  const targets: (string | null)[] = styleIds.length ? styleIds : [null];
  await client.taMilestone.createMany({
    data: targets.flatMap((styleId) =>
      templates.map((t) => ({
        companyId,
        poId,
        styleId,
        key: t.key,
        name: t.name,
        stage: t.stage,
        position: t.position,
        offsetDays: t.offsetDays,
        plannedDate: plannedDateFor(po.exFactoryDate, t.offsetDays),
      })),
    ),
    skipDuplicates: true,
  });
}

// Stages that are entirely pre-shipping. Within SHIPPING, only milestones on/before ex-factory
// (offsetDays <= 0, i.e. EX_FACTORY) are pre-shipping; BL/Telex (+7), TC (+10) and Payment (null)
// are post-shipping and are intentionally left for manual completion.
const PRE_SHIP_STAGES = ["PRE_PRODUCTION", "SAMPLING", "PRODUCTION_QC"] as const;

/**
 * When a shipment is recorded, the goods have left the factory — so every pre-shipping
 * critical-path activity (through Ex-factory) is implicitly done. Mark the incomplete ones done
 * for the shipped styles (+ any legacy PO-level set), leaving post-shipping steps (BL/Telex, TC,
 * Payment) to be updated manually. Runs inside the caller's transaction; returns how many it set.
 */
export async function autoCompletePreShipMilestones(
  tx: Prisma.TransactionClient,
  actor: SessionUser,
  poId: string,
  styleIds: string[],
  completedAt: Date,
): Promise<number> {
  const cid = tenantId(actor);
  const floored = startOfUtcDay(completedAt);
  const where: Prisma.TaMilestoneWhereInput = {
    companyId: cid,
    poId,
    actualDate: null,
    AND: [
      { OR: [{ styleId: { in: styleIds } }, { styleId: null }] },
      { OR: [{ stage: { in: [...PRE_SHIP_STAGES] } }, { stage: "SHIPPING", offsetDays: { lte: 0 } }] },
    ],
  };
  const toComplete = await tx.taMilestone.findMany({ where, select: { key: true } });
  if (toComplete.length === 0) return 0;
  await tx.taMilestone.updateMany({ where, data: { actualDate: floored } });
  await recordAudit(
    {
      userId: actor.id,
      entityType: "PurchaseOrder",
      entityId: poId,
      action: "edit",
      after: { autoCompletedMilestones: toComplete.map((m) => m.key), on: floored.toISOString() },
    },
    tx,
  );
  return toComplete.length;
}

/**
 * Complete the incomplete milestone(s) with a given `key` for a PO (optionally limited to
 * `styleIds` + any legacy PO-level set) — used when a downstream event implies a specific
 * milestone is done: telex received → BL_TELEX, payment realised → PAYMENT. Runs inside the
 * caller's transaction; returns how many it set.
 */
export async function completeMilestonesByKey(
  tx: Prisma.TransactionClient,
  actor: SessionUser,
  poId: string,
  key: string,
  completedAt: Date,
  styleIds?: string[],
): Promise<number> {
  const cid = tenantId(actor);
  const floored = startOfUtcDay(completedAt);
  const where: Prisma.TaMilestoneWhereInput = {
    companyId: cid,
    poId,
    key,
    actualDate: null,
    ...(styleIds && styleIds.length ? { OR: [{ styleId: { in: styleIds } }, { styleId: null }] } : {}),
  };
  const found = await tx.taMilestone.findMany({ where, select: { id: true } });
  if (found.length === 0) return 0;
  await tx.taMilestone.updateMany({ where, data: { actualDate: floored } });
  await recordAudit(
    { userId: actor.id, entityType: "PurchaseOrder", entityId: poId, action: "edit", after: { autoCompletedMilestone: key, on: floored.toISOString() } },
    tx,
  );
  return found.length;
}

/**
 * Re-stamp the actualDate of ALREADY-completed milestone(s) with `key` for a PO (overwriting) —
 * keeps EX_FACTORY in sync when a shipment's ex-factory date is corrected after creation. Only
 * touches milestones already done (actualDate set), so it never silently completes an open step.
 */
export async function restampMilestoneActual(
  tx: Prisma.TransactionClient,
  actor: SessionUser,
  poId: string,
  key: string,
  actualDate: Date,
  styleIds?: string[],
): Promise<number> {
  const cid = tenantId(actor);
  const floored = startOfUtcDay(actualDate);
  const where: Prisma.TaMilestoneWhereInput = {
    companyId: cid,
    poId,
    key,
    actualDate: { not: null },
    ...(styleIds && styleIds.length ? { OR: [{ styleId: { in: styleIds } }, { styleId: null }] } : {}),
  };
  const res = await tx.taMilestone.updateMany({ where, data: { actualDate: floored } });
  if (res.count > 0) {
    await recordAudit(
      { userId: actor.id, entityType: "PurchaseOrder", entityId: poId, action: "edit", after: { restampedMilestone: key, on: floored.toISOString() } },
      tx,
    );
  }
  return res.count;
}

export async function completeMilestone(actor: SessionUser, id: string, actualDate: Date) {
  assertPermission(actor, "criticalPath", "edit");
  const before = await prisma.taMilestone.findFirst({ where: { id, companyId: tenantId(actor) } });
  if (!before) throw new Error("Milestone not found");
  const floored = startOfUtcDay(actualDate);
  await prisma.taMilestone.updateMany({
    where: { id, companyId: tenantId(actor) },
    data: { actualDate: floored },
  });
  const updated = await prisma.taMilestone.findFirstOrThrow({
    where: { id, companyId: tenantId(actor) },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "TaMilestone",
    entityId: id,
    action: "edit",
    before: { actualDate: before.actualDate?.toISOString() ?? null },
    after: { actualDate: floored.toISOString() },
  });
  return updated;
}

export async function rescheduleMilestone(actor: SessionUser, id: string, plannedDate: Date) {
  assertPermission(actor, "criticalPath", "edit");
  const before = await prisma.taMilestone.findFirst({ where: { id, companyId: tenantId(actor) } });
  if (!before) throw new Error("Milestone not found");
  const floored = startOfUtcDay(plannedDate);
  await prisma.taMilestone.updateMany({
    where: { id, companyId: tenantId(actor) },
    data: { plannedDate: floored },
  });
  const updated = await prisma.taMilestone.findFirstOrThrow({
    where: { id, companyId: tenantId(actor) },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "TaMilestone",
    entityId: id,
    action: "edit",
    before: { plannedDate: before.plannedDate?.toISOString() ?? null },
    after: { plannedDate: floored.toISOString() },
  });
  return updated;
}

/**
 * Re-base all not-yet-completed milestones of a PO from its current ex-factory date,
 * using each milestone's snapshot offset. Completed (actual-dated) milestones are left
 * untouched. Call this whenever ex-factory changes.
 */
export async function rebaseMilestones(actor: SessionUser, poId: string): Promise<number> {
  assertPermission(actor, "criticalPath", "edit");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
  });
  if (!po) throw new Error("Purchase order not found");
  const open = await prisma.taMilestone.findMany({
    where: { poId, actualDate: null, companyId: tenantId(actor) },
  });
  let updated = 0;
  for (const m of open) {
    await prisma.taMilestone.updateMany({
      where: { id: m.id, companyId: tenantId(actor) },
      data: { plannedDate: plannedDateFor(po.exFactoryDate, m.offsetDays) },
    });
    updated += 1;
  }
  await recordAudit({
    userId: actor.id,
    entityType: "PurchaseOrder",
    entityId: poId,
    action: "edit",
    after: {
      rebasedMilestones: updated,
      exFactoryDate: po.exFactoryDate?.toISOString() ?? null,
    },
  });
  return updated;
}

export type MilestoneView = {
  id: string;
  key: string;
  name: string;
  stage: string;
  position: number;
  plannedDate: Date | null;
  actualDate: Date | null;
  note: string | null;
  rag: Rag;
  style: string | null; // styleCode this milestone belongs to (null = PO-level / legacy)
};

export async function listPoMilestones(
  actor: SessionUser,
  poId: string,
  now: Date,
): Promise<MilestoneView[]> {
  assertPermission(actor, "criticalPath", "view");
  const ms = await prisma.taMilestone.findMany({
    where: { poId, companyId: tenantId(actor) },
    include: { style: { select: { styleCode: true } } },
    orderBy: [{ styleId: "asc" }, { position: "asc" }],
  });
  return ms.map((m) => ({
    id: m.id,
    key: m.key,
    name: m.name,
    stage: m.stage,
    position: m.position,
    plannedDate: m.plannedDate,
    actualDate: m.actualDate,
    note: m.note,
    rag: computeRag(m.plannedDate, m.actualDate, now),
    style: m.style?.styleCode ?? null,
  }));
}

/** Set/clear a milestone's free-text note (e.g. "repeat style — no PP sample required"). */
export async function setMilestoneNote(actor: SessionUser, id: string, note: string) {
  assertPermission(actor, "criticalPath", "edit");
  const existing = await prisma.taMilestone.findFirst({ where: { id, companyId: tenantId(actor) }, select: { id: true } });
  if (!existing) throw new Error("Milestone not found");
  const value = note.trim() || null;
  await prisma.taMilestone.updateMany({ where: { id, companyId: tenantId(actor) }, data: { note: value } });
  await recordAudit({ userId: actor.id, entityType: "TaMilestone", entityId: id, action: "edit", after: { note: value } });
}
