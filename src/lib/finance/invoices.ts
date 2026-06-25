import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { recomputeInvoiceStatus } from "./payments";
import { outstanding } from "./money";
import { completeMilestonesByKey } from "@/lib/tna/milestones";

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

/** Inline quick-edit of an invoice's value + due date. */
const INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "PAID"] as const;

export async function updateInvoiceFields(
  actor: SessionUser,
  id: string,
  // NOTE: type + currency are intentionally NOT editable — type flips AR/AP classification
  // and currency corrupts the single-currency rollups (spec §14). Create-time only.
  input: { amount?: number; dueDate?: Date | null; status?: string; number?: string; issueDate?: Date },
) {
  assertPermission(actor, "finance", "edit");
  const cid = tenantId(actor);
  const existing = await prisma.invoice.findFirst({
    where: { id, companyId: cid },
    include: { payments: true },
  });
  if (!existing) throw new Error("Invoice not found");
  const data: {
    amount?: Prisma.Decimal | number;
    dueDate?: Date | null;
    status?: (typeof INVOICE_STATUSES)[number];
    number?: string;
    issueDate?: Date;
  } = {};
  const amountChanged = input.amount !== undefined && input.amount >= 0;
  if (amountChanged) data.amount = input.amount;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;
  const explicitStatus =
    input.status && (INVOICE_STATUSES as readonly string[]).includes(input.status)
      ? (input.status as (typeof INVOICE_STATUSES)[number])
      : undefined;
  if (explicitStatus) data.status = explicitStatus;
  if (input.number !== undefined) {
    const trimmed = input.number.trim();
    if (!trimmed) throw new Error("Invoice number cannot be empty");
    data.number = trimmed;
  }
  if (input.issueDate !== undefined) data.issueDate = input.issueDate;

  // Payment status is a user-controlled flag in this product: merchants mark an invoice
  // ISSUED / PARTIALLY_PAID / PAID directly without necessarily recording individual
  // payment lines, so an explicit status is accepted as an authoritative manual override.
  // (When payments ARE recorded, recordPayment/updatePayment/deletePayment still
  // auto-advance the status; and an amount edit without an explicit status re-derives it.)

  // #7 invoice-amount-edit-stale-status: changing the amount (or issueDate) without an
  // explicit status can leave a stored PAID/PARTIALLY_PAID diverged from the new amount vs
  // payment set, so recompute the status from the authoritative payments after the write.
  // recomputeInvoiceStatus requires a TransactionClient, so wrap the update + recompute.
  // Marking an invoice PAID auto-records a payment for the remaining balance, so the payment
  // ledger (cash book, aging, dashboard "payments overdue") agrees with the PAID status instead
  // of a status-only flag that aging ignores. recomputeInvoiceStatus then confirms PAID.
  const autoSettle = explicitStatus === "PAID";
  const recompute = amountChanged && !explicitStatus;
  try {
    if (autoSettle) {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({ where: { id }, data });
        const inv = await tx.invoice.findFirstOrThrow({ where: { id, companyId: cid } });
        const all = await tx.payment.findMany({ where: { invoiceId: id, companyId: cid } });
        const out = outstanding(inv.amount, all);
        if (out > 0) {
          await tx.payment.create({
            data: { companyId: cid, invoiceId: id, amount: String(out), date: new Date(), method: "TT", reference: "Auto-recorded: marked paid" },
          });
        }
        await recomputeInvoiceStatus(tx, id, cid);
        // Payment realised → tick the PAYMENT critical-path milestone for the invoice's PO.
        let poId = existing.poId;
        if (!poId && existing.shipmentId) {
          const sl = await tx.shipmentLine.findFirst({ where: { shipment: { id: existing.shipmentId }, companyId: cid }, include: { orderLine: { select: { poId: true } } } });
          poId = sl?.orderLine?.poId ?? null;
        }
        if (poId) await completeMilestonesByKey(tx, actor, poId, "PAYMENT", new Date());
      }, { timeout: 15000, maxWait: 10000 });
    } else if (recompute) {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({ where: { id }, data });
        await recomputeInvoiceStatus(tx, id, cid);
      });
    } else {
      await prisma.invoice.update({ where: { id }, data });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("An invoice with that number already exists");
    }
    throw e;
  }
  await recordAudit({ userId: actor.id, entityType: "Invoice", entityId: id, action: "edit", after: input });
}

/** Delete an invoice. Blocked while it has recorded payments (protect financial records —
 *  remove the payments first). Tenant-scoped + audited. */
export async function deleteInvoice(actor: SessionUser, id: string): Promise<void> {
  assertPermission(actor, "finance", "delete");
  const cid = tenantId(actor);
  const inv = await prisma.invoice.findFirst({
    where: { id, companyId: cid },
    select: { number: true, type: true, _count: { select: { payments: true } } },
  });
  if (!inv) throw new Error("Invoice not found");
  if (inv._count.payments > 0) throw new Error("This invoice has payments recorded — delete the payments first, then the invoice.");
  await prisma.invoice.deleteMany({ where: { id, companyId: cid } });
  await recordAudit({ userId: actor.id, entityType: "Invoice", entityId: id, action: "delete", before: { number: inv.number, type: inv.type } });
}
