import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createColour } from "@/lib/masterdata/sizescale";
import { createPurchaseOrder } from "@/lib/orders/po";
import { setOrderLine } from "@/lib/orders/lines";
import { confirmPurchaseOrder } from "@/lib/orders/confirm";
import { approveCosting } from "@/lib/orders/costing";
import { createShipment } from "@/lib/shipment/shipment";
import { listOpenOrders } from "./open-orders";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };

async function scaffold() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, { poNumber: "P1", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
  return { buyer, brand, factory, style, po };
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("listOpenOrders — price-wise lines", () => {
  it("splits a style into one line per distinct price, ordered by size position", async () => {
    const { style, po } = await scaffold();
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [
        { label: "M", qty: 100, netFob: 2, sellFob: 3 },
        { label: "L", qty: 50, netFob: 2, sellFob: 3 },
        { label: "XL", qty: 40, netFob: 4, sellFob: 5 },
        { label: "2XL", qty: 10, netFob: 4, sellFob: 5 },
      ],
    });

    const { rows } = await listOpenOrders(admin, {});
    const sb = rows[0].styleBreakdown;
    expect(sb).toHaveLength(2);
    expect(sb[0]).toMatchObject({ sizes: "M, L", qty: 150, netFob: 2, value: 450 }); // 150*3
    expect(sb[1]).toMatchObject({ sizes: "XL, 2XL", qty: 50, netFob: 4, value: 250 }); // 50*5
  });

  it("keeps a single line when every size shares one price", async () => {
    const { style, po } = await scaffold();
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [
        { label: "M", qty: 100, netFob: 2, sellFob: 3 },
        { label: "L", qty: 100, netFob: 2, sellFob: 3 },
      ],
    });

    const { rows } = await listOpenOrders(admin, {});
    const sb = rows[0].styleBreakdown;
    expect(sb).toHaveLength(1);
    expect(sb[0]).toMatchObject({ sizes: "M, L", qty: 200, netFob: 2, value: 600 });
  });

  it("drops a price tier with nothing left to ship (remaining balance)", async () => {
    const { style, po } = await scaffold();
    const line = await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [
        { label: "M", qty: 100, netFob: 2, sellFob: 3 },
        { label: "L", qty: 100, netFob: 4, sellFob: 5 },
      ],
    });
    await approveCosting(accounts, po.id);
    await confirmPurchaseOrder(admin, po.id);
    await createShipment(admin, { reference: "SHP-1", lines: [{ orderLineId: line.id, sizes: [{ label: "L", qty: 100 }] }] });

    const { rows } = await listOpenOrders(admin, {});
    const sb = rows[0].styleBreakdown;
    expect(sb).toHaveLength(1); // the L tier is fully shipped → gone from the open book
    expect(sb[0]).toMatchObject({ sizes: "M", qty: 100, netFob: 2, value: 300 });
  });

  it("merges a price tier across colours and lists every contributing colour", async () => {
    const { style, po } = await scaffold();
    const red = await createColour(admin, { name: "Red" });
    const blue = await createColour(admin, { name: "Blue" });
    await setOrderLine(admin, po.id, { styleId: style.id, colourId: red.id, sizes: [{ label: "M", qty: 50, netFob: 2, sellFob: 2 }] });
    await setOrderLine(admin, po.id, { styleId: style.id, colourId: blue.id, sizes: [{ label: "M", qty: 50, netFob: 2, sellFob: 2 }, { label: "XL", qty: 30, netFob: 3, sellFob: 3 }] });

    const { rows } = await listOpenOrders(admin, {});
    const sb = rows[0].styleBreakdown;
    expect(sb).toHaveLength(2);
    expect(sb[0]).toMatchObject({ sizes: "M", qty: 100, netFob: 2, value: 200 });
    expect(sb[0].colours.split(", ").sort()).toEqual(["Blue", "Red"]);
    expect(sb[1]).toMatchObject({ sizes: "XL", qty: 30, netFob: 3, value: 90, colours: "Blue" });
  });
});
