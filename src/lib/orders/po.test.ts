import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder, listOpenOrderBook } from "./po";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };

async function refs() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return { buyer, brand, factory };
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("createPurchaseOrder", () => {
  it("creates a DRAFT PO and audits it", async () => {
    const { buyer, brand, factory } = await refs();
    const po = await createPurchaseOrder(admin, {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
      channel: "RALAWISE",
    });
    expect(po.status).toBe("DRAFT");
    expect(po.poNumber).toBe("209531");
    const audit = await prisma.auditLog.findMany({
      where: { entityId: po.id, entityType: "PurchaseOrder", action: "create" },
    });
    expect(audit).toHaveLength(1);
  });

  it("rejects a duplicate PO for the same buyer+factory+channel", async () => {
    const { buyer, brand, factory } = await refs();
    const input = {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
      channel: "RALAWISE" as const,
    };
    await createPurchaseOrder(admin, input);
    await expect(createPurchaseOrder(admin, input)).rejects.toThrow(/already exists/i);
  });

  it("allows the same PO number on a different channel (RalaTeam)", async () => {
    const { buyer, brand, factory } = await refs();
    const base = {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
    };
    await createPurchaseOrder(admin, { ...base, channel: "RALAWISE" });
    const second = await createPurchaseOrder(admin, { ...base, channel: "RALATEAM" });
    expect(second.channel).toBe("RALATEAM");
  });

  it("forbids a view-only role", async () => {
    const { buyer, brand, factory } = await refs();
    await expect(
      createPurchaseOrder(mgmt, {
        poNumber: "X",
        buyerId: buyer.id,
        brandId: brand.id,
        factoryId: factory.id,
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("listOpenOrderBook", () => {
  it("lists non-closed POs with computed totals and applies filters", async () => {
    const { buyer, brand, factory } = await refs();
    const po = await createPurchaseOrder(admin, {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
    });
    const book = await listOpenOrderBook(admin, {});
    expect(book).toHaveLength(1);
    expect(book[0].id).toBe(po.id);
    expect(book[0].totals).toEqual({ qty: 0, value: 0, cost: 0, margin: 0 });
    expect(await listOpenOrderBook(admin, { factoryId: "nope" })).toHaveLength(0);
  });
});
