import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { slugCode } from "@/lib/text";

export const createBuyerSchema = z.object({ name: z.string().min(1) });
export type CreateBuyerInput = z.infer<typeof createBuyerSchema>;

export const createBrandSchema = z.object({
  buyerId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export async function createBuyer(actor: SessionUser, input: CreateBuyerInput) {
  assertPermission(actor, "masterData", "create");
  const data = createBuyerSchema.parse(input);
  const code = slugCode(data.name);
  if (await prisma.buyer.findUnique({ where: { code } })) {
    throw new Error(`A buyer with code ${code} already exists`);
  }
  const buyer = await prisma.buyer.create({ data: { name: data.name, code } });
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
    where: opts.includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
}

export async function createBrand(actor: SessionUser, input: CreateBrandInput) {
  assertPermission(actor, "masterData", "create");
  const data = createBrandSchema.parse(input);
  const code = slugCode(data.code);
  const dup = await prisma.brand.findUnique({
    where: { buyerId_code: { buyerId: data.buyerId, code } },
  });
  if (dup) throw new Error(`A brand with code ${code} already exists for this buyer`);
  const brand = await prisma.brand.create({
    data: { buyerId: data.buyerId, name: data.name, code },
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
    where: { active: true, ...(buyerId ? { buyerId } : {}) },
    orderBy: { name: "asc" },
  });
}
