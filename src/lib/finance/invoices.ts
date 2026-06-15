import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
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
    const po = await prisma.purchaseOrder.findUnique({ where: { id: data.poId } });
    if (!po) throw new Error("Purchase order not found");
    currency = po.currency;
  }
  if (data.shipmentId) {
    const shp = await prisma.shipment.findUnique({ where: { id: data.shipmentId } });
    if (!shp) throw new Error("Shipment not found");
  }

  try {
    const inv = await prisma.invoice.create({
      data: {
        type: data.type,
        number: data.number,
        poId: data.poId,
        shipmentId: data.shipmentId,
        amount: String(data.amount),
        currency,
        issueDate: data.issueDate,
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
    where: { ...(filter.type ? { type: filter.type } : {}), ...(filter.poId ? { poId: filter.poId } : {}) },
    include: { payments: true, po: true },
    orderBy: { issueDate: "desc" },
  });
}
