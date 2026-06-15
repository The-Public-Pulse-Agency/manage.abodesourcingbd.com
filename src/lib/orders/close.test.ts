import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { closePurchaseOrder } from "./close";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };

type Refs = { buyerId: string; brandId: string; factoryId: string };

async function refs(): Promise<Refs> {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return { buyerId: buyer.id, brandId: brand.id, factoryId: factory.id };
}

async function mkPo(r: Refs, poNumber: string, status: "SHIPPED" | "PARTLY_SHIPPED" | "CONFIRMED") {
  const order = await createPurchaseOrder(admin, {
    poNumber,
    buyerId: r.buyerId,
    brandId: r.brandId,
    factoryId: r.factoryId,
  });
  await prisma.purchaseOrder.update({ where: { id: order.id }, data: { status } });
  return order;
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

it("closes a SHIPPED or PARTLY_SHIPPED order", async () => {
  const r = await refs();
  const s = await mkPo(r, "S1", "SHIPPED");
  expect((await closePurchaseOrder(admin, s.id)).status).toBe("CLOSED");
  const p = await mkPo(r, "P1", "PARTLY_SHIPPED");
  expect((await closePurchaseOrder(admin, p.id)).status).toBe("CLOSED");
});

it("rejects closing a non-shipped order", async () => {
  const r = await refs();
  const c = await mkPo(r, "C1", "CONFIRMED");
  await expect(closePurchaseOrder(admin, c.id)).rejects.toThrow(/can be closed/i);
});

it("forbids a view-only role", async () => {
  const r = await refs();
  const s = await mkPo(r, "S1", "SHIPPED");
  await expect(closePurchaseOrder(mgmt, s.id)).rejects.toThrow(ForbiddenError);
});
