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
