import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createSizeScaleSchema = z.object({
  name: z.string().min(1),
  sizes: z.array(z.string().min(1)).min(1, "At least one size required"),
});
export type CreateSizeScaleInput = z.infer<typeof createSizeScaleSchema>;

export async function createSizeScale(actor: SessionUser, input: CreateSizeScaleInput) {
  assertPermission(actor, "masterData", "create");
  const data = createSizeScaleSchema.parse(input);
  if (await prisma.sizeScale.findUnique({ where: { name: data.name } })) {
    throw new Error(`A size scale named ${data.name} already exists`);
  }
  const scale = await prisma.sizeScale.create({
    data: {
      name: data.name,
      sizes: { create: data.sizes.map((label, position) => ({ label, position })) },
    },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "SizeScale",
    entityId: scale.id,
    action: "create",
    after: { name: scale.name, sizes: data.sizes },
  });
  return scale;
}

export async function listSizeScales(actor: SessionUser) {
  assertPermission(actor, "masterData", "view");
  return prisma.sizeScale.findMany({
    where: { active: true },
    include: { sizes: { orderBy: { position: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export const createColourSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
});
export type CreateColourInput = z.infer<typeof createColourSchema>;

export async function createColour(actor: SessionUser, input: CreateColourInput) {
  assertPermission(actor, "masterData", "create");
  const data = createColourSchema.parse(input);
  if (await prisma.colour.findUnique({ where: { name: data.name } })) {
    throw new Error(`A colour named ${data.name} already exists`);
  }
  const colour = await prisma.colour.create({ data });
  await recordAudit({
    userId: actor.id,
    entityType: "Colour",
    entityId: colour.id,
    action: "create",
    after: { name: colour.name },
  });
  return colour;
}

export async function listColours(actor: SessionUser) {
  assertPermission(actor, "masterData", "view");
  return prisma.colour.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}
