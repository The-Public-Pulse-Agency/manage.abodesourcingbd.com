import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { DEFAULT_TEMPLATES } from "./template-data";

export { DEFAULT_TEMPLATES } from "./template-data";
export type { TemplateDef } from "./template-data";

const STAGES = ["PRE_PRODUCTION", "SAMPLING", "PRODUCTION_QC", "SHIPPING"] as const;

/** Seed the default critical-path template for a company (idempotent per company).
 * Accepts an optional transaction client so signup can provision atomically. */
export async function seedTemplates(companyId: string, db: Prisma.TransactionClient = prisma): Promise<void> {
  const existing = await db.taMilestoneTemplate.count({ where: { companyId } });
  if (existing > 0) return;
  await db.taMilestoneTemplate.createMany({
    data: DEFAULT_TEMPLATES.map((t) => ({ ...t, companyId })),
  });
}

/** Default `false` → only active templates; pass true to include archived (settings view). */
export async function listTemplates(actor: SessionUser, includeInactive = false) {
  assertPermission(actor, "criticalPath", "view");
  return prisma.taMilestoneTemplate.findMany({
    where: includeInactive
      ? { companyId: tenantId(actor) }
      : { active: true, companyId: tenantId(actor) },
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
    const t = await prisma.taMilestoneTemplate.create({
      data: { ...data, companyId: tenantId(actor) },
    });
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
  const res = await prisma.taMilestoneTemplate.updateMany({
    where: { id, companyId: tenantId(actor) },
    data,
  });
  if (res.count === 0) throw new Error("Milestone template not found");
  const t = await prisma.taMilestoneTemplate.findFirstOrThrow({
    where: { id, companyId: tenantId(actor) },
  });
  await recordAudit({ userId: actor.id, entityType: "TaMilestoneTemplate", entityId: id, action: "edit", after: data });
  return t;
}

export async function setTemplateActive(actor: SessionUser, id: string, active: boolean) {
  assertPermission(actor, "criticalPath", "edit");
  const res = await prisma.taMilestoneTemplate.updateMany({
    where: { id, companyId: tenantId(actor) },
    data: { active },
  });
  if (res.count === 0) throw new Error("Milestone template not found");
  const t = await prisma.taMilestoneTemplate.findFirstOrThrow({
    where: { id, companyId: tenantId(actor) },
  });
  await recordAudit({ userId: actor.id, entityType: "TaMilestoneTemplate", entityId: id, action: "edit", after: { active } });
  return t;
}
