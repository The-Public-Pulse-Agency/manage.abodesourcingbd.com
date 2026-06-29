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
import { createShipment, updateShipment } from "@/lib/shipment/shipment";
import { createInvoice } from "@/lib/finance/invoices";
import { recordPayment } from "@/lib/finance/payments";
import { shippedGoodsReport } from "./shipped";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

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

describe("shippedGoodsReport — ordering", () => {
  it("orders rows by ship date, latest first", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
    const po = await createPurchaseOrder(admin, { poNumber: "P-ORD", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    const line = await setOrderLine(admin, po.id, { styleId: style.id, sizes: [{ label: "M", qty: 300, netFob: 1, sellFob: 2 }] });
    await approveCosting(accounts, po.id);
    await confirmPurchaseOrder(admin, po.id);
    // Created out of ship-date order.
    await createShipment(admin, { reference: "S-EARLY", exFactoryDate: d("2026-06-01"), lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 100 }] }] });
    await createShipment(admin, { reference: "S-LATE", exFactoryDate: d("2026-06-15"), lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 100 }] }] });
    await createShipment(admin, { reference: "S-MID", exFactoryDate: d("2026-06-10"), lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 100 }] }] });

    const rep = await shippedGoodsReport(admin);
    expect(rep.rows.map((r) => r.reference)).toEqual(["S-LATE", "S-MID", "S-EARLY"]);
  });
});

describe("shippedGoodsReport — payment status from the ledger", () => {
  it("derives paid/awaiting from payments, not the invoice status flag", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
    const po = await createPurchaseOrder(admin, { poNumber: "P-PS", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    const line = await setOrderLine(admin, po.id, { styleId: style.id, sizes: [{ label: "M", qty: 100, netFob: 1, sellFob: 2 }] });
    await approveCosting(accounts, po.id);
    await confirmPurchaseOrder(admin, po.id);
    const shp = await createShipment(admin, { reference: "SHP-PS", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 100 }] }] });
    const invc = await createInvoice(accounts, { type: "BUYER", number: "PS-INV", shipmentId: shp.id, amount: 200, issueDate: d("2026-03-07") });

    // Status flag says PAID, but no payment recorded → ledger (and the report) say unpaid.
    await prisma.invoice.updateMany({ where: { id: invc.id }, data: { status: "PAID" } });
    let rep = await shippedGoodsReport(admin);
    expect(rep.rows[0].paymentStatus).toBe("ISSUED");
    expect(rep.kpis.paid).toBe(0);

    await recordPayment(accounts, invc.id, { amount: 200, date: d("2026-04-01"), method: "TT" });
    rep = await shippedGoodsReport(admin);
    expect(rep.rows[0].paymentStatus).toBe("PAID");
    expect(rep.kpis.paid).toBe(1);
  });
});

describe("shippedGoodsReport — line value", () => {
  it("reports the line total value (shipped qty × sell FOB) over the shipped sizes", async () => {
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
    await createShipment(admin, { reference: "SHP-1", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 60 }, { label: "L", qty: 40 }] }] });

    const rep = await shippedGoodsReport(admin);
    expect(rep.rows[0].qty).toBe(100);
    expect(rep.rows[0].value).toBe(380); // 60×3 (sell M) + 40×5 (sell L)
    expect(rep.rows[0].telexStatus).toBe("PENDING"); // surfaced for the report's Telex column
    expect(rep.rows[0].commissioned).toBe(false); // commission status defaults to No
  });
});

describe("shippedGoodsReport — commission status", () => {
  it("surfaces the commission flag and reflects updates", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
    const po = await createPurchaseOrder(admin, { poNumber: "P-CM", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    const line = await setOrderLine(admin, po.id, { styleId: style.id, sizes: [{ label: "M", qty: 100, netFob: 1, sellFob: 2 }] });
    await approveCosting(accounts, po.id);
    await confirmPurchaseOrder(admin, po.id);
    const shp = await createShipment(admin, { reference: "S-CM", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 100 }] }] });

    expect((await shippedGoodsReport(admin)).rows[0].commissioned).toBe(false);
    await updateShipment(admin, shp.id, { commissioned: true });
    expect((await shippedGoodsReport(admin)).rows[0].commissioned).toBe(true);
  });
});
