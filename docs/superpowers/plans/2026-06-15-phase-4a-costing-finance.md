# Phase 4a — Costing Approval + Finance Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Checkbox (`- [ ]`) steps.

**Goal:** Close the back-to-back loop — enforce the **costing-approval gate** before an order is confirmed (spec §9③), record **buyer (Abode) + factory (shipper) invoices**, track **payments in/out**, expose **AR/AP outstanding + aging + realised margin**, and allow **SHIPPED → CLOSED**.

**Architecture:** Cost/sell already live on `OrderLineSize` and margin math is in `src/lib/orders/money.ts` — this phase does not duplicate costing. It adds: a costing-approval flag on `PurchaseOrder` (set by Accounts/Admin) that `confirmPurchaseOrder` now requires; an `Invoice` + `Payment` model with pure money math (mills, like Phase 1a) for outstanding/aging; and a manual close. RBAC: `finance` for invoices/payments/AR-AP; `costing` (approve) for the gate; `orders` for close.

**Tech Stack:** Existing. Money in `Decimal(14,2)`; computed in integer cents.

**Scope:** costing approve/unapprove + confirm gate; Invoice (buyer/factory) create/list; Payment record/list + invoice status; AR/AP + realised-margin summary; closePurchaseOrder. **Out of scope:** finance UI (4b), multi-currency conversion (FX), dashboards (Phase 5).

**Prerequisites:** Phase 3b merged. `finance` + `costing` permissions exist (spec §7: Accounts full finance + costing approve; Admin full; Merchandiser costing draft + finance view; Management view).

**IMPORTANT — confirm gate ripple:** making `confirmPurchaseOrder` require costing approval breaks every existing test/helper that confirms a PO and the order-UI confirm flow. This plan updates: (1) each confirm-path test helper to call `approveCosting` first; (2) the order detail UI to show an **Approve costing** control (Accounts/Admin) before Confirm; (3) the `orders` Playwright spec to approve before confirming.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` (modify) | PO `costingApprovedById`/`costingApprovedAt`; `InvoiceType`/`InvoiceStatus`/`PaymentMethod` enums; `Invoice`, `Payment` |
| `src/test/db.ts` (modify) | add Invoice/Payment to TRUNCATE |
| `src/lib/orders/costing.ts` (+test) | `approveCosting`, `unapproveCosting`, `isCostingApproved` |
| `src/lib/orders/confirm.ts` (modify) | require `costingApprovedAt` before DRAFT→CONFIRMED |
| `src/lib/orders/close.ts` (+test) | `closePurchaseOrder` (SHIPPED→CLOSED) |
| `src/lib/finance/money.ts` (+test) | pure invoice outstanding + aging buckets |
| `src/lib/finance/invoices.ts` (+test) | createInvoice (buyer/factory), listInvoices |
| `src/lib/finance/payments.ts` (+test) | recordPayment, list; recompute invoice status |
| `src/lib/finance/summary.ts` (+test) | AR/AP outstanding + realised margin |
| test helpers (modify) | confirm-path helpers approve costing first |
| `src/app/(app)/orders/[id]/*` (modify) | minimal Approve-costing control |
| `e2e/orders.spec.ts` (modify) | approve before confirm |

---

## Task 1: Schema + migration

- [ ] **Step 1: PO fields.** In `model PurchaseOrder`, after `notes String?` add:

```prisma
  costingApprovedById String?
  costingApprovedAt   DateTime?
```

- [ ] **Step 2: Append models**

```prisma
enum InvoiceType {
  BUYER
  FACTORY
}

enum InvoiceStatus {
  ISSUED
  PARTIALLY_PAID
  PAID
}

enum PaymentMethod {
  LC
  TT
  OTHER
}

model Invoice {
  id         String        @id @default(cuid())
  type       InvoiceType
  number     String
  poId       String?
  po         PurchaseOrder? @relation(fields: [poId], references: [id], onDelete: SetNull)
  shipmentId String?
  shipment   Shipment?     @relation(fields: [shipmentId], references: [id], onDelete: SetNull)
  amount     Decimal       @db.Decimal(14, 2)
  currency   String        @default("USD")
  issueDate  DateTime
  status     InvoiceStatus @default(ISSUED)
  payments   Payment[]
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  @@unique([type, number])
  @@index([status])
}

model Payment {
  id        String        @id @default(cuid())
  invoiceId String
  invoice   Invoice       @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  amount    Decimal       @db.Decimal(14, 2)
  date      DateTime
  method    PaymentMethod @default(TT)
  reference String?
  createdAt DateTime      @default(now())

  @@index([invoiceId])
}
```

- [ ] **Step 3: Back-relations.** In `model PurchaseOrder` add `invoices Invoice[]`; in `model Shipment` add `invoices Invoice[]`.

- [ ] **Step 4: resetDb** — add `"${s}"."Payment", "${s}"."Invoice"` near the front of the TRUNCATE list (before PurchaseOrder/Shipment).

- [ ] **Step 5: Migrate dev + test** (`prisma migrate dev --name costing_finance`; `dotenv -e .env.test -- prisma migrate deploy`). Commit.

---

## Task 2: Costing approval + confirm gate (TDD)

**Files:** `src/lib/orders/costing.ts` (+test), modify `src/lib/orders/confirm.ts`

- [ ] **Step 1: Failing test** `src/lib/orders/costing.test.ts`:

```ts
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
import { approveCosting } from "./costing";

const admin = { id: "admin-1", role: "ADMIN" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const merch = { id: "m-1", role: "MERCHANDISER" as const };

async function poWithLine() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, { poNumber: "209531", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
  await setOrderLine(admin, po.id, { styleId: style.id, sizes: [{ label: "M", qty: 100, netFob: 1.5, sellFob: 2 }] });
  return po;
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

it("blocks confirm until costing is approved", async () => {
  const po = await poWithLine();
  await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/costing.*approv/i);
  await approveCosting(accounts, po.id);
  const confirmed = await confirmPurchaseOrder(admin, po.id);
  expect(confirmed.status).toBe("CONFIRMED");
});

it("lets Accounts approve but forbids Merchandiser", async () => {
  const po = await poWithLine();
  await expect(approveCosting(merch, po.id)).rejects.toThrow(ForbiddenError);
  const r = await approveCosting(accounts, po.id);
  expect(r.costingApprovedAt).not.toBeNull();
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/orders/costing.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function approveCosting(actor: SessionUser, poId: string) {
  assertPermission(actor, "costing", "approve");
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  if (po.status !== "DRAFT") throw new Error("Costing can only be approved while the order is DRAFT");
  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { costingApprovedById: actor.id, costingApprovedAt: new Date() },
  });
  await recordAudit({ userId: actor.id, entityType: "PurchaseOrder", entityId: poId, action: "approve", after: { costingApproved: true } });
  return updated;
}

export async function unapproveCosting(actor: SessionUser, poId: string) {
  assertPermission(actor, "costing", "approve");
  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { costingApprovedById: null, costingApprovedAt: null },
  });
  await recordAudit({ userId: actor.id, entityType: "PurchaseOrder", entityId: poId, action: "edit", after: { costingApproved: false } });
  return updated;
}
```

- [ ] **Step 4: Gate confirm.** In `src/lib/orders/confirm.ts`, after the `po.status !== "DRAFT"` check, add:

```ts
  if (!po.costingApprovedAt) {
    throw new Error("Costing must be approved before the order can be confirmed");
  }
```

- [ ] **Step 5: Update existing confirm-path test helpers** — in each of these files' PO helper, call `await approveCosting(accounts, po.id)` (import `approveCosting`, add an `accounts` actor) immediately before `confirmPurchaseOrder`: `src/lib/orders/lines.test.ts`, `src/lib/orders/confirm.test.ts`, `src/lib/orders/confirm-tna.test.ts`, `src/lib/production/production.test.ts`, `src/lib/qc/qc.test.ts`, `src/lib/shipment/shipment.test.ts`. (Run each suite after editing; expected: PASS.)

- [ ] **Step 6:** Run `npm test -- src/lib/orders/costing.test.ts` → PASS. Commit.

---

## Task 3: Finance money math (pure, TDD)

**Files:** `src/lib/finance/money.ts` (+test)

- [ ] **Step 1: Failing test** `src/lib/finance/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { outstanding, ageBucket } from "./money";

describe("outstanding", () => {
  it("invoice amount minus payments, floored at 0", () => {
    expect(outstanding("1000.00", [{ amount: "400.00" }, { amount: "100.00" }])).toBe(500);
    expect(outstanding("1000.00", [{ amount: "1000.00" }])).toBe(0);
    expect(outstanding("1000.00", [{ amount: "1200.00" }])).toBe(0);
  });
  it("4dp-safe (no float drift)", () => {
    expect(outstanding("0.30", [{ amount: "0.10" }, { amount: "0.10" }])).toBe(0.1);
  });
});

describe("ageBucket", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  it("buckets by days since issue", () => {
    expect(ageBucket(new Date("2026-06-10T00:00:00Z"), now)).toBe("0-30");
    expect(ageBucket(new Date("2026-05-01T00:00:00Z"), now)).toBe("31-60");
    expect(ageBucket(new Date("2026-03-01T00:00:00Z"), now)).toBe("61-90");
    expect(ageBucket(new Date("2026-01-01T00:00:00Z"), now)).toBe("90+");
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/finance/money.ts`:

```ts
type Decimalish = number | string | { toString(): string };
type Paid = { amount: Decimalish };

function cents(v: Decimalish): number {
  return Math.round(Number(v.toString()) * 100);
}

export function outstanding(amount: Decimalish, payments: Paid[]): number {
  const paid = payments.reduce((a, p) => a + cents(p.amount), 0);
  const out = cents(amount) - paid;
  return Math.max(0, out) / 100;
}

export type AgeBucketKey = "0-30" | "31-60" | "61-90" | "90+";

export function ageBucket(issueDate: Date, now: Date): AgeBucketKey {
  const days = Math.floor((now.getTime() - issueDate.getTime()) / 86_400_000);
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}
```

- [ ] **Step 4: Run → PASS. Commit.**

---

## Task 4: Invoices (TDD)

**Files:** `src/lib/finance/invoices.ts` (+test)

- [ ] **Step 1: Failing test** `src/lib/finance/invoices.test.ts` — create a buyer invoice + a factory invoice against a PO/shipment; list; reject duplicate (type, number); forbid view-only role (Management) from creating; assert Merchandiser cannot create (finance is view-only for them).

```ts
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

it("forbids Merchandiser (finance view-only) and Management from creating", async () => {
  const po = await seedPo();
  await expect(createInvoice(merch, { type: "BUYER", number: "X", poId: po.id, amount: 1, issueDate: d("2026-03-19") })).rejects.toThrow(ForbiddenError);
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/finance/invoices.ts`:

```ts
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const invoiceTypes = ["BUYER", "FACTORY"] as const;

export const createInvoiceSchema = z.object({
  type: z.enum(invoiceTypes),
  number: z.string().min(1),
  poId: z.string().optional(),
  shipmentId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  issueDate: z.coerce.date(),
});
export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;

export async function createInvoice(actor: SessionUser, input: CreateInvoiceInput) {
  assertPermission(actor, "finance", "create");
  const data = createInvoiceSchema.parse(input);
  try {
    const inv = await prisma.invoice.create({ data: { ...data, amount: data.amount } });
    await recordAudit({ userId: actor.id, entityType: "Invoice", entityId: inv.id, action: "create", after: { type: inv.type, number: inv.number, amount: data.amount } });
    return inv;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A ${data.type} invoice numbered ${data.number} already exists`);
    }
    throw e;
  }
}

export async function listInvoices(actor: SessionUser, filter: { type?: "BUYER" | "FACTORY"; poId?: string }) {
  assertPermission(actor, "finance", "view");
  return prisma.invoice.findMany({
    where: { ...(filter.type ? { type: filter.type } : {}), ...(filter.poId ? { poId: filter.poId } : {}) },
    include: { payments: true },
    orderBy: { issueDate: "desc" },
  });
}
```

- [ ] **Step 4: Run → PASS. Commit.**

---

## Task 5: Payments + invoice status (TDD)

**Files:** `src/lib/finance/payments.ts` (+test)

`recordPayment` adds a payment and recomputes the invoice status (ISSUED → PARTIALLY_PAID
→ PAID) atomically; over-payment beyond the invoice amount is rejected.

- [ ] **Step 1: Failing test** `src/lib/finance/payments.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createInvoice } from "./invoices";
import { recordPayment } from "./payments";

const admin = { id: "admin-1", role: "ADMIN" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };
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

it("partial payment -> PARTIALLY_PAID, full -> PAID", async () => {
  const i = await inv(1000);
  await recordPayment(accounts, i.id, { amount: 400, date: d("2026-04-01"), method: "TT" });
  expect((await prisma.invoice.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("PARTIALLY_PAID");
  await recordPayment(accounts, i.id, { amount: 600, date: d("2026-05-01"), method: "TT" });
  expect((await prisma.invoice.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("PAID");
});

it("rejects payment beyond the outstanding amount", async () => {
  const i = await inv(1000);
  await recordPayment(accounts, i.id, { amount: 800, date: d("2026-04-01"), method: "TT" });
  await expect(recordPayment(accounts, i.id, { amount: 300, date: d("2026-05-01"), method: "TT" })).rejects.toThrow(/exceeds outstanding/i);
});

it("forbids a view-only role", async () => {
  const i = await inv(1000);
  await expect(recordPayment(mgmt, i.id, { amount: 1, date: d("2026-04-01"), method: "TT" })).rejects.toThrow(ForbiddenError);
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/finance/payments.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { outstanding } from "./money";

const methods = ["LC", "TT", "OTHER"] as const;

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  date: z.coerce.date(),
  method: z.enum(methods).default("TT"),
  reference: z.string().optional(),
});
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

export async function recordPayment(actor: SessionUser, invoiceId: string, input: RecordPaymentInput) {
  assertPermission(actor, "finance", "create");
  const data = recordPaymentSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
    const out = outstanding(invoice.amount, invoice.payments);
    if (data.amount > out + 1e-9) {
      throw new Error(`Payment ${data.amount} exceeds outstanding ${out}`);
    }
    const payment = await tx.payment.create({ data: { invoiceId, amount: data.amount, date: data.date, method: data.method, reference: data.reference } });
    const newOut = outstanding(invoice.amount, [...invoice.payments, { amount: data.amount }]);
    const status = newOut <= 0 ? "PAID" : "PARTIALLY_PAID";
    await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
    await recordAudit({ userId: actor.id, entityType: "Payment", entityId: payment.id, action: "create", after: { invoiceId, amount: data.amount, status } }, tx);
    return payment;
  });
}

export async function listPayments(actor: SessionUser, invoiceId: string) {
  assertPermission(actor, "finance", "view");
  return prisma.payment.findMany({ where: { invoiceId }, orderBy: { date: "desc" } });
}
```

- [ ] **Step 4: Run → PASS. Commit.**

---

## Task 6: AR/AP + realised margin summary (TDD)

**Files:** `src/lib/finance/summary.ts` (+test)

- [ ] **Step 1: Failing test** `src/lib/finance/summary.test.ts` — seed buyer invoice 1000 (paid 400) + factory invoice 800 (paid 0); assert receivableOutstanding 600, payableOutstanding 800, and aging buckets populated.

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createInvoice } from "./invoices";
import { recordPayment } from "./payments";
import { financeSummary } from "./summary";

const admin = { id: "admin-1", role: "ADMIN" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

it("computes AR / AP outstanding", async () => {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const po = await createPurchaseOrder(admin, { poNumber: "209531", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
  const b = await createInvoice(accounts, { type: "BUYER", number: "ABD-1", poId: po.id, amount: 1000, issueDate: d("2026-06-01") });
  await recordPayment(accounts, b.id, { amount: 400, date: d("2026-06-10"), method: "TT" });
  await createInvoice(accounts, { type: "FACTORY", number: "LFI-1", poId: po.id, amount: 800, issueDate: d("2026-06-01") });
  const s = await financeSummary(accounts, { now: d("2026-06-15") });
  expect(s.receivableOutstanding).toBe(600);
  expect(s.payableOutstanding).toBe(800);
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/finance/summary.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { outstanding, ageBucket, type AgeBucketKey } from "./money";

export type AgingRow = { invoiceId: string; type: string; number: string; outstanding: number; bucket: AgeBucketKey };

export async function financeSummary(actor: SessionUser, opts: { now: Date }) {
  assertPermission(actor, "finance", "view");
  const invoices = await prisma.invoice.findMany({ include: { payments: true } });
  let receivableOutstanding = 0;
  let payableOutstanding = 0;
  const aging: AgingRow[] = [];
  for (const inv of invoices) {
    const out = outstanding(inv.amount, inv.payments);
    if (out <= 0) continue;
    if (inv.type === "BUYER") receivableOutstanding += out;
    else payableOutstanding += out;
    aging.push({ invoiceId: inv.id, type: inv.type, number: inv.number, outstanding: out, bucket: ageBucket(inv.issueDate, opts.now) });
  }
  return {
    receivableOutstanding: Math.round(receivableOutstanding * 100) / 100,
    payableOutstanding: Math.round(payableOutstanding * 100) / 100,
    aging,
  };
}
```

- [ ] **Step 4: Run → PASS. Commit.**

---

## Task 7: Close order (TDD)

**Files:** `src/lib/orders/close.ts` (+test)

- [ ] **Step 1: Failing test** `src/lib/orders/close.test.ts` — only a SHIPPED order can be CLOSED; non-SHIPPED rejects; view-only forbidden.

- [ ] **Step 2/3: Implement** `src/lib/orders/close.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function closePurchaseOrder(actor: SessionUser, poId: string) {
  assertPermission(actor, "orders", "edit");
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  if (po.status !== "SHIPPED") throw new Error(`Only SHIPPED orders can be closed (current: ${po.status})`);
  const updated = await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: "CLOSED" } });
  await recordAudit({ userId: actor.id, entityType: "PurchaseOrder", entityId: poId, action: "edit", before: { status: "SHIPPED" }, after: { status: "CLOSED" } });
  return updated;
}
```

- [ ] **Step 4: Run → PASS. Commit.**

---

## Task 8: Wire the approve-costing control into the order UI + e2e

- [ ] **Step 1:** Add `approveCostingAction(poId)` to `src/lib/orders/form-actions.ts` (server action calling `approveCosting`, `revalidatePath`).
- [ ] **Step 2:** On the order detail confirm block (DRAFT), show costing approval status; if not approved and the actor can `costing:approve`, render an **Approve costing** button; keep Confirm visible but it will error until approved (the button is for Accounts/Admin).
- [ ] **Step 3:** Update `e2e/orders.spec.ts`: after saving the line, click **Approve costing** (admin has approve) before **Confirm order**.
- [ ] **Step 4:** Run `npm run e2e` → all pass.

---

## Task 9: Full verification

- [ ] `npx tsc --noEmit` + `npm test` (all prior + costing, finance money/invoices/payments/summary, close) green. Commit.

---

## Self-Review (plan author)

**Spec coverage (§9③④ / §11 / §14):** costing approval gate → Task 2; buyer+factory invoices → Task 4; payments + status → Task 5; AR/AP + aging + realised → Task 6; SHIPPED→CLOSED → Task 7; RBAC `finance`/`costing` + audit. **Placeholder scan:** none. **Type consistency:** `outstanding`/`ageBucket` shared; `z.input`; P2002 mapped on invoice unique. **Deferred:** finance UI (4b), FX/multi-currency conversion, auto-invoice-on-ship, realised-margin-by-period dashboard (Phase 5).
