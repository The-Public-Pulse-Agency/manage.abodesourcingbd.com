import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
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
  const existing = await client.taMilestone.count({ where: { poId } });
  if (existing > 0) return;
  const po = await client.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  const templates = await client.taMilestoneTemplate.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
  });
  if (templates.length === 0) return; // seed must run; no milestones rather than a crash
  await client.taMilestone.createMany({
    data: templates.map((t) => ({
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
  const before = await prisma.taMilestone.findUniqueOrThrow({ where: { id } });
  const floored = startOfUtcDay(actualDate);
  const updated = await prisma.taMilestone.update({
    where: { id },
    data: { actualDate: floored },
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
  const before = await prisma.taMilestone.findUniqueOrThrow({ where: { id } });
  const floored = startOfUtcDay(plannedDate);
  const updated = await prisma.taMilestone.update({
    where: { id },
    data: { plannedDate: floored },
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
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  const open = await prisma.taMilestone.findMany({ where: { poId, actualDate: null } });
  let updated = 0;
  for (const m of open) {
    await prisma.taMilestone.update({
      where: { id: m.id },
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
  rag: Rag;
};

export async function listPoMilestones(
  actor: SessionUser,
  poId: string,
  now: Date,
): Promise<MilestoneView[]> {
  assertPermission(actor, "criticalPath", "view");
  const ms = await prisma.taMilestone.findMany({ where: { poId }, orderBy: { position: "asc" } });
  return ms.map((m) => ({
    id: m.id,
    key: m.key,
    name: m.name,
    stage: m.stage,
    position: m.position,
    plannedDate: m.plannedDate,
    actualDate: m.actualDate,
    rag: computeRag(m.plannedDate, m.actualDate, now),
  }));
}
