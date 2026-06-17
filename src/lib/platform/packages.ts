import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { assertPlatformOperator } from "./guard";
import { recordAudit } from "@/lib/audit";

export async function listPackages(actor: SessionUser) {
  assertPlatformOperator(actor);
  assertPermission(actor, "packages", "view");
  return prisma.package.findMany({ orderBy: [{ active: "desc" }, { priceBdt: "asc" }] });
}

export const packageSchema = z.object({
  name: z.string().min(1),
  priceBdt: z.coerce.number().int().nonnegative(),
  periodDays: z.coerce.number().int().positive(),
});
export type PackageInput = z.input<typeof packageSchema>;

export async function createPackage(actor: SessionUser, input: PackageInput) {
  assertPlatformOperator(actor);
  assertPermission(actor, "packages", "create");
  const data = packageSchema.parse(input);
  const p = await prisma.package.create({ data });
  await recordAudit({ userId: actor.id, entityType: "Package", entityId: p.id, action: "create", after: data });
  return p;
}

export async function updatePackage(actor: SessionUser, id: string, input: Partial<PackageInput> & { active?: boolean }) {
  assertPlatformOperator(actor);
  assertPermission(actor, "packages", "edit");
  const data: Record<string, string | number | boolean> = {};
  if (input.name) data.name = String(input.name);
  if (input.priceBdt !== undefined) data.priceBdt = Math.max(0, Math.round(Number(input.priceBdt)));
  if (input.periodDays !== undefined) data.periodDays = Math.max(1, Math.round(Number(input.periodDays)));
  if (input.active !== undefined) data.active = input.active;
  const p = await prisma.package.update({ where: { id }, data });
  await recordAudit({ userId: actor.id, entityType: "Package", entityId: id, action: "edit", after: data });
  return p;
}
