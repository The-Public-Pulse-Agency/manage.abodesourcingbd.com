import { z } from "zod";
import type { SampleStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const sampleTypes = ["LAB_DIP", "FIT", "PP", "SIZE_SET"] as const;
const sampleStatuses = ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"] as const;

// Forward-only approval lifecycle; APPROVED is terminal. Same-status no-op is allowed.
const ALLOWED_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  PENDING: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  REJECTED: ["SUBMITTED"],
  APPROVED: [],
};

export const createSampleSchema = z.object({
  type: z.enum(sampleTypes),
  colourId: z.string().optional(),
  sentDate: z.coerce.date().optional(),
  remarks: z.string().optional(),
});
export type CreateSampleInput = z.input<typeof createSampleSchema>;

export const updateSampleSchema = z
  .object({
    status: z.enum(sampleStatuses),
    approvedDate: z.coerce.date().optional(),
    sentDate: z.coerce.date().nullish(),
    colourId: z.string().nullish(),
    remarks: z.string().nullish(),
  })
  .refine((v) => v.status !== "APPROVED" || v.approvedDate != null, {
    message: "approvedDate is required when status is APPROVED",
    path: ["approvedDate"],
  });
export type UpdateSampleInput = z.input<typeof updateSampleSchema>;

async function loadSamplingPo(actor: SessionUser, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
  });
  if (!po) throw new Error("Purchase order not found");
  if (po.status === "CANCELLED" || po.status === "CLOSED") {
    throw new Error(`Cannot modify sampling on a ${po.status} order`);
  }
  return po;
}

export async function createSampleRequest(
  actor: SessionUser,
  poId: string,
  input: CreateSampleInput,
) {
  assertPermission(actor, "sampling", "create");
  await loadSamplingPo(actor, poId);
  const data = createSampleSchema.parse(input);
  const sample = await prisma.sampleRequest.create({
    data: { companyId: tenantId(actor), poId, ...data },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "SampleRequest",
    entityId: sample.id,
    action: "create",
    after: { poId, type: sample.type, status: sample.status, colourId: sample.colourId },
  });
  return sample;
}

export async function updateSampleStatus(
  actor: SessionUser,
  id: string,
  input: UpdateSampleInput,
) {
  assertPermission(actor, "sampling", "edit");
  const data = updateSampleSchema.parse(input);
  const before = await prisma.sampleRequest.findFirst({
    where: { id, companyId: tenantId(actor) },
  });
  if (!before) throw new Error("Sample request not found");
  if (data.status !== before.status && !ALLOWED_TRANSITIONS[before.status].includes(data.status)) {
    throw new Error(`Illegal sample status transition: ${before.status} -> ${data.status}`);
  }
  await prisma.sampleRequest.updateMany({
    where: { id, companyId: tenantId(actor) },
    data: {
      status: data.status,
      // undefined fields are skipped by Prisma, so a status-only advance leaves these untouched.
      remarks: data.remarks,
      sentDate: data.sentDate,
      colourId: data.colourId,
      // Couple approvedDate to status: set only when APPROVED, cleared otherwise.
      approvedDate: data.status === "APPROVED" ? data.approvedDate : null,
    },
  });
  const sample = await prisma.sampleRequest.findFirstOrThrow({
    where: { id, companyId: tenantId(actor) },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "SampleRequest",
    entityId: id,
    action: "edit",
    before: { status: before.status, approvedDate: before.approvedDate?.toISOString() ?? null },
    after: { status: sample.status, approvedDate: sample.approvedDate?.toISOString() ?? null },
  });
  return sample;
}

export const editSampleFieldsSchema = z.object({
  sentDate: z.coerce.date().nullish(),
  colourId: z.string().nullish(),
  remarks: z.string().nullish(),
});
export type EditSampleFieldsInput = z.input<typeof editSampleFieldsSchema>;

/** Edit non-status sample fields (sent date, colour, remarks) without touching the status lifecycle. */
export async function editSampleFields(
  actor: SessionUser,
  id: string,
  input: EditSampleFieldsInput,
) {
  assertPermission(actor, "sampling", "edit");
  const data = editSampleFieldsSchema.parse(input);
  const before = await prisma.sampleRequest.findFirst({
    where: { id, companyId: tenantId(actor) },
  });
  if (!before) throw new Error("Sample request not found");
  await prisma.sampleRequest.updateMany({
    where: { id, companyId: tenantId(actor) },
    // undefined fields are skipped by Prisma; null explicitly clears the column.
    data: { sentDate: data.sentDate, colourId: data.colourId, remarks: data.remarks },
  });
  const sample = await prisma.sampleRequest.findFirstOrThrow({
    where: { id, companyId: tenantId(actor) },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "SampleRequest",
    entityId: id,
    action: "edit",
    before: {
      sentDate: before.sentDate?.toISOString() ?? null,
      colourId: before.colourId,
      remarks: before.remarks,
    },
    after: {
      sentDate: sample.sentDate?.toISOString() ?? null,
      colourId: sample.colourId,
      remarks: sample.remarks,
    },
  });
  return sample;
}

export async function removeSampleRequest(actor: SessionUser, id: string) {
  assertPermission(actor, "sampling", "delete");
  const before = await prisma.sampleRequest.findFirst({
    where: { id, companyId: tenantId(actor) },
  });
  if (!before) throw new Error("Sample request not found");
  await prisma.sampleRequest.deleteMany({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({
    userId: actor.id,
    entityType: "SampleRequest",
    entityId: id,
    action: "delete",
    before: { poId: before.poId, type: before.type, status: before.status },
  });
}

export async function listSampleRequests(actor: SessionUser, poId: string) {
  assertPermission(actor, "sampling", "view");
  return prisma.sampleRequest.findMany({
    where: { poId, companyId: tenantId(actor) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}
