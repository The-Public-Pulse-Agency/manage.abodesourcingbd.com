import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "./po";
import { createLot, assignPoToLot } from "./lots";

const admin = { id: "admin-1", role: "ADMIN" as const };

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("lots", () => {
  it("groups multiple POs from the same factory into one lot", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const po1 = await createPurchaseOrder(admin, {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
    });
    const po2 = await createPurchaseOrder(admin, {
      poNumber: "220010080",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
    });

    const lot = await createLot(admin, { name: "LOT-JUN-1", factoryId: factory.id });
    await assignPoToLot(admin, po1.id, lot.id);
    await assignPoToLot(admin, po2.id, lot.id);

    const withOrders = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
      include: { orders: true },
    });
    expect(withOrders.orders).toHaveLength(2);
  });

  it("auto-binds a factoryless lot to the first PO's factory, then rejects mixing", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const f1 = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const f2 = await createFactory(admin, { name: "UHM", type: "KNIT" });
    const po1 = await createPurchaseOrder(admin, {
      poNumber: "A1",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: f1.id,
    });
    const po2 = await createPurchaseOrder(admin, {
      poNumber: "A2",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: f2.id,
    });
    const lot = await createLot(admin, { name: "OPEN-LOT" }); // no factory
    await assignPoToLot(admin, po1.id, lot.id);
    const bound = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(bound.factoryId).toBe(f1.id);
    await expect(assignPoToLot(admin, po2.id, lot.id)).rejects.toThrow(/different factory/i);
  });

  it("rejects assigning a PO to a lot of a different factory", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const f1 = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const f2 = await createFactory(admin, { name: "UHM", type: "KNIT" });
    const po = await createPurchaseOrder(admin, {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: f1.id,
    });
    const lot = await createLot(admin, { name: "LOT-UHM", factoryId: f2.id });
    await expect(assignPoToLot(admin, po.id, lot.id)).rejects.toThrow(/different factory/i);
  });
});
