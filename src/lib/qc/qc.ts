import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const inspectionTypes = ["INLINE", "FINAL"] as const;
const inspectionResults = ["PASS", "FAIL"] as const;

export const addInspectionSchema = z.object({
  type: z.enum(inspectionTypes),
  result: z.enum(inspectionResults),
  date: z.coerce.date(),
  aql: z.string().optional(),
  remarks: z.string().optional(),
});
export type AddInspectionInput = z.input<typeof addInspectionSchema>;

async function loadQcPo(actor: SessionUser, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
  });
  if (!po) throw new Error("Purchase order not found");
  if (po.status === "DRAFT" || po.status === "CANCELLED" || po.status === "CLOSED") {
    throw new Error(`Cannot record QC on a ${po.status} order`);
  }
  return po;
}

export async function addInspection(actor: SessionUser, poId: string, input: AddInspectionInput) {
  assertPermission(actor, "productionQc", "create");
  await loadQcPo(actor, poId);
  const data = addInspectionSchema.parse(input);
  const insp = await prisma.inspection.create({
    data: { companyId: tenantId(actor), poId, ...data },
  });
  // Keep the open-orders report's "final inspection date" in sync: stamp the FINAL_AQL
  // milestone (if not already stamped) when a FINAL inspection is recorded.
  if (insp.type === "FINAL") {
    await prisma.taMilestone.updateMany({
      where: { poId, key: "FINAL_AQL", actualDate: null, companyId: tenantId(actor) },
      data: { actualDate: insp.date },
    });
  }
  await recordAudit({
    userId: actor.id,
    entityType: "Inspection",
    entityId: insp.id,
    action: "create",
    after: { poId, type: insp.type, result: insp.result },
  });
  return insp;
}

export async function listInspections(actor: SessionUser, poId: string) {
  assertPermission(actor, "productionQc", "view");
  // Deterministic newest-first: id (cuid) is the final unique tiebreak for same-day rows.
  return prisma.inspection.findMany({
    where: { poId, companyId: tenantId(actor) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  });
}

export const updateInspectionSchema = z.object({
  type: z.enum(inspectionTypes).optional(),
  result: z.enum(inspectionResults).optional(),
  date: z.coerce.date().optional(),
  aql: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
});
export type UpdateInspectionInput = z.input<typeof updateInspectionSchema>;

/** Correct an existing inspection's fields. Tenant-scoped; enums validated. */
export async function updateInspection(actor: SessionUser, id: string, input: UpdateInspectionInput) {
  assertPermission(actor, "productionQc", "edit");
  const insp = await prisma.inspection.findFirst({ where: { id, companyId: tenantId(actor) } });
  if (!insp) throw new Error("Inspection not found");
  // Edits obey the same PO-status rule as create (rejects DRAFT/CANCELLED/CLOSED).
  await loadQcPo(actor, insp.poId);
  const data = updateInspectionSchema.parse(input);

  const patch: Record<string, unknown> = {};
  if (data.type !== undefined) patch.type = data.type;
  if (data.result !== undefined) patch.result = data.result;
  if (data.date !== undefined) patch.date = data.date;
  if (data.aql !== undefined) patch.aql = data.aql?.trim() || null;
  if (data.remarks !== undefined) patch.remarks = data.remarks?.trim() || null;

  await prisma.inspection.updateMany({ where: { id, companyId: tenantId(actor) }, data: patch });
  // Keep FINAL_AQL in sync: if this inspection is (or becomes) FINAL, best-effort stamp
  // any unstamped FINAL_AQL milestone with the effective inspection date.
  const effectiveType = data.type ?? insp.type;
  const effectiveDate = data.date ?? insp.date;
  if (effectiveType === "FINAL") {
    await prisma.taMilestone.updateMany({
      where: { poId: insp.poId, key: "FINAL_AQL", actualDate: null, companyId: tenantId(actor) },
      data: { actualDate: effectiveDate },
    });
  }
  await recordAudit({
    userId: actor.id,
    entityType: "Inspection",
    entityId: id,
    action: "edit",
    after: JSON.parse(JSON.stringify(patch)),
  });
  return prisma.inspection.findFirst({ where: { id, companyId: tenantId(actor) } });
}

export async function removeInspection(actor: SessionUser, id: string) {
  assertPermission(actor, "productionQc", "delete");
  const insp = await prisma.inspection.findFirst({ where: { id, companyId: tenantId(actor) } });
  if (!insp) throw new Error("Inspection not found");
  // Deletes obey the same PO-status rule as create (rejects DRAFT/CANCELLED/CLOSED).
  await loadQcPo(actor, insp.poId);
  await prisma.inspection.deleteMany({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "Inspection", entityId: id, action: "delete" });
}
