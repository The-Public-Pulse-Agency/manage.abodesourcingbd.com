import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { slugCode } from "@/lib/text";

export const createBuyerSchema = z.object({ name: z.string().min(1) });
export type CreateBuyerInput = z.infer<typeof createBuyerSchema>;

export const updateBuyerSchema = createBuyerSchema.partial();
export type UpdateBuyerInput = z.infer<typeof updateBuyerSchema>;

export const createBrandSchema = z.object({
  buyerId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = createBrandSchema.partial();
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

export async function createBuyer(actor: SessionUser, input: CreateBuyerInput) {
  assertPermission(actor, "masterData", "create");
  const data = createBuyerSchema.parse(input);
  const code = slugCode(data.name);
  if (await prisma.buyer.findFirst({ where: { code, companyId: tenantId(actor) } })) {
    throw new Error(`A buyer with code ${code} already exists`);
  }
  const buyer = await prisma.buyer.create({
    data: { name: data.name, code, companyId: tenantId(actor) },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "Buyer",
    entityId: buyer.id,
    action: "create",
    after: { name: buyer.name, code: buyer.code },
  });
  return buyer;
}

export async function listBuyers(actor: SessionUser, opts: { includeInactive?: boolean } = {}) {
  assertPermission(actor, "masterData", "view");
  return prisma.buyer.findMany({
    where: { companyId: tenantId(actor), ...(opts.includeInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
  });
}

export async function getBuyer(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "view");
  return prisma.buyer.findFirst({ where: { id, companyId: tenantId(actor) } });
}

export async function updateBuyer(actor: SessionUser, id: string, input: UpdateBuyerInput) {
  assertPermission(actor, "masterData", "edit");
  const data = updateBuyerSchema.parse(input);
  // `code` is derived from the buyer name, so re-derive it when the name changes.
  const patch: { name?: string; code?: string } =
    data.name !== undefined ? { name: data.name, code: slugCode(data.name) } : {};
  const existing = await prisma.buyer.findFirst({
    where: { id, companyId: tenantId(actor) },
    select: { id: true },
  });
  if (!existing) throw new Error("Buyer not found");
  try {
    const buyer = await prisma.buyer.update({ where: { id }, data: patch });
    await recordAudit({
      userId: actor.id,
      entityType: "Buyer",
      entityId: id,
      action: "edit",
      after: patch,
    });
    return buyer;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("A buyer with that code already exists");
    }
    throw e;
  }
}

export async function createBrand(actor: SessionUser, input: CreateBrandInput) {
  assertPermission(actor, "masterData", "create");
  const data = createBrandSchema.parse(input);
  const code = slugCode(data.code);
  const dup = await prisma.brand.findFirst({
    where: { buyerId: data.buyerId, code, companyId: tenantId(actor) },
  });
  if (dup) throw new Error(`A brand with code ${code} already exists for this buyer`);
  const brand = await prisma.brand.create({
    data: { buyerId: data.buyerId, name: data.name, code, companyId: tenantId(actor) },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "Brand",
    entityId: brand.id,
    action: "create",
    after: { name: brand.name, code: brand.code, buyerId: brand.buyerId },
  });
  return brand;
}

export async function listBrands(actor: SessionUser, buyerId?: string) {
  assertPermission(actor, "masterData", "view");
  return prisma.brand.findMany({
    where: { companyId: tenantId(actor), active: true, ...(buyerId ? { buyerId } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function getBrand(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "view");
  return prisma.brand.findFirst({ where: { id, companyId: tenantId(actor) } });
}

export async function updateBrand(actor: SessionUser, id: string, input: UpdateBrandInput) {
  assertPermission(actor, "masterData", "edit");
  const data = updateBrandSchema.parse(input);
  const patch: Prisma.BrandUpdateInput = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.code !== undefined ? { code: slugCode(data.code) } : {}),
    ...(data.buyerId !== undefined ? { buyer: { connect: { id: data.buyerId } } } : {}),
  };
  const existing = await prisma.brand.findFirst({
    where: { id, companyId: tenantId(actor) },
    select: { id: true },
  });
  if (!existing) throw new Error("Brand not found");
  try {
    const brand = await prisma.brand.update({ where: { id }, data: patch });
    await recordAudit({
      userId: actor.id,
      entityType: "Brand",
      entityId: id,
      action: "edit",
      after: {
        ...(data.name !== undefined ? { name: brand.name } : {}),
        ...(data.code !== undefined ? { code: brand.code } : {}),
        ...(data.buyerId !== undefined ? { buyerId: brand.buyerId } : {}),
      },
    });
    return brand;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("A brand with that code already exists for this buyer");
    }
    throw e;
  }
}
