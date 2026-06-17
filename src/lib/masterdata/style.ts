import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createStyleSchema = z.object({
  brandId: z.string().min(1),
  styleCode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  composition: z.string().optional(),
  category: z.string().optional(),
  defaultSizeScaleId: z.string().optional(),
});
export type CreateStyleInput = z.infer<typeof createStyleSchema>;

export const updateStyleSchema = createStyleSchema.partial();
export type UpdateStyleInput = z.infer<typeof updateStyleSchema>;

export async function createStyle(actor: SessionUser, input: CreateStyleInput) {
  assertPermission(actor, "masterData", "create");
  const data = createStyleSchema.parse(input);
  const dup = await prisma.style.findFirst({
    where: { brandId: data.brandId, styleCode: data.styleCode, companyId: tenantId(actor) },
  });
  if (dup) throw new Error(`Style ${data.styleCode} already exists for this brand`);
  const style = await prisma.style.create({ data: { ...data, companyId: tenantId(actor) } });
  await recordAudit({
    userId: actor.id,
    entityType: "Style",
    entityId: style.id,
    action: "create",
    after: { styleCode: style.styleCode, name: style.name, brandId: style.brandId },
  });
  return style;
}

export async function getStyle(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "view");
  return prisma.style.findFirst({ where: { id, companyId: tenantId(actor) } });
}

export async function updateStyle(
  actor: SessionUser,
  id: string,
  input: UpdateStyleInput,
) {
  assertPermission(actor, "masterData", "edit");
  const data = updateStyleSchema.parse(input);
  const existing = await prisma.style.findFirst({
    where: { id, companyId: tenantId(actor) },
    select: { id: true },
  });
  if (!existing) throw new Error("Style not found");
  try {
    const style = await prisma.style.update({ where: { id }, data });
    await recordAudit({
      userId: actor.id,
      entityType: "Style",
      entityId: id,
      action: "edit",
      after: data,
    });
    return style;
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error("Style code already exists for this brand");
    }
    throw e;
  }
}

export async function listStyles(
  actor: SessionUser,
  opts: { brandId?: string; includeInactive?: boolean } = {},
) {
  assertPermission(actor, "masterData", "view");
  return prisma.style.findMany({
    where: {
      companyId: tenantId(actor),
      ...(opts.includeInactive ? {} : { active: true }),
      ...(opts.brandId ? { brandId: opts.brandId } : {}),
    },
    orderBy: { styleCode: "asc" },
  });
}
