import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { lineMills } from "@/lib/orders/money";
import { productionProgress } from "./progress";

export const productionSchema = z
  .object({
    cutQty: z.number().int().nonnegative(),
    sewQty: z.number().int().nonnegative(),
    finishQty: z.number().int().nonnegative(),
  })
  .refine((v) => v.sewQty <= v.cutQty, { message: "sewQty cannot exceed cutQty", path: ["sewQty"] })
  .refine((v) => v.finishQty <= v.sewQty, {
    message: "finishQty cannot exceed sewQty",
    path: ["finishQty"],
  });
export type ProductionInput = z.input<typeof productionSchema>;

/** Sum size-wise ordered quantity across all of a PO's lines. */
export async function orderedQtyFor(actor: SessionUser, poId: string): Promise<number> {
  const lines = await prisma.orderLine.findMany({
    where: { poId, companyId: tenantId(actor) },
    include: { sizes: true },
  });
  return lines.reduce((sum, l) => sum + lineMills(l.sizes).qty, 0);
}

async function loadProductionPo(actor: SessionUser, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
  });
  if (!po) throw new Error("Purchase order not found");
  if (po.status === "DRAFT" || po.status === "CANCELLED" || po.status === "CLOSED") {
    throw new Error(`Cannot record production on a ${po.status} order`);
  }
  return po;
}

export async function upsertProduction(actor: SessionUser, poId: string, input: ProductionInput) {
  assertPermission(actor, "productionQc", "edit");
  await loadProductionPo(actor, poId);
  const data = productionSchema.parse(input);
  // productionRecord is keyed on poId @unique, so a unique-key upsert can't be scoped by
  // companyId. The PO was already tenant-verified above, so find-then-create/update under
  // the tenant filter is equivalent and keeps cross-tenant rows unreachable.
  const before = await prisma.productionRecord.findFirst({
    where: { poId, companyId: tenantId(actor) },
  });

  if (before) {
    await prisma.productionRecord.updateMany({
      where: { poId, companyId: tenantId(actor) },
      data,
    });
  } else {
    try {
      await prisma.productionRecord.create({
        data: { companyId: tenantId(actor), poId, ...data },
      });
    } catch (e) {
      // Concurrent first-time create: the losing INSERT hits @@unique([poId]); fall back to update.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        await prisma.productionRecord.updateMany({
          where: { poId, companyId: tenantId(actor) },
          data,
        });
      } else {
        throw e;
      }
    }
  }

  const record = await prisma.productionRecord.findFirstOrThrow({
    where: { poId, companyId: tenantId(actor) },
  });

  await recordAudit({
    userId: actor.id,
    entityType: "ProductionRecord",
    entityId: record.id,
    action: "edit",
    before: before
      ? { cutQty: before.cutQty, sewQty: before.sewQty, finishQty: before.finishQty }
      : undefined,
    after: data,
  });
  return record;
}

export async function getProduction(actor: SessionUser, poId: string) {
  assertPermission(actor, "productionQc", "view");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, companyId: tenantId(actor) },
  });
  if (!po) throw new Error("Purchase order not found");
  const record = await prisma.productionRecord.findFirst({
    where: { poId, companyId: tenantId(actor) },
  });
  const orderedQty = await orderedQtyFor(actor, poId);
  const q = {
    cutQty: record?.cutQty ?? 0,
    sewQty: record?.sewQty ?? 0,
    finishQty: record?.finishQty ?? 0,
  };
  return { ...q, orderedQty, progress: productionProgress(orderedQty, q) };
}
