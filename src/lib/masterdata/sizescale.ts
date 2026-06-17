import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createSizeScaleSchema = z.object({
  name: z.string().min(1),
  sizes: z.array(z.string().min(1)).min(1, "At least one size required"),
});
export type CreateSizeScaleInput = z.infer<typeof createSizeScaleSchema>;

export const updateSizeScaleSchema = createSizeScaleSchema.partial();
export type UpdateSizeScaleInput = z.infer<typeof updateSizeScaleSchema>;

export async function createSizeScale(actor: SessionUser, input: CreateSizeScaleInput) {
  assertPermission(actor, "masterData", "create");
  const data = createSizeScaleSchema.parse(input);
  if (await prisma.sizeScale.findFirst({ where: { name: data.name, companyId: tenantId(actor) } })) {
    throw new Error(`A size scale named ${data.name} already exists`);
  }
  const scale = await prisma.sizeScale.create({
    data: {
      name: data.name,
      companyId: tenantId(actor),
      sizes: {
        create: data.sizes.map((label, position) => ({
          label,
          position,
          companyId: tenantId(actor),
        })),
      },
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
    where: { companyId: tenantId(actor), active: true },
    include: { sizes: { orderBy: { position: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function getSizeScale(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "view");
  return prisma.sizeScale.findFirst({
    where: { id, companyId: tenantId(actor) },
    include: { sizes: { orderBy: { position: "asc" } } },
  });
}

export async function updateSizeScale(
  actor: SessionUser,
  id: string,
  input: UpdateSizeScaleInput,
) {
  assertPermission(actor, "masterData", "edit");
  const data = updateSizeScaleSchema.parse(input);
  const existing = await prisma.sizeScale.findFirst({
    where: { id, companyId: tenantId(actor) },
    select: { id: true },
  });
  if (!existing) throw new Error("Size scale not found");
  try {
    const scale = await prisma.sizeScale.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        // Mirror createSizeScale: map labels to {label, position}.
        // When sizes are provided, replace the whole set.
        ...(data.sizes !== undefined
          ? {
              sizes: {
                deleteMany: {},
                create: data.sizes.map((label, position) => ({
                  label,
                  position,
                  companyId: tenantId(actor),
                })),
              },
            }
          : {}),
      },
    });
    await recordAudit({
      userId: actor.id,
      entityType: "SizeScale",
      entityId: id,
      action: "edit",
      after: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.sizes !== undefined ? { sizes: data.sizes } : {}),
      },
    });
    return scale;
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error(`A size scale named ${data.name} already exists`);
    }
    throw e;
  }
}

export const createColourSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
});
export type CreateColourInput = z.infer<typeof createColourSchema>;

export const updateColourSchema = createColourSchema.partial();
export type UpdateColourInput = z.infer<typeof updateColourSchema>;

export async function createColour(actor: SessionUser, input: CreateColourInput) {
  assertPermission(actor, "masterData", "create");
  const data = createColourSchema.parse(input);
  if (await prisma.colour.findFirst({ where: { name: data.name, companyId: tenantId(actor) } })) {
    throw new Error(`A colour named ${data.name} already exists`);
  }
  const colour = await prisma.colour.create({ data: { ...data, companyId: tenantId(actor) } });
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
  return prisma.colour.findMany({
    where: { companyId: tenantId(actor), active: true },
    orderBy: { name: "asc" },
  });
}

export async function getColour(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "view");
  return prisma.colour.findFirst({ where: { id, companyId: tenantId(actor) } });
}

export async function updateColour(
  actor: SessionUser,
  id: string,
  input: UpdateColourInput,
) {
  assertPermission(actor, "masterData", "edit");
  const data = updateColourSchema.parse(input);
  const existing = await prisma.colour.findFirst({
    where: { id, companyId: tenantId(actor) },
    select: { id: true },
  });
  if (!existing) throw new Error("Colour not found");
  try {
    const colour = await prisma.colour.update({ where: { id }, data });
    await recordAudit({
      userId: actor.id,
      entityType: "Colour",
      entityId: id,
      action: "edit",
      after: data,
    });
    return colour;
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error(`A colour named ${data.name} already exists`);
    }
    throw e;
  }
}
