import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "./po";
import { setOrderLine } from "./lines";
import { confirmPurchaseOrder } from "./confirm";

const admin = { id: "admin-1", role: "ADMIN" as const };

async function seedPo() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, {
    poNumber: "209531",
    buyerId: buyer.id,
    brandId: brand.id,
    factoryId: factory.id,
  });
  return { po, style };
}

async function setLine(poId: string, styleId: string, qty: number, netFob: number, sellFob: number) {
  return setOrderLine(admin, poId, { styleId, sizes: [{ label: "M", qty, netFob, sellFob }] });
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("confirmPurchaseOrder", () => {
  it("confirms a fully-costed, margin-positive PO", async () => {
    const { po, style } = await seedPo();
    await setLine(po.id, style.id, 100, 1.5, 2.0);
    const confirmed = await confirmPurchaseOrder(admin, po.id);
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("refuses a PO with no lines", async () => {
    const { po } = await seedPo();
    await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/no lines/i);
  });

  it("refuses zero qty, zero sell price, zero cost, or negative margin", async () => {
    const { po, style } = await seedPo();
    await setLine(po.id, style.id, 0, 1.5, 2.0);
    await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/qty/i);

    await setLine(po.id, style.id, 10, 1.5, 0);
    await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/sell price/i);

    await setLine(po.id, style.id, 10, 0, 2.0);
    await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/cost/i);

    await setLine(po.id, style.id, 10, 2.5, 2.0); // sell < cost -> negative margin
    await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/below cost/i);
  });

  it("refuses to confirm a non-DRAFT PO", async () => {
    const { po, style } = await seedPo();
    await setLine(po.id, style.id, 10, 1.5, 2.0);
    await confirmPurchaseOrder(admin, po.id);
    await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/draft/i);
  });
});
