import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createInvoice } from "./invoices";
import { recordPayment } from "./payments";
import { financeSummary } from "./summary";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function po(poNumber: string) {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return createPurchaseOrder(admin, { poNumber, buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

it("computes AR / AP outstanding and aging buckets", async () => {
  const order = await po("209531");
  const b = await createInvoice(accounts, { type: "BUYER", number: "ABD-1", poId: order.id, amount: 1000, issueDate: d("2026-04-01") });
  await recordPayment(accounts, b.id, { amount: 400, date: d("2026-04-10"), method: "TT" });
  await createInvoice(accounts, { type: "FACTORY", number: "LFI-1", poId: order.id, amount: 800, issueDate: d("2026-01-01") });
  const s = await financeSummary(accounts, { now: d("2026-06-15") });
  expect(s.receivableOutstanding).toBe(600);
  expect(s.payableOutstanding).toBe(800);
  expect(s.aging.find((a) => a.number === "ABD-1")?.bucket).toBe("61-90"); // 1 Apr -> 75d
  expect(s.aging.find((a) => a.number === "LFI-1")?.bucket).toBe("90+"); // 1 Jan -> 165d
});

it("realises margin only when both buyer and factory invoices are PAID", async () => {
  const order = await po("209531");
  const b = await createInvoice(accounts, { type: "BUYER", number: "ABD-1", poId: order.id, amount: 1000, issueDate: d("2026-04-01") });
  const f = await createInvoice(accounts, { type: "FACTORY", number: "LFI-1", poId: order.id, amount: 800, issueDate: d("2026-04-01") });
  await recordPayment(accounts, b.id, { amount: 1000, date: d("2026-05-01"), method: "TT" });
  // factory not yet paid -> not realised
  expect((await financeSummary(accounts, { now: d("2026-06-15") })).realisedMargin).toBe(0);
  await recordPayment(accounts, f.id, { amount: 800, date: d("2026-05-10"), method: "TT" });
  expect((await financeSummary(accounts, { now: d("2026-06-15") })).realisedMargin).toBe(200);
});
