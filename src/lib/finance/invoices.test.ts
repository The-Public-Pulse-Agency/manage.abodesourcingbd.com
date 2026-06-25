import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createInvoice, listInvoices, updateInvoiceFields } from "./invoices";
import { recordPayment } from "./payments";
import { outstanding } from "./money";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };
const merch = { id: "m-1", role: "MERCHANDISER" as const, companyId: "test-co" };
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

describe("marking an invoice PAID auto-records the outstanding payment", () => {
  it("records a payment for the full amount when no payments exist", async () => {
    const po = await seedPo();
    const i = await createInvoice(accounts, { type: "BUYER", number: "ABD-PAID", poId: po.id, amount: 1000, issueDate: d("2026-03-19") });
    await updateInvoiceFields(accounts, i.id, { status: "PAID" });

    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: i.id }, include: { payments: true } });
    expect(inv.status).toBe("PAID");
    expect(inv.payments).toHaveLength(1);
    expect(Number(inv.payments[0].amount)).toBe(1000);
    expect(outstanding(inv.amount, inv.payments)).toBe(0);
  });

  it("records only the remaining balance when a partial payment already exists", async () => {
    const po = await seedPo();
    const i = await createInvoice(accounts, { type: "BUYER", number: "ABD-PART", poId: po.id, amount: 1000, issueDate: d("2026-03-19") });
    await recordPayment(accounts, i.id, { amount: 400, date: d("2026-04-01"), method: "TT" });
    await updateInvoiceFields(accounts, i.id, { status: "PAID" });

    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: i.id }, include: { payments: true } });
    expect(inv.status).toBe("PAID");
    const total = inv.payments.reduce((a, p) => a + Number(p.amount), 0);
    expect(total).toBe(1000); // 400 + auto 600
    expect(outstanding(inv.amount, inv.payments)).toBe(0);
  });

  it("is idempotent — no extra payment when already fully paid", async () => {
    const po = await seedPo();
    const i = await createInvoice(accounts, { type: "BUYER", number: "ABD-FULL", poId: po.id, amount: 500, issueDate: d("2026-03-19") });
    await recordPayment(accounts, i.id, { amount: 500, date: d("2026-04-01"), method: "TT" });
    await updateInvoiceFields(accounts, i.id, { status: "PAID" });

    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: i.id }, include: { payments: true } });
    expect(inv.payments).toHaveLength(1); // unchanged
    expect(inv.status).toBe("PAID");
  });
});
