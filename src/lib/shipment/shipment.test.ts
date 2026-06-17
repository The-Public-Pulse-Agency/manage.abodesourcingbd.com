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
import { createShipment, updateShipment } from "./shipment";
import { getPoBalance } from "./balance-db";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function refs() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  return { buyer, brand, factory, style };
}

async function confirmedPo(r: Awaited<ReturnType<typeof refs>>, poNumber: string, qty: number, confirm = true) {
  const po = await createPurchaseOrder(admin, {
    poNumber, buyerId: r.buyer.id, brandId: r.brand.id, factoryId: r.factory.id,
  });
  const line = await setOrderLine(admin, po.id, { styleId: r.style.id, sizes: [{ label: "M", qty, netFob: 1, sellFob: 2 }] });
  if (confirm) {
    await approveCosting(accounts, po.id);
    await confirmPurchaseOrder(admin, po.id);
  }
  return { po, line };
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("createShipment", () => {
  it("ships partial qty, decrements balance, sets PARTLY_SHIPPED", async () => {
    const r = await refs();
    const { po, line } = await confirmedPo(r, "209531", 100);
    await createShipment(admin, { reference: "SHP-1", containerNo: "ABCD1234567", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 40 }] }] });
    expect((await getPoBalance(admin, po.id))[0].sizes[0].balance).toBe(60);
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe("PARTLY_SHIPPED");
  });

  it("sets SHIPPED when the full balance ships", async () => {
    const r = await refs();
    const { po, line } = await confirmedPo(r, "209531", 100);
    await createShipment(admin, { reference: "SHP-2", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 100 }] }] });
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe("SHIPPED");
  });

  it("tracks balance across multiple shipments and rejects over-ship", async () => {
    const r = await refs();
    const { po, line } = await confirmedPo(r, "209531", 100);
    await createShipment(admin, { reference: "SHP-3", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 40 }] }] });
    await createShipment(admin, { reference: "SHP-3b", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 30 }] }] });
    expect((await getPoBalance(admin, po.id))[0].sizes[0]).toMatchObject({ shipped: 70, balance: 30 });
    await expect(
      createShipment(admin, { reference: "SHP-4", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 40 }] }] }),
    ).rejects.toThrow(/exceeds balance/i);
  });

  it("rejects the same order line listed twice in one shipment", async () => {
    const r = await refs();
    const { line } = await confirmedPo(r, "209531", 100);
    await expect(
      createShipment(admin, {
        reference: "SHP-DUP",
        lines: [
          { orderLineId: line.id, sizes: [{ label: "M", qty: 60 }] },
          { orderLineId: line.id, sizes: [{ label: "M", qty: 60 }] },
        ],
      }),
    ).rejects.toThrow(/appears more than once/i);
  });

  it("rejects shipping a non-shippable (DRAFT / CANCELLED) order", async () => {
    const r = await refs();
    const draft = await confirmedPo(r, "DRAFT-1", 50, false);
    await expect(
      createShipment(admin, { reference: "SHP-D", lines: [{ orderLineId: draft.line.id, sizes: [{ label: "M", qty: 1 }] }] }),
    ).rejects.toThrow(/cannot ship a draft/i);

    const cancelled = await confirmedPo(r, "CAN-1", 50);
    await prisma.purchaseOrder.update({ where: { id: cancelled.po.id }, data: { status: "CANCELLED" } });
    await expect(
      createShipment(admin, { reference: "SHP-C", lines: [{ orderLineId: cancelled.line.id, sizes: [{ label: "M", qty: 1 }] }] }),
    ).rejects.toThrow(/cannot ship a cancelled/i);
  });

  it("consolidates lines from multiple POs into one shipment and transitions each", async () => {
    const r = await refs();
    const a = await confirmedPo(r, "PO-A", 100);
    const b = await confirmedPo(r, "PO-B", 100);
    await createShipment(admin, {
      reference: "SHP-MULTI",
      lines: [
        { orderLineId: a.line.id, sizes: [{ label: "M", qty: 100 }] }, // fully ships A
        { orderLineId: b.line.id, sizes: [{ label: "M", qty: 40 }] }, // partial B
      ],
    });
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: a.po.id } })).status).toBe("SHIPPED");
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: b.po.id } })).status).toBe("PARTLY_SHIPPED");
  });

  it("rejects a duplicate shipment reference", async () => {
    const r = await refs();
    const { line } = await confirmedPo(r, "209531", 100);
    await createShipment(admin, { reference: "DUP", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 10 }] }] });
    await expect(
      createShipment(admin, { reference: "DUP", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 10 }] }] }),
    ).rejects.toThrow(/already exists/i);
  });

  it("never over-ships under concurrency (Serializable)", async () => {
    const r = await refs();
    const { line } = await confirmedPo(r, "209531", 100);
    const results = await Promise.allSettled([
      createShipment(admin, { reference: "C-1", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 70 }] }] }),
      createShipment(admin, { reference: "C-2", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 70 }] }] }),
    ]);
    const rows = await prisma.shipmentLineSize.findMany({ where: { shipmentLine: { orderLineId: line.id } } });
    const total = rows.reduce((a, s) => a + s.qty, 0);
    expect(total).toBeLessThanOrEqual(100); // invariant: never over-shipped
    expect(results.filter((x) => x.status === "rejected").length).toBeGreaterThanOrEqual(1);
  });

  it("forbids a view-only role", async () => {
    const r = await refs();
    const { line } = await confirmedPo(r, "209531", 100);
    await expect(
      createShipment(mgmt, { reference: "X", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 1 }] }] }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("updateShipment", () => {
  it("advances telex PENDING -> RECEIVED -> RELEASED with a BL", async () => {
    const r = await refs();
    const { line } = await confirmedPo(r, "209531", 100);
    const shp = await createShipment(admin, { reference: "SHP-5", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 10 }] }] });
    await updateShipment(admin, shp.id, { blNumber: "BL123", blDate: d("2026-03-19"), telexStatus: "RECEIVED" });
    const rel = await updateShipment(admin, shp.id, { telexStatus: "RELEASED" });
    expect(rel.telexStatus).toBe("RELEASED");
  });

  it("rejects RELEASED without a BL number, and backward telex moves", async () => {
    const r = await refs();
    const { line } = await confirmedPo(r, "209531", 100);
    const shp = await createShipment(admin, { reference: "SHP-6", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 10 }] }] });
    await expect(updateShipment(admin, shp.id, { telexStatus: "RELEASED" })).rejects.toThrow(/BL number is required/i);
    await updateShipment(admin, shp.id, { blNumber: "BL9", telexStatus: "RELEASED" });
    await expect(updateShipment(admin, shp.id, { telexStatus: "PENDING" })).rejects.toThrow(/backward/i);
  });
});
