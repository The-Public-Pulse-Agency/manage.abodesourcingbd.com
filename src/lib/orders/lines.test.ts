import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "./po";
import { confirmPurchaseOrder } from "./confirm";
import { approveCosting } from "./costing";
import { setOrderLine, removeOrderLine } from "./lines";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };

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

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("setOrderLine", () => {
  it("creates a line with size-wise quantities", async () => {
    const { po, style } = await seedPo();
    const line = await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [
        { label: "M", qty: 100, netFob: 1.5, sellFob: 2.0 },
        { label: "L", qty: 60, netFob: 1.5, sellFob: 2.0 },
      ],
    });
    const sizes = await prisma.orderLineSize.findMany({ where: { orderLineId: line.id } });
    expect(sizes).toHaveLength(2);
    expect(sizes.reduce((a, s) => a + s.qty, 0)).toBe(160);
  });

  it("supports per-size price overrides for larger sizes", async () => {
    const { po, style } = await seedPo();
    const line = await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [
        { label: "M", qty: 10, netFob: 1.5, sellFob: 2.0 },
        { label: "3XL", qty: 5, netFob: 1.8, sellFob: 2.5 },
      ],
    });
    const big = await prisma.orderLineSize.findFirstOrThrow({
      where: { orderLineId: line.id, label: "3XL" },
    });
    expect(Number(big.sellFob)).toBe(2.5);
    expect(Number(big.netFob)).toBe(1.8);
  });

  it("replaces sizes on re-set for the same style+colour (upsert, one line)", async () => {
    const { po, style } = await seedPo();
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 100, netFob: 1, sellFob: 2 }],
    });
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 120, netFob: 1, sellFob: 2 }],
    });
    const lines = await prisma.orderLine.findMany({ where: { poId: po.id } });
    expect(lines).toHaveLength(1);
    const sizes = await prisma.orderLineSize.findMany({ where: { orderLineId: lines[0].id } });
    expect(sizes).toHaveLength(1);
    expect(sizes[0].qty).toBe(120);
  });

  it("rejects duplicate size labels", async () => {
    const { po, style } = await seedPo();
    await expect(
      setOrderLine(admin, po.id, {
        styleId: style.id,
        sizes: [
          { label: "M", qty: 10, netFob: 1, sellFob: 2 },
          { label: "M", qty: 5, netFob: 1, sellFob: 2 },
        ],
      }),
    ).rejects.toThrow(/duplicate size label/i);
  });

  it("rejects a style from a different brand", async () => {
    const { po } = await seedPo();
    const buyer2 = await createBuyer(admin, { name: "Premier" });
    const brand2 = await createBrand(admin, { buyerId: buyer2.id, name: "Premier", code: "PR" });
    const style2 = await createStyle(admin, { brandId: brand2.id, styleCode: "PR649", name: "Apron" });
    await expect(
      setOrderLine(admin, po.id, {
        styleId: style2.id,
        sizes: [{ label: "M", qty: 1, netFob: 1, sellFob: 2 }],
      }),
    ).rejects.toThrow(/style does not belong/i);
  });

  it("refuses to edit lines once the PO is CONFIRMED", async () => {
    const { po, style } = await seedPo();
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 10, netFob: 1.5, sellFob: 2.0 }],
    });
    await approveCosting(accounts, po.id);
    await confirmPurchaseOrder(admin, po.id);
    await expect(
      setOrderLine(admin, po.id, {
        styleId: style.id,
        sizes: [{ label: "M", qty: 99, netFob: 1.5, sellFob: 2.0 }],
      }),
    ).rejects.toThrow(/draft/i);
  });
});

describe("removeOrderLine", () => {
  it("removes a line on a DRAFT PO and audits the prior state", async () => {
    const { po, style } = await seedPo();
    const line = await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 1, netFob: 1, sellFob: 2 }],
    });
    await removeOrderLine(admin, line.id);
    expect(await prisma.orderLine.count({ where: { poId: po.id } })).toBe(0);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: line.id, action: "delete" },
    });
    expect(audit.before).not.toBeNull();
  });
});
