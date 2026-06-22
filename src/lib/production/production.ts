import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { lineMills } from "@/lib/orders/money";
import { productionProgress, type ProductionPct } from "./progress";

// Per-line status remarks normalise empty → null so a cleared field is actually cleared.
const remark = z.string().optional().transform((v) => (v && v.trim() ? v.trim() : null));

export const productionSchema = z
  .object({
    cutQty: z.number().int().nonnegative(),
    sewQty: z.number().int().nonnegative(),
    finishQty: z.number().int().nonnegative(),
    shadeApproval: remark,
    fabricWashTest: remark,
    garmentsWashTest: remark,
    topSampleStatus: remark,
  })
  .refine((v) => v.sewQty <= v.cutQty, { message: "sewQty cannot exceed cutQty", path: ["sewQty"] })
  .refine((v) => v.finishQty <= v.sewQty, {
    message: "finishQty cannot exceed sewQty",
    path: ["finishQty"],
  });
export type ProductionInput = z.input<typeof productionSchema>;

const STATUS_BLOCK = ["DRAFT", "CANCELLED", "CLOSED"] as const;

/** Sum size-wise ordered quantity across all of a PO's lines. */
export async function orderedQtyFor(actor: SessionUser, poId: string): Promise<number> {
  const lines = await prisma.orderLine.findMany({
    where: { poId, companyId: tenantId(actor) },
    include: { sizes: true },
  });
  return lines.reduce((sum, l) => sum + lineMills(l.sizes).qty, 0);
}

/** Record cut/sew/finish progress for ONE order line (style/colour). Tenant-scoped. */
export async function upsertProduction(actor: SessionUser, orderLineId: string, input: ProductionInput) {
  assertPermission(actor, "production", "edit");
  const cid = tenantId(actor);
  const line = await prisma.orderLine.findFirst({
    where: { id: orderLineId, companyId: cid },
    include: { sizes: true, po: { select: { id: true, status: true } } },
  });
  if (!line) throw new Error("Order line not found");
  if ((STATUS_BLOCK as readonly string[]).includes(line.po.status)) {
    throw new Error(`Cannot record production on a ${line.po.status} order`);
  }
  const data = productionSchema.parse(input);
  // Over-production is allowed: factories routinely cut/produce above the order qty. The only
  // constraints are the internal sequence (sew ≤ cut, finish ≤ sew) enforced in productionSchema;
  // cut may exceed ordered (progress simply shows >100%).

  // orderLineId is @unique, so scope the find/update by tenant (the line was already verified).
  const before = await prisma.productionRecord.findFirst({ where: { orderLineId, companyId: cid } });
  if (before) {
    await prisma.productionRecord.updateMany({ where: { orderLineId, companyId: cid }, data });
  } else {
    try {
      await prisma.productionRecord.create({ data: { companyId: cid, poId: line.po.id, orderLineId, ...data } });
    } catch (e) {
      // Concurrent first-time create loses the @unique(orderLineId) race → fall back to update.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        await prisma.productionRecord.updateMany({ where: { orderLineId, companyId: cid }, data });
      } else throw e;
    }
  }

  const record = await prisma.productionRecord.findFirstOrThrow({ where: { orderLineId, companyId: cid } });
  await recordAudit({
    userId: actor.id,
    entityType: "ProductionRecord",
    entityId: record.id,
    action: "edit",
    before: before ? { cutQty: before.cutQty, sewQty: before.sewQty, finishQty: before.finishQty } : undefined,
    after: data,
  });
  return record;
}

export type ProductionLine = {
  orderLineId: string;
  style: string;
  colour: string;
  orderedQty: number;
  cutQty: number;
  sewQty: number;
  finishQty: number;
  shadeApproval: string;
  fabricWashTest: string;
  garmentsWashTest: string;
  topSampleStatus: string;
  progress: ProductionPct;
};

export type ProductionView = {
  orderedQty: number;
  cutQty: number;
  sewQty: number;
  finishQty: number;
  progress: ProductionPct;
  lines: ProductionLine[];
};

/** Per-line production for a PO (style/colour breakdown) + the overall aggregate. */
export async function getProduction(actor: SessionUser, poId: string): Promise<ProductionView> {
  assertPermission(actor, "production", "view");
  const cid = tenantId(actor);
  const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, companyId: cid } });
  if (!po) throw new Error("Purchase order not found");

  const [lines, records] = await Promise.all([
    prisma.orderLine.findMany({
      where: { poId, companyId: cid },
      include: { sizes: true, style: true, colour: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.productionRecord.findMany({ where: { poId, companyId: cid } }),
  ]);
  const byLine = new Map(records.map((r) => [r.orderLineId, r]));

  let orderedQty = 0, cutQty = 0, sewQty = 0, finishQty = 0;
  const lineRows: ProductionLine[] = lines.map((l) => {
    const ordered = lineMills(l.sizes).qty;
    const rec = byLine.get(l.id);
    const q = { cutQty: rec?.cutQty ?? 0, sewQty: rec?.sewQty ?? 0, finishQty: rec?.finishQty ?? 0 };
    orderedQty += ordered;
    cutQty += q.cutQty;
    sewQty += q.sewQty;
    finishQty += q.finishQty;
    return {
      orderLineId: l.id,
      style: l.style?.styleCode ?? l.style?.name ?? "—",
      colour: l.colour?.name ?? "—",
      orderedQty: ordered,
      ...q,
      shadeApproval: rec?.shadeApproval ?? "",
      fabricWashTest: rec?.fabricWashTest ?? "",
      garmentsWashTest: rec?.garmentsWashTest ?? "",
      topSampleStatus: rec?.topSampleStatus ?? "",
      progress: productionProgress(ordered, q),
    };
  });

  const overall = { cutQty, sewQty, finishQty };
  return { orderedQty, ...overall, progress: productionProgress(orderedQty, overall), lines: lineRows };
}
