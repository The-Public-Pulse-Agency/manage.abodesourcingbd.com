import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { slugCode } from "@/lib/text";

export const factoryTypes = ["KNIT", "WOVEN", "SWEATER", "OTHER"] as const;

export const createFactorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(factoryTypes).default("KNIT"),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});
export type CreateFactoryInput = z.infer<typeof createFactorySchema>;

export const updateFactorySchema = createFactorySchema.partial();
export type UpdateFactoryInput = z.infer<typeof updateFactorySchema>;

export async function createFactory(actor: SessionUser, input: CreateFactoryInput) {
  assertPermission(actor, "masterData", "create");
  const data = createFactorySchema.parse(input);
  const code = slugCode(data.name);
  if (await prisma.factory.findUnique({ where: { code } })) {
    throw new Error(`A factory with code ${code} already exists`);
  }
  const factory = await prisma.factory.create({ data: { ...data, code } });
  await recordAudit({
    userId: actor.id,
    entityType: "Factory",
    entityId: factory.id,
    action: "create",
    after: { name: factory.name, code: factory.code },
  });
  return factory;
}

export async function listFactories(
  actor: SessionUser,
  opts: { includeInactive?: boolean } = {},
) {
  assertPermission(actor, "masterData", "view");
  return prisma.factory.findMany({
    where: opts.includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getFactory(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "view");
  return prisma.factory.findUnique({ where: { id } });
}

export async function updateFactory(
  actor: SessionUser,
  id: string,
  input: UpdateFactoryInput,
) {
  assertPermission(actor, "masterData", "edit");
  const data = updateFactorySchema.parse(input);
  let factory;
  try {
    factory = await prisma.factory.update({ where: { id }, data });
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error("A factory with these details already exists");
    }
    throw e;
  }
  await recordAudit({
    userId: actor.id,
    entityType: "Factory",
    entityId: id,
    action: "edit",
    after: data,
  });
  return factory;
}

export async function setFactoryActive(actor: SessionUser, id: string, active: boolean) {
  assertPermission(actor, "masterData", "edit");
  const factory = await prisma.factory.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: actor.id,
    entityType: "Factory",
    entityId: id,
    action: "edit",
    after: { active },
  });
  return factory;
}
