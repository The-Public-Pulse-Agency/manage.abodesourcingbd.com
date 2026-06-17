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
