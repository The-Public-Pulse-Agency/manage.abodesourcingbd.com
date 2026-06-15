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
import { approveCosting } from "@/lib/orders/costing";
import { upsertProduction, getProduction } from "./production";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };

async function refs() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return { buyer, brand, factory };
}

/** A confirmed PO with a single 1000-pc line. */
async function confirmedPo() {
  const r = await refs();
  const style = await createStyle(admin, { brandId: r.brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, {
    poNumber: "209531",
    buyerId: r.buyer.id,
    brandId: r.brand.id,
    factoryId: r.factory.id,
  });
  await setOrderLine(admin, po.id, {
    styleId: style.id,
    sizes: [{ label: "M", qty: 1000, netFob: 1, sellFob: 2 }],
  });
  await approveCosting(accounts, po.id);
  await confirmPurchaseOrder(admin, po.id);
  return po;
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("upsertProduction", () => {
  it("records progress vs ordered qty and is idempotent", async () => {
    const po = await confirmedPo();
    await upsertProduction(admin, po.id, { cutQty: 500, sewQty: 250, finishQty: 100 });
    await upsertProduction(admin, po.id, { cutQty: 900, sewQty: 800, finishQty: 700 });
    expect(await prisma.productionRecord.count({ where: { poId: po.id } })).toBe(1);
    const got = await getProduction(admin, po.id);
    expect(got.orderedQty).toBe(1000);
    expect(got.cutQty).toBe(900);
    expect(got.progress).toEqual({ cutPct: 90, sewPct: 80, finishPct: 70 });
  });

  it("enforces finishQty <= sewQty <= cutQty", async () => {
    const po = await confirmedPo();
    await expect(upsertProduction(admin, po.id, { cutQty: 10, sewQty: 5, finishQty: 8 })).rejects.toThrow(
      /finishqty cannot exceed sewqty/i,
    );
    await expect(upsertProduction(admin, po.id, { cutQty: 5, sewQty: 9, finishQty: 0 })).rejects.toThrow(
      /sewqty cannot exceed cutqty/i,
    );
  });

  it("rejects production on a DRAFT order and an unknown poId", async () => {
    const r = await refs();
    const style = await createStyle(admin, { brandId: r.brand.id, styleCode: "TR010", name: "Tee" });
    const draft = await createPurchaseOrder(admin, {
      poNumber: "DRAFT-1",
      buyerId: r.buyer.id,
      brandId: r.brand.id,
      factoryId: r.factory.id,
    });
    await setOrderLine(admin, draft.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 10, netFob: 1, sellFob: 2 }],
    });
    await expect(upsertProduction(admin, draft.id, { cutQty: 1, sewQty: 0, finishQty: 0 })).rejects.toThrow(
      /draft/i,
    );
    await expect(upsertProduction(admin, "nope", { cutQty: 1, sewQty: 0, finishQty: 0 })).rejects.toThrow(
      /not found/i,
    );
  });

  it("forbids a view-only role", async () => {
    const po = await confirmedPo();
    await expect(upsertProduction(mgmt, po.id, { cutQty: 1, sewQty: 0, finishQty: 0 })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("survives concurrent first-time upserts (P2002-safe)", async () => {
    const po = await confirmedPo();
    await Promise.all([
      upsertProduction(admin, po.id, { cutQty: 100, sewQty: 50, finishQty: 10 }),
      upsertProduction(admin, po.id, { cutQty: 200, sewQty: 150, finishQty: 100 }),
    ]);
    expect(await prisma.productionRecord.count({ where: { poId: po.id } })).toBe(1);
  });
});

describe("getProduction", () => {
  it("sums ordered qty across multiple lines / size rows", async () => {
    const r = await refs();
    const a = await createStyle(admin, { brandId: r.brand.id, styleCode: "TR010", name: "A" });
    const b = await createStyle(admin, { brandId: r.brand.id, styleCode: "TR020", name: "B" });
    const po = await createPurchaseOrder(admin, {
      poNumber: "209531",
      buyerId: r.buyer.id,
      brandId: r.brand.id,
      factoryId: r.factory.id,
    });
    await setOrderLine(admin, po.id, {
      styleId: a.id,
      sizes: [
        { label: "S", qty: 300, netFob: 1, sellFob: 2 },
        { label: "M", qty: 400, netFob: 1, sellFob: 2 },
      ],
    });
    await setOrderLine(admin, po.id, {
      styleId: b.id,
      sizes: [{ label: "L", qty: 300, netFob: 1, sellFob: 2 }],
    });
    await approveCosting(accounts, po.id);
    await confirmPurchaseOrder(admin, po.id);
    const got = await getProduction(admin, po.id);
    expect(got.orderedQty).toBe(1000);
  });

  it("returns zeros for a PO with no lines (orderedQty 0, no divide-by-zero)", async () => {
    const r = await refs();
    const po = await createPurchaseOrder(admin, {
      poNumber: "EMPTY-1",
      buyerId: r.buyer.id,
      brandId: r.brand.id,
      factoryId: r.factory.id,
    });
    const got = await getProduction(admin, po.id);
    expect(got.orderedQty).toBe(0);
    expect(got.progress).toEqual({ cutPct: 0, sewPct: 0, finishPct: 0 });
  });
});
