import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
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
export async function orderedQtyFor(poId: string): Promise<number> {
  const lines = await prisma.orderLine.findMany({ where: { poId }, include: { sizes: true } });
  return lines.reduce((sum, l) => sum + lineMills(l.sizes).qty, 0);
}

async function loadProductionPo(poId: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new Error("Purchase order not found");
  if (po.status === "DRAFT" || po.status === "CANCELLED" || po.status === "CLOSED") {
    throw new Error(`Cannot record production on a ${po.status} order`);
  }
  return po;
}

export async function upsertProduction(actor: SessionUser, poId: string, input: ProductionInput) {
  assertPermission(actor, "productionQc", "edit");
  await loadProductionPo(poId);
  const data = productionSchema.parse(input);
  const before = await prisma.productionRecord.findUnique({ where: { poId } });

  let record;
  try {
    record = await prisma.productionRecord.upsert({
      where: { poId },
      update: data,
      create: { poId, ...data },
    });
  } catch (e) {
    // Concurrent first-time upsert: the losing INSERT hits @@unique([poId]); fall back to update.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      record = await prisma.productionRecord.update({ where: { poId }, data });
    } else {
      throw e;
    }
  }

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
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new Error("Purchase order not found");
  const record = await prisma.productionRecord.findUnique({ where: { poId } });
  const orderedQty = await orderedQtyFor(poId);
  const q = {
    cutQty: record?.cutQty ?? 0,
    sewQty: record?.sewQty ?? 0,
    finishQty: record?.finishQty ?? 0,
  };
  return { ...q, orderedQty, progress: productionProgress(orderedQty, q) };
}
