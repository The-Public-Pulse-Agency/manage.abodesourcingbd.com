import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
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

export async function createStyle(actor: SessionUser, input: CreateStyleInput) {
  assertPermission(actor, "masterData", "create");
  const data = createStyleSchema.parse(input);
  const dup = await prisma.style.findUnique({
    where: { brandId_styleCode: { brandId: data.brandId, styleCode: data.styleCode } },
  });
  if (dup) throw new Error(`Style ${data.styleCode} already exists for this brand`);
  const style = await prisma.style.create({ data });
  await recordAudit({
    userId: actor.id,
    entityType: "Style",
    entityId: style.id,
    action: "create",
    after: { styleCode: style.styleCode, name: style.name, brandId: style.brandId },
  });
  return style;
}

export async function listStyles(
  actor: SessionUser,
  opts: { brandId?: string; includeInactive?: boolean } = {},
) {
  assertPermission(actor, "masterData", "view");
  return prisma.style.findMany({
    where: {
      ...(opts.includeInactive ? {} : { active: true }),
      ...(opts.brandId ? { brandId: opts.brandId } : {}),
    },
    orderBy: { styleCode: "asc" },
  });
}
