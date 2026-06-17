import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function listCommission(actor: SessionUser) {
  assertPermission(actor, "finance", "view");
  return prisma.commissionEntry.findMany({ where: { companyId: tenantId(actor) }, orderBy: { createdAt: "desc" } });
}

export const createCommissionSchema = z.object({
  buyerId: z.string().optional(),
  factoryId: z.string().optional(),
  factoryInvoiceNo: z.string().optional(),
  factoryInvoiceValue: z.coerce.number().nonnegative().optional(),
  commissionPct: z.coerce.number().nonnegative().optional(),
});
export type CreateCommissionInput = z.input<typeof createCommissionSchema>;

export async function createCommission(actor: SessionUser, input: CreateCommissionInput) {
  assertPermission(actor, "finance", "edit");
  const d = createCommissionSchema.parse(input);
  const entry = await prisma.commissionEntry.create({
    data: {
      companyId: tenantId(actor),
      buyerId: d.buyerId || null,
      factoryId: d.factoryId || null,
      factoryInvoiceNo: d.factoryInvoiceNo?.trim() || null,
      factoryInvoiceValue: d.factoryInvoiceValue != null ? String(d.factoryInvoiceValue) : null,
      commissionPct: d.commissionPct != null ? String(d.commissionPct) : null,
    },
  });
  await recordAudit({ userId: actor.id, entityType: "CommissionEntry", entityId: entry.id, action: "create" });
  return entry;
}

const TEXT = ["factoryInvoiceNo", "ownInvoiceNo", "paymentStatus", "remarks"] as const;
const NUM = ["factoryInvoiceValue", "commissionPct"] as const;
const DATE = ["issueDate", "dueDate"] as const;
export type CommissionField = (typeof TEXT)[number] | (typeof NUM)[number] | (typeof DATE)[number];

export async function updateCommissionField(actor: SessionUser, id: string, field: CommissionField, value: string) {
  assertPermission(actor, "finance", "edit");
  const cid = tenantId(actor);
  const existing = await prisma.commissionEntry.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!existing) throw new Error("Commission entry not found");
  const data: Record<string, string | number | Date | null> = {};
  if ((TEXT as readonly string[]).includes(field)) data[field] = value.trim() || null;
  else if ((NUM as readonly string[]).includes(field)) data[field] = value ? String(Math.max(0, Number(value) || 0)) : null;
  else if ((DATE as readonly string[]).includes(field)) data[field] = value ? new Date(`${value}T00:00:00.000Z`) : null;
  else throw new Error("Invalid field");
  await prisma.commissionEntry.update({ where: { id }, data });
}

export async function deleteCommission(actor: SessionUser, id: string) {
  assertPermission(actor, "finance", "edit");
  await prisma.commissionEntry.deleteMany({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "CommissionEntry", entityId: id, action: "delete" });
}
