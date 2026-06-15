import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { DEFAULT_TEMPLATES } from "./template-data";

export { DEFAULT_TEMPLATES } from "./template-data";
export type { TemplateDef } from "./template-data";

const STAGES = ["PRE_PRODUCTION", "SAMPLING", "PRODUCTION_QC", "SHIPPING"] as const;

export async function seedTemplates(): Promise<void> {
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.taMilestoneTemplate.upsert({ where: { key: t.key }, update: {}, create: t });
  }
}

/** Default `false` → only active templates; pass true to include archived (settings view). */
export async function listTemplates(actor: SessionUser, includeInactive = false) {
  assertPermission(actor, "criticalPath", "view");
  return prisma.taMilestoneTemplate.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ active: "desc" }, { position: "asc" }],
  });
}

export const templateSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, underscores"),
  name: z.string().min(1),
  stage: z.enum(STAGES),
  offsetDays: z.coerce.number().int(),
  position: z.coerce.number().int().nonnegative(),
});
export type TemplateInput = z.input<typeof templateSchema>;

export async function createTemplate(actor: SessionUser, input: TemplateInput) {
  assertPermission(actor, "criticalPath", "edit");
  const data = templateSchema.parse(input);
  try {
    const t = await prisma.taMilestoneTemplate.create({ data });
    await recordAudit({ userId: actor.id, entityType: "TaMilestoneTemplate", entityId: t.id, action: "create", after: data });
    return t;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A milestone with key "${data.key}" already exists`);
    }
    throw e;
  }
}

export const templateUpdateSchema = templateSchema.partial().omit({ key: true });

export async function updateTemplate(actor: SessionUser, id: string, input: z.input<typeof templateUpdateSchema>) {
  assertPermission(actor, "criticalPath", "edit");
  const data = templateUpdateSchema.parse(input);
  const t = await prisma.taMilestoneTemplate.update({ where: { id }, data });
  await recordAudit({ userId: actor.id, entityType: "TaMilestoneTemplate", entityId: id, action: "edit", after: data });
  return t;
}

export async function setTemplateActive(actor: SessionUser, id: string, active: boolean) {
  assertPermission(actor, "criticalPath", "edit");
  const t = await prisma.taMilestoneTemplate.update({ where: { id }, data: { active } });
  await recordAudit({ userId: actor.id, entityType: "TaMilestoneTemplate", entityId: id, action: "edit", after: { active } });
  return t;
}
