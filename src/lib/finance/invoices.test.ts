import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createInvoice, listInvoices } from "./invoices";

const admin = { id: "admin-1", role: "ADMIN" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const merch = { id: "m-1", role: "MERCHANDISER" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function seedPo() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return createPurchaseOrder(admin, { poNumber: "209531", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

it("Accounts creates buyer + factory invoices and lists them", async () => {
  const po = await seedPo();
  await createInvoice(accounts, { type: "BUYER", number: "ABD-001", poId: po.id, amount: 1000, issueDate: d("2026-03-19") });
  await createInvoice(accounts, { type: "FACTORY", number: "LFI-1", poId: po.id, amount: 800, issueDate: d("2026-03-19") });
  expect(await listInvoices(accounts, {})).toHaveLength(2);
});

it("rejects duplicate (type, number)", async () => {
  const po = await seedPo();
  await createInvoice(accounts, { type: "BUYER", number: "ABD-001", poId: po.id, amount: 1, issueDate: d("2026-03-19") });
  await expect(createInvoice(accounts, { type: "BUYER", number: "ABD-001", poId: po.id, amount: 1, issueDate: d("2026-03-19") })).rejects.toThrow(/already exists/i);
});

it("rejects an invoice linked to nothing, and an unknown PO", async () => {
  await expect(createInvoice(accounts, { type: "BUYER", number: "X", amount: 1, issueDate: d("2026-03-19") })).rejects.toThrow(/link to a purchase order or a shipment/i);
  await expect(createInvoice(accounts, { type: "BUYER", number: "Y", poId: "nope", amount: 1, issueDate: d("2026-03-19") })).rejects.toThrow(/not found/i);
});

it("forbids Merchandiser (finance view-only) from creating", async () => {
  const po = await seedPo();
  await expect(createInvoice(merch, { type: "BUYER", number: "M", poId: po.id, amount: 1, issueDate: d("2026-03-19") })).rejects.toThrow(ForbiddenError);
});
