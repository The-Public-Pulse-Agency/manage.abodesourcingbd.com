import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createInvoice } from "@/lib/finance/invoices";
import { recordPayment } from "@/lib/finance/payments";
import { fetchAlertData } from "./data";

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

describe("fetchAlertData", () => {
  it("collects all five alert categories windowed on the Dhaka business day", async () => {
    const { buyer, brand, factory } = await refs();
    const live = await createPurchaseOrder(admin, {
      poNumber: "P-LIVE", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id, exFactoryDate: d("2026-06-20"),
    });
    await prisma.purchaseOrder.update({ where: { id: live.id }, data: { status: "CONFIRMED" } });

    // overdue milestone (planned in the past, no actual) + a closed PO milestone (excluded)
    await prisma.taMilestone.create({ data: { poId: live.id, key: "pp_sample", name: "PP sample", stage: "SAMPLING", position: 6, plannedDate: d("2026-06-10") } });
    const closed = await createPurchaseOrder(admin, { poNumber: "P-CLOSED", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    await prisma.purchaseOrder.update({ where: { id: closed.id }, data: { status: "CLOSED" } });
    await prisma.taMilestone.create({ data: { poId: closed.id, key: "pp_sample", name: "PP sample", stage: "SAMPLING", position: 6, plannedDate: d("2026-06-10") } });

    // pending sample that was sent (alertable) + a never-sent draft (not alertable)
    await prisma.sampleRequest.create({ data: { poId: live.id, type: "PP", status: "PENDING", sentDate: d("2026-06-01") } });
    await prisma.sampleRequest.create({ data: { poId: live.id, type: "FIT", status: "PENDING", sentDate: null } });

    // overdue invoice (issued 100d ago, unpaid) + a current one
    await createInvoice(accounts, { type: "BUYER", number: "ABD-1", poId: live.id, amount: 200, issueDate: d("2026-03-07") });
    await createInvoice(accounts, { type: "FACTORY", number: "LFI-1", poId: live.id, amount: 150, issueDate: d("2026-06-10") });

    const data = await fetchAlertData(NOW);

    expect(data.milestonesOverdue.map((m) => m.poNumber)).toEqual(["P-LIVE"]); // closed excluded
    expect(data.exFtySoon.map((p) => p.poNumber)).toEqual(["P-LIVE"]);
    expect(data.samplesPending).toHaveLength(1); // only the sent one
    expect(data.samplesPending[0].type).toBe("PP");
    expect(data.paymentsOverdue.map((p) => p.number)).toEqual(["ABD-1"]);
    expect(data.docsMissing.map((p) => p.poNumber)).toEqual(["P-LIVE"]); // no BL/CI/PL doc
  });

  it("payment-overdue boundary aligns with ageBucket (age 30 not overdue, 31 overdue)", async () => {
    const { buyer, brand, factory } = await refs();
    const po = await createPurchaseOrder(admin, { poNumber: "P-1", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    await createInvoice(accounts, { type: "BUYER", number: "AGE-30", poId: po.id, amount: 100, issueDate: d("2026-05-16") }); // 30d before 6-15
    await createInvoice(accounts, { type: "BUYER", number: "AGE-31", poId: po.id, amount: 100, issueDate: d("2026-05-15") }); // 31d before
    const data = await fetchAlertData(NOW);
    expect(data.paymentsOverdue.map((p) => p.number)).toEqual(["AGE-31"]);
  });

  it("excludes fully-paid aged invoices", async () => {
    const { buyer, brand, factory } = await refs();
    const po = await createPurchaseOrder(admin, { poNumber: "P-1", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
    const inv = await createInvoice(accounts, { type: "BUYER", number: "PAID-1", poId: po.id, amount: 100, issueDate: d("2026-03-01") });
    await recordPayment(accounts, inv.id, { amount: 100, date: d("2026-03-05"), method: "TT" });
    const data = await fetchAlertData(NOW);
    expect(data.paymentsOverdue).toHaveLength(0);
  });
});
