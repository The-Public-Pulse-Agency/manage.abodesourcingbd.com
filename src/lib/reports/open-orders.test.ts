import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "@/lib/orders/po";
import { setOrderLine } from "@/lib/orders/lines";
import { confirmPurchaseOrder } from "@/lib/orders/confirm";
import { approveCosting } from "@/lib/orders/costing";
import { createShipment } from "@/lib/shipment/shipment";
import { listOpenOrders } from "./open-orders";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("listOpenOrders — net FOB", () => {
  it("reports the qty-weighted net FOB per style", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
    const po = await createPurchaseOrder(admin, { poNumber: "P1", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [
        { label: "M", qty: 100, netFob: 2, sellFob: 3 },
        { label: "L", qty: 100, netFob: 4, sellFob: 5 },
      ],
    });

    const { rows } = await listOpenOrders(admin, {});
    const sb = rows[0].styleBreakdown[0];
    expect(sb.qty).toBe(200);
    expect(sb.value).toBe(800); // 100*3 + 100*5
    expect(sb.netFob).toBe(3); // qty-weighted (100*2 + 100*4) / 200
  });

  it("weights net FOB over the REMAINING balance after a partial shipment", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
    const po = await createPurchaseOrder(admin, { poNumber: "P1", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    const line = await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [
        { label: "M", qty: 100, netFob: 2, sellFob: 3 },
        { label: "L", qty: 100, netFob: 4, sellFob: 5 },
      ],
    });
    await approveCosting(accounts, po.id);
    await confirmPurchaseOrder(admin, po.id);
    await createShipment(admin, { reference: "SHP-1", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 60 }] }] });

    const { rows } = await listOpenOrders(admin, {});
    const sb = rows[0].styleBreakdown[0];
    expect(sb.qty).toBe(140); // remaining: M 40 + L 100
    expect(sb.netFob).toBe(3.4286); // (40*2 + 100*4) / 140
  });
});
