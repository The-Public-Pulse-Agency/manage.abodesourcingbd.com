import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { setLineSchema, type SetLineInput } from "./schema";

const STRUCTURE_TERMINAL = ["CLOSED", "CANCELLED"] as const;

/**
 * Lines (qty/style/colour/sizes) are freely editable on a DRAFT order. After confirmation an
 * orders:edit user (ADMIN/merchandiser) may still correct them, but ONLY in a safe window:
 * the order isn't closed/cancelled AND nothing has been booked downstream (no shipment lines,
 * no invoices). Once goods ship or an invoice is raised, structure is locked.
 */
async function assertLineStructureEditable(
  tx: Prisma.TransactionClient,
  companyId: string,
  poId: string,
  status: string,
  isAdmin: boolean,
): Promise<void> {
  if (status === "DRAFT") return;
  // ADMIN force-edit override: corrects a wrong entry even after the order is confirmed,
  // shipped, or invoiced (restating its value/balance is accepted — it's a deliberate fix).
  if (isAdmin) return;
  if ((STRUCTURE_TERMINAL as readonly string[]).includes(status)) {
    throw new Error(`Only DRAFT orders can be edited (status: ${status})`);
  }
  const [shipped, invoiced] = await Promise.all([
    tx.shipmentLine.count({ where: { orderLine: { poId, companyId } } }),
    tx.invoice.count({ where: { poId, companyId } }),
  ]);
  if (shipped > 0 || invoiced > 0) {
    throw new Error("This order has shipments or invoices — only an Admin can change its lines now (you can still correct prices).");
  }
}

/** The privileged force-edit override is the ADMIN system role. */
const isAdmin = (actor: SessionUser) => actor.role === "ADMIN";

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
    await assertLineStructureEditable(tx, tenantId(actor), poId, po.status, isAdmin(actor));
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

export type EditLineInput = { styleId: string; colourId?: string; sizes: SetLineInput["sizes"] };

/**
 * Edit an EXISTING line in place — style, colour and per-size quantities — reusing setOrderLine
 * (so the same DRAFT / safe-window / ADMIN-override guards apply). When the style or colour
 * changes the line moves to a new (style,colour) key, so we create the new line first and then
 * drop the old one; when the key is unchanged setOrderLine simply replaces the sizes in place.
 */
export async function editOrderLine(actor: SessionUser, lineId: string, input: EditLineInput) {
  const cid = tenantId(actor);
  const line = await prisma.orderLine.findFirst({
    where: { id: lineId, companyId: cid },
    select: { poId: true, styleId: true, colourKey: true, sizeScaleId: true },
  });
  if (!line) throw new Error("Order line not found");
  const keyChanged = input.styleId !== line.styleId || (input.colourId ?? "") !== line.colourKey;
  const payload = { styleId: input.styleId, colourId: input.colourId, sizeScaleId: line.sizeScaleId ?? undefined, sizes: input.sizes };
  await setOrderLine(actor, line.poId, payload); // create/replace the (new) line
  if (keyChanged) await removeOrderLine(actor, lineId); // drop the old line only after the new one exists
}

// Prices may be corrected on un-finished orders that have NOT yet been booked downstream.
// Once an invoice exists, the revenue is committed, so price edits are refused to avoid
// silently restating booked value/margin.
const PRICE_EDITABLE_STATUSES = ["DRAFT", "CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED", "ON_HOLD"] as const;

/**
 * Correct the FOB prices (net/sell) on an existing line's sizes WITHOUT changing qty/style —
 * usable after an order is confirmed (e.g. a sell price was missed at entry). Gated by
 * orders:edit (the same authority that historically owned line edits — excludes the
 * read-only ACCOUNTS role from touching sell-side revenue). Allowed only on an explicit
 * allow-list of pre-booking statuses AND only while no invoice exists for the PO.
 */
export async function updateLinePrices(
  actor: SessionUser,
  orderLineId: string,
  prices: { sizeId: string; netFob: number; sellFob: number }[],
) {
  assertPermission(actor, "orders", "edit");
  const cid = tenantId(actor);
  const line = await prisma.orderLine.findFirst({
    where: { id: orderLineId, companyId: cid },
    include: { po: { select: { id: true, status: true } }, sizes: { select: { id: true, label: true, netFob: true, sellFob: true } } },
  });
  if (!line) throw new Error("Order line not found");
  // ADMIN may force-correct prices on any order (incl. invoiced); others only pre-booking.
  if (!isAdmin(actor)) {
    if (!(PRICE_EDITABLE_STATUSES as readonly string[]).includes(line.po.status)) {
      throw new Error(`Cannot edit prices on a ${line.po.status} order`);
    }
    const invoiced = await prisma.invoice.count({ where: { poId: line.po.id, companyId: cid } });
    if (invoiced > 0) throw new Error("Cannot edit prices after an invoice has been raised for this order");
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
  await recordAudit({
    userId: actor.id,
    entityType: "OrderLine",
    entityId: orderLineId,
    action: "edit",
    before: { poId: line.po.id, sizes: line.sizes.map((s) => ({ sizeId: s.id, label: s.label, netFob: String(s.netFob), sellFob: String(s.sellFob) })) },
    after: { poId: line.po.id, prices },
  });
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
  await prisma.$transaction((tx) => assertLineStructureEditable(tx, tenantId(actor), line.poId, line.po.status, isAdmin(actor)));
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
