import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const invoiceTypes = ["BUYER", "FACTORY"] as const;

export const createInvoiceSchema = z
  .object({
    type: z.enum(invoiceTypes),
    number: z.string().min(1),
    poId: z.string().optional(),
    shipmentId: z.string().optional(),
    amount: z.number().positive(),
    currency: z.string().default("USD"),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date().optional(),
  })
  .refine((d) => d.poId || d.shipmentId, {
    message: "An invoice must link to a purchase order or a shipment",
    path: ["poId"],
  });
export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;

export async function createInvoice(actor: SessionUser, input: CreateInvoiceInput) {
  assertPermission(actor, "finance", "create");
  const data = createInvoiceSchema.parse(input);

  // Verify links exist + inherit currency from the PO (single-currency rollups, spec §14).
  let currency = data.currency;
  if (data.poId) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: data.poId, companyId: tenantId(actor) },
    });
    if (!po) throw new Error("Purchase order not found");
    currency = po.currency;
  }
  if (data.shipmentId) {
    const shp = await prisma.shipment.findFirst({
      where: { id: data.shipmentId, companyId: tenantId(actor) },
    });
    if (!shp) throw new Error("Shipment not found");
  }

  try {
    const inv = await prisma.invoice.create({
      data: {
        companyId: tenantId(actor),
        type: data.type,
        number: data.number,
        poId: data.poId,
        shipmentId: data.shipmentId,
        amount: String(data.amount),
        currency,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
      },
    });
    await recordAudit({
      userId: actor.id,
      entityType: "Invoice",
      entityId: inv.id,
      action: "create",
      after: { type: inv.type, number: inv.number, amount: data.amount },
    });
    return inv;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A ${data.type} invoice numbered ${data.number} already exists`);
    }
    throw e;
  }
}

export async function listInvoices(
  actor: SessionUser,
  filter: { type?: "BUYER" | "FACTORY"; poId?: string },
) {
  assertPermission(actor, "finance", "view");
  return prisma.invoice.findMany({
    where: {
      companyId: tenantId(actor),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.poId ? { poId: filter.poId } : {}),
    },
    include: { payments: true, po: true },
    orderBy: { issueDate: "desc" },
  });
}

/** Server-side paginated invoice list (for the finance all-invoices view at scale). */
export async function listInvoicesPaged(
  actor: SessionUser,
  filter: { type?: "BUYER" | "FACTORY"; poId?: string },
  opts: { page?: number; pageSize?: number } = {},
) {
  assertPermission(actor, "finance", "view");
  const where = {
    companyId: tenantId(actor),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.poId ? { poId: filter.poId } : {}),
  };
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const total = await prisma.invoice.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const rows = await prisma.invoice.findMany({
    where,
    include: { payments: true, po: true },
    orderBy: { issueDate: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { rows, total, page, pageSize, totalPages };
}
