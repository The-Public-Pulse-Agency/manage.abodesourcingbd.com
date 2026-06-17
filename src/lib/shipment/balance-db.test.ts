import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "@/lib/orders/po";
import { setOrderLine } from "@/lib/orders/lines";
import { getPoBalance } from "./balance-db";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

it("reports full balance when nothing shipped", async () => {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, { poNumber: "209531", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
  const line = await setOrderLine(admin, po.id, { styleId: style.id, sizes: [{ label: "M", qty: 100, netFob: 1, sellFob: 2 }] });
  const bal = await getPoBalance(admin, po.id);
  expect(bal.find((l) => l.orderLineId === line.id)?.sizes[0]).toMatchObject({ label: "M", ordered: 100, shipped: 0, balance: 100 });
});
