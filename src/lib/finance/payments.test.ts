import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createInvoice } from "./invoices";
import { recordPayment } from "./payments";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const, companyId: "test-co" };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function inv(amount: number) {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const po = await createPurchaseOrder(admin, { poNumber: "209531", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
  return createInvoice(accounts, { type: "BUYER", number: "ABD-1", poId: po.id, amount, issueDate: d("2026-03-19") });
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

it("partial -> PARTIALLY_PAID, exact remainder -> PAID", async () => {
  const i = await inv(1000);
  await recordPayment(accounts, i.id, { amount: 400, date: d("2026-04-01"), method: "TT" });
  expect((await prisma.invoice.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("PARTIALLY_PAID");
  await recordPayment(accounts, i.id, { amount: 600, date: d("2026-05-01"), method: "TT" });
  expect((await prisma.invoice.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("PAID");
});

it("a single payment equal to the amount -> PAID", async () => {
  const i = await inv(500);
  await recordPayment(accounts, i.id, { amount: 500, date: d("2026-04-01"), method: "LC" });
  expect((await prisma.invoice.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("PAID");
});

it("rejects payment beyond outstanding", async () => {
  const i = await inv(1000);
  await recordPayment(accounts, i.id, { amount: 800, date: d("2026-04-01"), method: "TT" });
  await expect(recordPayment(accounts, i.id, { amount: 300, date: d("2026-05-01"), method: "TT" })).rejects.toThrow(/exceeds outstanding/i);
});

it("never over-pays under concurrency", async () => {
  const i = await inv(1000);
  await Promise.allSettled([
    recordPayment(accounts, i.id, { amount: 700, date: d("2026-04-01"), method: "TT" }),
    recordPayment(accounts, i.id, { amount: 700, date: d("2026-04-01"), method: "TT" }),
  ]);
  const total = (await prisma.payment.findMany({ where: { invoiceId: i.id } })).reduce((a, p) => a + Number(p.amount), 0);
  expect(total).toBeLessThanOrEqual(1000);
});

it("forbids a view-only role", async () => {
  const i = await inv(1000);
  await expect(recordPayment(mgmt, i.id, { amount: 1, date: d("2026-04-01"), method: "TT" })).rejects.toThrow(ForbiddenError);
});
