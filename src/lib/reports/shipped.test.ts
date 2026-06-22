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
import { closePurchaseOrder } from "@/lib/orders/close";
import { createShipment } from "@/lib/shipment/shipment";
import { shippedGoodsReport } from "./shipped";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("shippedGoodsReport — short shipment", () => {
  it("surfaces the un-shipped balance as 'short' only once the order is closed", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
    const po = await createPurchaseOrder(admin, { poNumber: "P1", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    const line = await setOrderLine(admin, po.id, { styleId: style.id, sizes: [{ label: "M", qty: 100, netFob: 1, sellFob: 2 }] });
    await approveCosting(accounts, po.id);
    await confirmPurchaseOrder(admin, po.id);
    await createShipment(admin, { reference: "SHP-1", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 60 }] }] });

    // Still partly-shipped (open) — the remaining 40 may yet ship, so no short flag.
    let rep = await shippedGoodsReport(admin);
    expect(rep.rows[0].shortShip).toBeNull();

    // Factory can't make the rest → close the order; the 40 becomes a recorded short-ship.
    await closePurchaseOrder(admin, po.id);
    rep = await shippedGoodsReport(admin);
    expect(rep.rows[0].shortShip).toBe("40 pcs short");
  });
});
