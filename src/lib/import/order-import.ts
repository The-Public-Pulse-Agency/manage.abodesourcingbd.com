import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { slugCode } from "@/lib/text";
import { parseStyleName } from "./normalize";
import { createPurchaseOrder } from "@/lib/orders/po";
import { setOrderLine } from "@/lib/orders/lines";
import type { OrderImportRow } from "./orders-excel";

export type OrderImportSummary = { orders: number; lines: number; skipped: number; errors: string[] };

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/**
 * Create orders from parsed Excel rows. Master data (buyer/brand/factory/style/colour)
 * is found-or-created by code/name; new POs are created DRAFT with their size-broken
 * lines. Re-importing the same PO updates its lines (idempotent-ish).
 */
export async function importOrders(actor: SessionUser, rows: OrderImportRow[]): Promise<OrderImportSummary> {
  assertPermission(actor, "orders", "create");
  const companyId = tenantId(actor);
  let orders = 0, lines = 0, skipped = 0;
  const errors: string[] = [];

  for (const [poNumber, poRows] of groupBy(rows, (r) => r.poNumber)) {
    try {
      const first = poRows[0];
      const buyer = await prisma.buyer.upsert({
        where: { companyId_code: { companyId, code: slugCode(first.buyer || poNumber) } },
        update: {}, create: { companyId, name: (first.buyer || "Unknown").trim(), code: slugCode(first.buyer || poNumber) },
      });
      const brandCode = slugCode(first.brand || first.buyer || "brand");
      const brand = await prisma.brand.upsert({
        where: { buyerId_code: { buyerId: buyer.id, code: brandCode } },
        update: {}, create: { companyId, buyerId: buyer.id, name: (first.brand || first.buyer || "Brand").trim(), code: brandCode },
      });
      const factory = await prisma.factory.upsert({
        where: { companyId_code: { companyId, code: slugCode(first.factory || "factory") } },
        update: {}, create: { companyId, name: (first.factory || "Unknown").trim(), code: slugCode(first.factory || "factory") },
      });

      let po = await prisma.purchaseOrder.findFirst({ where: { companyId, poNumber, buyerId: buyer.id, factoryId: factory.id } });
      if (!po) {
        po = await createPurchaseOrder(actor, {
          poNumber, buyerId: buyer.id, brandId: brand.id, factoryId: factory.id,
          orderDate: first.orderDate || undefined, exFactoryDate: first.shipDate || undefined, currency: first.currency || "USD",
        });
        orders++;
      }

      for (const [, lineRows] of groupBy(poRows, (r) => `${r.style}|${r.colour}`)) {
        const lr = lineRows[0];
        const { code: styleCode, name: styleName } = parseStyleName(lr.style || "STYLE");
        const style = await prisma.style.upsert({
          where: { brandId_styleCode: { brandId: brand.id, styleCode } },
          update: {}, create: { companyId, brandId: brand.id, styleCode, name: styleName },
        });
        let colourId: string | undefined;
        if (lr.colour) {
          const colour = await prisma.colour.upsert({
            where: { companyId_name: { companyId, name: lr.colour } },
            update: {}, create: { companyId, name: lr.colour },
          });
          colourId = colour.id;
        }
        const sizeMap = new Map<string, { label: string; qty: number; netFob: number; sellFob: number }>();
        for (const r of lineRows) if (!sizeMap.has(r.size)) sizeMap.set(r.size, { label: r.size, qty: r.qty, netFob: r.netFob, sellFob: r.sellFob });
        await setOrderLine(actor, po.id, { styleId: style.id, colourId, sizes: [...sizeMap.values()] });
        lines++;
      }
    } catch (e) {
      skipped++;
      errors.push(`${poNumber}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  return { orders, lines, skipped, errors: errors.slice(0, 10) };
}
