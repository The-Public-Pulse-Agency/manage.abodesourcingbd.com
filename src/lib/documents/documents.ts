import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const DOCUMENT_ENTITY_TYPES = ["PurchaseOrder", "Shipment"] as const;
export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

const documentTypes = ["BL", "COMMERCIAL_INVOICE", "PACKING_LIST", "TEST_CERT", "SAMPLE_PHOTO", "OTHER"] as const;
const FINANCE_DOC_TYPES: string[] = ["BL", "COMMERCIAL_INVOICE", "PACKING_LIST"];

export const createDocumentSchema = z.object({
  entityType: z.enum(DOCUMENT_ENTITY_TYPES),
  entityId: z.string().min(1),
  type: z.enum(documentTypes),
  fileName: z.string().min(1),
  fileUrl: z.string().optional(), // metadata-only; real S3 upload deferred to infra
});
export type CreateDocumentInput = z.input<typeof createDocumentSchema>;

async function assertEntityExists(entityType: DocumentEntityType, entityId: string) {
  const exists =
    entityType === "PurchaseOrder"
      ? await prisma.purchaseOrder.findUnique({ where: { id: entityId }, select: { id: true } })
      : await prisma.shipment.findUnique({ where: { id: entityId }, select: { id: true } });
  if (!exists) throw new Error(`${entityType} ${entityId} not found`);
}

export async function createDocument(actor: SessionUser, input: CreateDocumentInput) {
  assertPermission(actor, "documents", "create");
  const data = createDocumentSchema.parse(input);
  // spec §7: Accounts may attach finance documents only.
  if (actor.role === "ACCOUNTS" && !FINANCE_DOC_TYPES.includes(data.type)) {
    throw new Error("Accounts may only attach finance documents (BL, commercial invoice, packing list)");
  }
  await assertEntityExists(data.entityType, data.entityId);
  const doc = await prisma.document.create({ data: { ...data, uploadedById: actor.id } });
  await recordAudit({
    userId: actor.id,
    entityType: "Document",
    entityId: doc.id,
    action: "create",
    after: { type: doc.type, on: `${data.entityType}:${data.entityId}` },
  });
  return doc;
}

export async function listDocuments(actor: SessionUser, entityType: DocumentEntityType, entityId: string) {
  assertPermission(actor, "documents", "view");
  return prisma.document.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" } });
}
