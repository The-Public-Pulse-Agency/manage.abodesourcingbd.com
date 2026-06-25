import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "@/lib/orders/po";
import { setOrderLine } from "@/lib/orders/lines";
import { createInvoice } from "@/lib/finance/invoices";
import { recordPayment } from "@/lib/finance/payments";
import { dashboardSummary } from "./summary";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };
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
  it("renders (no 500) for a role with dashboards:view but no finance/criticalPath", async () => {
    await refs();
    // A reduced role — dashboards only. Must NOT throw ForbiddenError from finance/criticalPath.
    const limited = { id: "m-1", role: "MERCHANDISER", companyId: "test-co", permissions: { dashboards: ["view" as const] } };
    const s = await dashboardSummary(limited, { now: NOW });
    expect(s.finance).toEqual({ receivable: 0, payable: 0, realisedMargin: 0 });
  });

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
        { companyId: "test-co", poId: live.id, key: "EX_FACTORY", name: "Ex-factory", stage: "SHIPPING", position: 12, plannedDate: d("2026-05-10"), actualDate: d("2026-05-09") },
      ],
    });
    // a late ex-factory on another (closed) PO still counts for OTD history
    const done = await createPurchaseOrder(admin, { poNumber: "P-DONE", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    await prisma.purchaseOrder.update({ where: { id: done.id }, data: { status: "CLOSED" } });
    await prisma.taMilestone.create({
      data: { companyId: "test-co", poId: done.id, key: "EX_FACTORY", name: "Ex-factory", stage: "SHIPPING", position: 12, plannedDate: d("2026-05-10"), actualDate: d("2026-05-15") },
    });

    // Overdue + due-soon milestones on the live PO (board exception)
    await prisma.taMilestone.createMany({
      data: [
        { companyId: "test-co", poId: live.id, key: "pp_sample", name: "PP sample approved", stage: "SAMPLING", position: 6, plannedDate: d("2026-06-10") }, // overdue
        { companyId: "test-co", poId: live.id, key: "fabric_in", name: "Bulk fabric in-house", stage: "PRODUCTION_QC", position: 7, plannedDate: d("2026-06-18") }, // due-soon
      ],
    });

    // Shipment with BL issued but telex pending (cash stuck)
    await prisma.shipment.create({
      data: { companyId: "test-co", reference: "SHP-1", blNumber: "BL-1", telexStatus: "PENDING" },
    });
    // Telex RECEIVED counts as done — must NOT be flagged pending.
    await prisma.shipment.create({
      data: { companyId: "test-co", reference: "SHP-2", blNumber: "BL-2", telexStatus: "RECEIVED" },
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

  it("realises a PO's margin from the payment ledger, not the invoice status flag", async () => {
    const { buyer, brand, factory } = await refs();
    const po = await createPurchaseOrder(admin, { poNumber: "P-RM", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    const bi = await createInvoice(accounts, { type: "BUYER", number: "RM-B", poId: po.id, amount: 200, issueDate: d("2026-03-07") });
    const fi = await createInvoice(accounts, { type: "FACTORY", number: "RM-F", poId: po.id, amount: 150, issueDate: d("2026-03-07") });

    // Status flag says PAID, but NO payments recorded → ledger says unpaid → margin NOT realised.
    await prisma.invoice.updateMany({ where: { poId: po.id }, data: { status: "PAID" } });
    expect((await dashboardSummary(admin, { now: NOW })).finance.realisedMargin).toBe(0);

    // Actually settle both via the ledger → margin realised (200 − 150).
    await recordPayment(accounts, bi.id, { amount: 200, date: d("2026-04-01"), method: "TT" });
    await recordPayment(accounts, fi.id, { amount: 150, date: d("2026-04-01"), method: "TT" });
    expect((await dashboardSummary(admin, { now: NOW })).finance.realisedMargin).toBe(50);
  });

  it("returns empty/zero shape on an empty DB", async () => {
    const s = await dashboardSummary(admin, { now: NOW });
    expect(s.openOrders).toEqual({ count: 0, value: 0 });
    expect(s.otd.pct).toBeNull();
    expect(s.exceptions.exFtyDue7d).toHaveLength(0);
    expect(s.exceptions.paymentOverdue).toBe(0);
  });
});
