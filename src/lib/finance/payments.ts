import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { outstanding } from "./money";

const methods = ["LC", "TT", "OTHER"] as const;

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  date: z.coerce.date(),
  method: z.enum(methods).default("TT"),
  reference: z.string().optional(),
});
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

/**
 * Recompute and persist an invoice's status from its authoritative payment set.
 * Mirrors recordPayment's logic, extended to also revert to ISSUED when nothing is paid
 * (relevant after a payment update/delete). Tenant-scoped via companyId on both reads + writes.
 */
export async function recomputeInvoiceStatus(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  companyId: string | null,
) {
  const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, companyId } });
  if (!invoice) return;
  const all = await tx.payment.findMany({ where: { invoiceId, companyId } });
  const newOut = outstanding(invoice.amount, all);
  const status = newOut <= 0 ? "PAID" : all.length === 0 ? "ISSUED" : "PARTIALLY_PAID";
  await tx.invoice.updateMany({ where: { id: invoiceId, companyId }, data: { status } });
  return status;
}

export async function recordPayment(actor: SessionUser, invoiceId: string, input: RecordPaymentInput) {
  assertPermission(actor, "finance", "create");
  const data = recordPaymentSchema.parse(input);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: { id: invoiceId, companyId: tenantId(actor) },
          include: { payments: true },
        });
        if (!invoice) throw new Error("Invoice not found");
        const out = outstanding(invoice.amount, invoice.payments);
        if (data.amount > out + 1e-9) {
          throw new Error(`Payment ${data.amount} exceeds outstanding ${out}`);
        }
        const payment = await tx.payment.create({
          data: {
            companyId: tenantId(actor),
            invoiceId,
            amount: String(data.amount),
            date: data.date,
            method: data.method,
            reference: data.reference,
          },
        });
        // Re-read all payments (serialized) and recompute status from the authoritative set.
        const status = await recomputeInvoiceStatus(tx, invoiceId, tenantId(actor));
        await recordAudit(
          {
            userId: actor.id,
            entityType: "Payment",
            entityId: payment.id,
            action: "create",
            after: { invoiceId, amount: data.amount, status },
          },
          tx,
        );
        return payment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000, maxWait: 10000 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      throw new Error("Another payment is being recorded for this invoice — please retry");
    }
    throw e;
  }
}

export async function listPayments(actor: SessionUser, invoiceId: string) {
  assertPermission(actor, "finance", "view");
  return prisma.payment.findMany({
    where: { invoiceId, companyId: tenantId(actor) },
    orderBy: { date: "desc" },
  });
}

export const updatePaymentSchema = z.object({
  amount: z.number().positive().optional(),
  date: z.coerce.date().optional(),
  method: z.enum(methods).optional(),
});
export type UpdatePaymentInput = z.input<typeof updatePaymentSchema>;

export async function updatePayment(actor: SessionUser, paymentId: string, input: UpdatePaymentInput) {
  // Use the create permission for parity with recordPayment (canManage = finance create).
  assertPermission(actor, "finance", "edit");
  const data = updatePaymentSchema.parse(input);
  const cid = tenantId(actor);
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.payment.findFirst({ where: { id: paymentId, companyId: cid } });
      if (!existing) throw new Error("Payment not found");

      // Guard the new total against the invoice amount (allow leaving amount unchanged).
      const invoice = await tx.invoice.findFirst({ where: { id: existing.invoiceId, companyId: cid } });
      if (!invoice) throw new Error("Invoice not found");
      const others = await tx.payment.findMany({
        where: { invoiceId: existing.invoiceId, companyId: cid, id: { not: paymentId } },
      });
      const newAmount = data.amount ?? Number(existing.amount.toString());
      const out = outstanding(invoice.amount, others);
      if (newAmount > out + 1e-9) {
        throw new Error(`Payment ${newAmount} exceeds outstanding ${out}`);
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          ...(data.amount !== undefined ? { amount: String(data.amount) } : {}),
          ...(data.date !== undefined ? { date: data.date } : {}),
          ...(data.method !== undefined ? { method: data.method } : {}),
        },
      });
      const status = await recomputeInvoiceStatus(tx, existing.invoiceId, cid);
      await recordAudit(
        {
          userId: actor.id,
          entityType: "Payment",
          entityId: paymentId,
          action: "edit",
          after: JSON.parse(JSON.stringify({ ...input, status })),
        },
        tx,
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000, maxWait: 10000 },
  );
}

export async function deletePayment(actor: SessionUser, paymentId: string) {
  assertPermission(actor, "finance", "edit");
  const cid = tenantId(actor);
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.payment.findFirst({ where: { id: paymentId, companyId: cid } });
      if (!existing) throw new Error("Payment not found");
      await tx.payment.deleteMany({ where: { id: paymentId, companyId: cid } });
      const status = await recomputeInvoiceStatus(tx, existing.invoiceId, cid);
      await recordAudit(
        {
          userId: actor.id,
          entityType: "Payment",
          entityId: paymentId,
          action: "delete",
          before: { invoiceId: existing.invoiceId, amount: Number(existing.amount.toString()) },
          after: { status },
        },
        tx,
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000, maxWait: 10000 },
  );
}
