import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const CATEGORIES = ["FABRIC", "CM", "TRIMS", "TEST", "FREIGHT", "COMMISSION", "OTHER"] as const;

export const costItemSchema = z.object({
  poId: z.string().min(1),
  category: z.enum(CATEGORIES),
  label: z.string().min(1),
  amountPerUnit: z.coerce.number().nonnegative(),
  note: z.string().optional(),
});
export type CostItemInput = z.input<typeof costItemSchema>;

export async function listCostItems(actor: SessionUser, poId: string) {
  assertPermission(actor, "costing", "view");
  return prisma.costItem.findMany({ where: { poId }, orderBy: { createdAt: "asc" } });
}

export async function addCostItem(actor: SessionUser, input: CostItemInput) {
  assertPermission(actor, "costing", "edit");
  const data = costItemSchema.parse(input);
  const item = await prisma.costItem.create({
    data: {
      poId: data.poId,
      category: data.category,
      label: data.label,
      amountPerUnit: String(data.amountPerUnit),
      note: data.note,
    },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "CostItem",
    entityId: item.id,
    action: "create",
    after: { category: data.category, label: data.label, amountPerUnit: data.amountPerUnit },
  });
  return item;
}

export async function removeCostItem(actor: SessionUser, id: string) {
  assertPermission(actor, "costing", "edit");
  await prisma.costItem.delete({ where: { id } });
  await recordAudit({ userId: actor.id, entityType: "CostItem", entityId: id, action: "delete" });
}
