import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { setLineSchema, type SetLineInput } from "./schema";

export async function setOrderLine(actor: SessionUser, poId: string, input: SetLineInput) {
  assertPermission(actor, "orders", "edit");
  const data = setLineSchema.parse(input);
  const colourKey = data.colourId ?? "";

  const line = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, companyId: tenantId(actor) },
    });
    if (!po) {
      throw new Error("Purchase order not found");
    }
    if (po.status !== "DRAFT") {
      throw new Error(`Only DRAFT orders can be edited (status: ${po.status})`);
    }
    // Cross-entity integrity: the style must belong to this order's brand.
    const style = await tx.style.findFirst({
      where: { id: data.styleId, companyId: tenantId(actor) },
    });
    if (!style) {
      throw new Error("Style not found");
    }
    if (style.brandId !== po.brandId) {
      throw new Error("Style does not belong to this order's brand");
    }
    const ol = await tx.orderLine.upsert({
      where: {
        poId_styleId_colourKey: { poId, styleId: data.styleId, colourKey },
      },
      create: {
        companyId: tenantId(actor),
        poId,
        styleId: data.styleId,
        colourId: data.colourId ?? null,
        colourKey,
        sizeScaleId: data.sizeScaleId ?? null,
      },
      update: { sizeScaleId: data.sizeScaleId ?? null },
    });
    await tx.orderLineSize.deleteMany({ where: { orderLineId: ol.id, companyId: tenantId(actor) } });
    await tx.orderLineSize.createMany({
      data: data.sizes.map((s, i) => ({
        companyId: tenantId(actor),
        orderLineId: ol.id,
        label: s.label,
        position: i,
        qty: s.qty,
        netFob: String(s.netFob),
        sellFob: String(s.sellFob),
      })),
    });
    return ol;
  });

  await recordAudit({
    userId: actor.id,
    entityType: "OrderLine",
    entityId: line.id,
    action: "edit",
    after: { poId, styleId: data.styleId, sizes: data.sizes.length },
  });
  return line;
}

const PRICE_LOCKED = ["CLOSED", "CANCELLED"] as const;

/**
 * Correct the FOB prices (net/sell) on an existing line's sizes WITHOUT changing qty/style —
 * usable after an order is confirmed (e.g. a sell price was missed at entry). Blocked only on
 * CLOSED/CANCELLED orders. Qty/structure stay locked; only prices change, so order value and
 * margin recompute from the corrected prices everywhere.
 */
export async function updateLinePrices(
  actor: SessionUser,
  orderLineId: string,
  prices: { sizeId: string; netFob: number; sellFob: number }[],
) {
  assertPermission(actor, "costing", "edit");
  const cid = tenantId(actor);
  const line = await prisma.orderLine.findFirst({
    where: { id: orderLineId, companyId: cid },
    include: { po: { select: { status: true } }, sizes: { select: { id: true } } },
  });
  if (!line) throw new Error("Order line not found");
  if ((PRICE_LOCKED as readonly string[]).includes(line.po.status)) {
    throw new Error(`Cannot edit prices on a ${line.po.status} order`);
  }
  const valid = new Set(line.sizes.map((s) => s.id));
  await prisma.$transaction(async (tx) => {
    for (const p of prices) {
      if (!valid.has(p.sizeId)) continue;
      const net = Math.max(0, Number(p.netFob) || 0);
      const sell = Math.max(0, Number(p.sellFob) || 0);
      await tx.orderLineSize.updateMany({
        where: { id: p.sizeId, orderLineId, companyId: cid },
        data: { netFob: String(net), sellFob: String(sell) },
      });
    }
  });
  await recordAudit({ userId: actor.id, entityType: "OrderLine", entityId: orderLineId, action: "edit", after: { pricesUpdated: prices.length } });
}

export async function removeOrderLine(actor: SessionUser, lineId: string) {
  assertPermission(actor, "orders", "delete");
  const line = await prisma.orderLine.findFirst({
    where: { id: lineId, companyId: tenantId(actor) },
    include: { po: true, sizes: true },
  });
  if (!line) {
    throw new Error("Order line not found");
  }
  if (line.po.status !== "DRAFT") {
    throw new Error(`Only DRAFT orders can be edited (status: ${line.po.status})`);
  }
  await prisma.orderLine.deleteMany({ where: { id: lineId, companyId: tenantId(actor) } });
  await recordAudit({
    userId: actor.id,
    entityType: "OrderLine",
    entityId: lineId,
    action: "delete",
    before: {
      poId: line.poId,
      styleId: line.styleId,
      sizes: line.sizes.map((s) => ({ label: s.label, qty: s.qty })),
    },
  });
}
