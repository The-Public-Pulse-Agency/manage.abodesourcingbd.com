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
        const all = await tx.payment.findMany({ where: { invoiceId, companyId: tenantId(actor) } });
        const newOut = outstanding(invoice.amount, all);
        const status = newOut <= 0 ? "PAID" : "PARTIALLY_PAID";
        await tx.invoice.updateMany({ where: { id: invoiceId, companyId: tenantId(actor) }, data: { status } });
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
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
