import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { setLineSchema, type SetLineInput } from "./schema";

export async function setOrderLine(actor: SessionUser, poId: string, input: SetLineInput) {
  assertPermission(actor, "orders", "edit");
  const data = setLineSchema.parse(input);
  const colourKey = data.colourId ?? "";

  const line = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    if (po.status !== "DRAFT") {
      throw new Error(`Only DRAFT orders can be edited (status: ${po.status})`);
    }
    const ol = await tx.orderLine.upsert({
      where: {
        poId_styleId_colourKey: { poId, styleId: data.styleId, colourKey },
      },
      create: {
        poId,
        styleId: data.styleId,
        colourId: data.colourId ?? null,
        colourKey,
        sizeScaleId: data.sizeScaleId ?? null,
      },
      update: { sizeScaleId: data.sizeScaleId ?? null },
    });
    await tx.orderLineSize.deleteMany({ where: { orderLineId: ol.id } });
    await tx.orderLineSize.createMany({
      data: data.sizes.map((s, i) => ({
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
  const line = await prisma.orderLine.findUniqueOrThrow({
    where: { id: lineId },
    include: { po: true, sizes: true },
  });
  if (line.po.status !== "DRAFT") {
    throw new Error(`Only DRAFT orders can be edited (status: ${line.po.status})`);
  }
  await prisma.orderLine.delete({ where: { id: lineId } });
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
