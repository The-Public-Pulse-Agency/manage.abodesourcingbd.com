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
  await client.taMilestone.createMany({
    data: templates.map((t) => ({
      companyId,
      poId,
      key: t.key,
      name: t.name,
      stage: t.stage,
      position: t.position,
      offsetDays: t.offsetDays,
      plannedDate: plannedDateFor(po.exFactoryDate, t.offsetDays),
    })),
    skipDuplicates: true,
  });
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
};

export async function listPoMilestones(
  actor: SessionUser,
  poId: string,
  now: Date,
): Promise<MilestoneView[]> {
  assertPermission(actor, "criticalPath", "view");
  const ms = await prisma.taMilestone.findMany({
    where: { poId, companyId: tenantId(actor) },
    orderBy: { position: "asc" },
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
