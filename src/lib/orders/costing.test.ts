import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "@/lib/orders/po";
import { setOrderLine } from "@/lib/orders/lines";
import { confirmPurchaseOrder } from "@/lib/orders/confirm";
import { approveCosting, unapproveCosting } from "./costing";

const admin = { id: "admin-1", role: "ADMIN" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const merch = { id: "m-1", role: "MERCHANDISER" as const };

async function poWithLine() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, { poNumber: "209531", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
  await setOrderLine(admin, po.id, { styleId: style.id, sizes: [{ label: "M", qty: 100, netFob: 1.5, sellFob: 2 }] });
  return po;
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

it("blocks confirm until costing is approved", async () => {
  const po = await poWithLine();
  await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/costing must be approved/i);
  await approveCosting(accounts, po.id);
  expect((await confirmPurchaseOrder(admin, po.id)).status).toBe("CONFIRMED");
});

it("lets Accounts approve but forbids Merchandiser", async () => {
  const po = await poWithLine();
  await expect(approveCosting(merch, po.id)).rejects.toThrow(ForbiddenError);
  expect((await approveCosting(accounts, po.id)).costingApprovedAt).not.toBeNull();
});

it("forbids unapproving a non-DRAFT order", async () => {
  const po = await poWithLine();
  await approveCosting(accounts, po.id);
  await confirmPurchaseOrder(admin, po.id);
  await expect(unapproveCosting(accounts, po.id)).rejects.toThrow(/DRAFT/i);
});
