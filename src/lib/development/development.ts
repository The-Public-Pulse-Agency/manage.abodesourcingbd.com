import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function listDevelopment(actor: SessionUser) {
  assertPermission(actor, "orders", "view");
  return prisma.developmentItem.findMany({ where: { companyId: tenantId(actor) }, orderBy: { createdAt: "desc" } });
}

export const createDevSchema = z.object({
  buyerId: z.string().optional(),
  factoryId: z.string().optional(),
  styleRef: z.string().min(1, "Style ref is required"),
  colour: z.string().optional(),
});
export type CreateDevInput = z.input<typeof createDevSchema>;

export async function createDevelopment(actor: SessionUser, input: CreateDevInput) {
  assertPermission(actor, "orders", "create");
  const data = createDevSchema.parse(input);
  const item = await prisma.developmentItem.create({
    data: {
      companyId: tenantId(actor),
      buyerId: data.buyerId || null,
      factoryId: data.factoryId || null,
      styleRef: data.styleRef.trim(),
      colour: data.colour?.trim() || null,
    },
  });
  await recordAudit({ userId: actor.id, entityType: "DevelopmentItem", entityId: item.id, action: "create", after: { styleRef: data.styleRef } });
  return item;
}

const TEXT_FIELDS = ["labDip", "knitting", "firstSample", "secondSample", "remarks", "colour", "styleRef"] as const;
const ID_FIELDS = ["factoryId", "buyerId"] as const;
export type DevField = (typeof TEXT_FIELDS)[number] | (typeof ID_FIELDS)[number] | "finalSampleDate";

export async function updateDevelopmentField(actor: SessionUser, id: string, field: DevField, value: string) {
  assertPermission(actor, "orders", "edit");
  const cid = tenantId(actor);
  const existing = await prisma.developmentItem.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!existing) throw new Error("Development item not found");
  const data: Record<string, string | Date | null> = {};
  if (field === "finalSampleDate") data.finalSampleDate = value ? new Date(`${value}T00:00:00.000Z`) : null;
  else if ((ID_FIELDS as readonly string[]).includes(field)) data[field] = value || null;
  else if ((TEXT_FIELDS as readonly string[]).includes(field)) data[field] = value.trim() || null;
  else throw new Error("Invalid field");
  await prisma.developmentItem.update({ where: { id }, data });
}

export async function deleteDevelopment(actor: SessionUser, id: string) {
  assertPermission(actor, "orders", "edit");
  await prisma.developmentItem.deleteMany({ where: { id, companyId: tenantId(actor) } });
  await recordAudit({ userId: actor.id, entityType: "DevelopmentItem", entityId: id, action: "delete" });
}
