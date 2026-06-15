import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "@/lib/orders/po";
import { setOrderLine } from "@/lib/orders/lines";
import { createInvoice } from "@/lib/finance/invoices";
import { dashboardSummary } from "./summary";

const admin = { id: "admin-1", role: "ADMIN" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const NOW = new Date("2026-06-15T03:00:00.000Z"); // businessToday = 2026-06-15
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function refs() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  return { buyer, brand, factory, style };
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("dashboardSummary", () => {
  it("aggregates KPIs and exception widgets", async () => {
    const { buyer, brand, factory, style } = await refs();

    // Live PO with sized line (value) + ex-fty in 5 days (exception)
    const live = await createPurchaseOrder(admin, {
      poNumber: "P-LIVE",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
      exFactoryDate: d("2026-06-20"),
    });
    await setOrderLine(admin, live.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 100, netFob: 1.5, sellFob: 2.0 }], // value 200, cost 150
    });
    await prisma.purchaseOrder.update({ where: { id: live.id }, data: { status: "CONFIRMED" } });

    // ex-factory milestones (OTD): one on time, one late
    await prisma.taMilestone.createMany({
      data: [
        { poId: live.id, key: "EX_FACTORY", name: "Ex-factory", stage: "SHIPPING", position: 12, plannedDate: d("2026-05-10"), actualDate: d("2026-05-09") },
      ],
    });
    // a late ex-factory on another (closed) PO still counts for OTD history
    const done = await createPurchaseOrder(admin, { poNumber: "P-DONE", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    await prisma.purchaseOrder.update({ where: { id: done.id }, data: { status: "CLOSED" } });
    await prisma.taMilestone.create({
      data: { poId: done.id, key: "EX_FACTORY", name: "Ex-factory", stage: "SHIPPING", position: 12, plannedDate: d("2026-05-10"), actualDate: d("2026-05-15") },
    });

    // Overdue + due-soon milestones on the live PO (board exception)
    await prisma.taMilestone.createMany({
      data: [
        { poId: live.id, key: "pp_sample", name: "PP sample approved", stage: "SAMPLING", position: 6, plannedDate: d("2026-06-10") }, // overdue
        { poId: live.id, key: "fabric_in", name: "Bulk fabric in-house", stage: "PRODUCTION_QC", position: 7, plannedDate: d("2026-06-18") }, // due-soon
      ],
    });

    // Shipment with BL issued but telex pending (cash stuck)
    await prisma.shipment.create({
      data: { reference: "SHP-1", blNumber: "BL-1", telexStatus: "PENDING" },
    });

    // Overdue invoice (issued 100d ago) + a current one
    await createInvoice(accounts, { type: "BUYER", number: "ABD-1", poId: live.id, amount: 200, issueDate: d("2026-03-07") });
    await createInvoice(accounts, { type: "FACTORY", number: "LFI-1", poId: live.id, amount: 150, issueDate: d("2026-06-10") });

    const s = await dashboardSummary(admin, { now: NOW });

    expect(s.openOrders.count).toBe(1); // only P-LIVE is live
    expect(s.openOrders.value).toBe(200);
    expect(s.otd).toEqual({ completed: 2, onTime: 1, pct: 50 });
    expect(s.finance.receivable).toBe(200);
    expect(s.finance.payable).toBe(150);
    expect(s.exceptions.exFtyDue7d).toHaveLength(1);
    expect(s.exceptions.exFtyDue7d[0].poNumber).toBe("P-LIVE");
    expect(s.exceptions.overdueMilestones).toBe(1);
    expect(s.exceptions.dueSoonMilestones).toBe(1);
    expect(s.exceptions.telexPending).toHaveLength(1);
    expect(s.exceptions.telexPending[0].blNumber).toBe("BL-1");
    expect(s.exceptions.paymentOverdue).toBe(1); // ABD-1 aged 100d; LFI-1 is 0-30
  });

  it("returns empty/zero shape on an empty DB", async () => {
    const s = await dashboardSummary(admin, { now: NOW });
    expect(s.openOrders).toEqual({ count: 0, value: 0 });
    expect(s.otd.pct).toBeNull();
    expect(s.exceptions.exFtyDue7d).toHaveLength(0);
    expect(s.exceptions.paymentOverdue).toBe(0);
  });
});
