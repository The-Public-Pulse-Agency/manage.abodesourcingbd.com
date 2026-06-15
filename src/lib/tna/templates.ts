import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { DEFAULT_TEMPLATES } from "./template-data";

export { DEFAULT_TEMPLATES } from "./template-data";
export type { TemplateDef } from "./template-data";

export async function seedTemplates(): Promise<void> {
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.taMilestoneTemplate.upsert({ where: { key: t.key }, update: {}, create: t });
  }
}

export async function listTemplates(actor: SessionUser) {
  assertPermission(actor, "criticalPath", "view");
  return prisma.taMilestoneTemplate.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
  });
}
