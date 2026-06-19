import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const DOCUMENT_ENTITY_TYPES = ["PurchaseOrder", "Shipment"] as const;
export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

const documentTypes = ["BL", "COMMERCIAL_INVOICE", "PACKING_LIST", "TEST_CERT", "INSPECTION_REPORT", "SAMPLE_PHOTO", "OTHER"] as const;
const FINANCE_DOC_TYPES: string[] = ["BL", "COMMERCIAL_INVOICE", "PACKING_LIST"];

export const createDocumentSchema = z.object({
  entityType: z.enum(DOCUMENT_ENTITY_TYPES),
  entityId: z.string().min(1),
  type: z.enum(documentTypes),
  fileName: z.string().min(1),
  // Only http(s) URLs — blocks javascript:/data: URI XSS in the rendered link.
  fileUrl: z
    .string()
    .regex(/^https?:\/\//i, "Only http(s) URLs are allowed")
    .optional(),
});
export type CreateDocumentInput = z.input<typeof createDocumentSchema>;

async function assertEntityExists(actor: SessionUser, entityType: DocumentEntityType, entityId: string) {
  const exists =
    entityType === "PurchaseOrder"
      ? await prisma.purchaseOrder.findFirst({ where: { id: entityId, companyId: tenantId(actor) }, select: { id: true } })
      : await prisma.shipment.findFirst({ where: { id: entityId, companyId: tenantId(actor) }, select: { id: true } });
  if (!exists) throw new Error(`${entityType} ${entityId} not found`);
}

/**
 * @param storageKey TRUSTED server-only value (the private Blob pathname from the upload
 *   action). It is intentionally NOT part of the client-validated schema — accepting it from
 *   client input would let a tenant point a Document at another tenant's blob (cross-tenant read).
 */
export async function createDocument(actor: SessionUser, input: CreateDocumentInput, storageKey?: string) {
  assertPermission(actor, "documents", "create");
  const data = createDocumentSchema.parse(input);
  // spec §7: Accounts may attach finance documents only.
  if (actor.role === "ACCOUNTS" && !FINANCE_DOC_TYPES.includes(data.type)) {
    throw new Error("Accounts may only attach finance documents (BL, commercial invoice, packing list)");
  }
  await assertEntityExists(actor, data.entityType, data.entityId);
  const doc = await prisma.document.create({ data: { ...data, storageKey: storageKey ?? null, companyId: tenantId(actor), uploadedById: actor.id } });
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
  return prisma.document.findMany({ where: { entityType, entityId, companyId: tenantId(actor) }, orderBy: { createdAt: "desc" } });
}

/** A single document, tenant-scoped + permission-gated — backs the download proxy. */
export async function getDocument(actor: SessionUser, id: string) {
  assertPermission(actor, "documents", "view");
  return prisma.document.findFirst({ where: { id, companyId: tenantId(actor) } });
}
