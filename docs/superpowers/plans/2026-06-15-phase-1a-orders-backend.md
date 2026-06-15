# Phase 1a — Orders Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Orders backend — purchase orders with size-wise order lines (per-size qty + per-size netFob/sellFob), a Draft→Confirmed state machine with validation, the Open Order Book query with computed totals, multi-PO lots, and back-to-back margin math — all audited, RBAC-guarded, and tested.

**Architecture:** Builds on Phase 0a/0b. Same pattern: Zod schemas → server actions guarded by `assertPermission(actor, "orders", …)` + `recordAudit`. Money is stored as Prisma `Decimal`; pure math helpers compute line/PO totals and margin so they are unit-testable without a DB. No UI in this plan (Phase 1b).

**Tech Stack:** Existing stack (Next.js, Prisma 6, Zod, Vitest). Adds Prisma `Decimal`.

**Scope:** PurchaseOrder, Lot, OrderLine, OrderLineSize models; create-PO, add/replace-line (size-wise), confirm-PO, list (Open Order Book) with filters + totals, get-PO detail, create-lot/assign-lot; margin/total math. **Out of scope (later):** order UI (1b), production/T&A (2), shipment (3), costing approval workflow + invoices (4).

**Prerequisites:** Phase 0b merged. Neon reachable (`.env` dev, `.env.test` `schema=test`). Branch `phase-1a-orders`.

**Conventions:** identical to Phase 0a/0b. `orders` permission (spec §7): Admin full; Merchandiser full; Accounts/Management view. Money: store `Decimal(12,4)`; compute totals in code, round to 2 dp for value/margin.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` (modify) | OrderChannel + OrderStatus enums; PurchaseOrder, Lot, OrderLine, OrderLineSize |
| `src/test/db.ts` (modify) | Add order tables to TRUNCATE list |
| `src/lib/orders/money.{ts,test.ts}` | Pure money/total/margin math (Decimal-safe) |
| `src/lib/orders/schema.ts` | Zod schemas for PO + size-wise lines |
| `src/lib/orders/po.{ts,test.ts}` | createPurchaseOrder, getPurchaseOrder, listOpenOrderBook |
| `src/lib/orders/lines.{ts,test.ts}` | setOrderLine (upsert with sizes), removeOrderLine |
| `src/lib/orders/confirm.{ts,test.ts}` | confirmPurchaseOrder (state machine + validation) |
| `src/lib/orders/lots.{ts,test.ts}` | createLot, assignPoToLot |

---

## Task 1: Orders schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/test/db.ts`

- [ ] **Step 1: Append to `prisma/schema.prisma`**

```prisma
enum OrderChannel {
  RALAWISE
  RALATEAM
  DIRECT
}

enum OrderStatus {
  DRAFT
  CONFIRMED
  IN_PRODUCTION
  PARTLY_SHIPPED
  SHIPPED
  CLOSED
  CANCELLED
  ON_HOLD
}

model Lot {
  id        String          @id @default(cuid())
  name      String
  factoryId String?
  factory   Factory?        @relation(fields: [factoryId], references: [id])
  orders    PurchaseOrder[]
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

model PurchaseOrder {
  id             String       @id @default(cuid())
  poNumber       String
  buyerId        String
  buyer          Buyer        @relation(fields: [buyerId], references: [id])
  brandId        String
  brand          Brand        @relation(fields: [brandId], references: [id])
  channel        OrderChannel @default(DIRECT)
  factoryId      String
  factory        Factory      @relation(fields: [factoryId], references: [id])
  lotId          String?
  lot            Lot?         @relation(fields: [lotId], references: [id])
  orderDate      DateTime?
  exFactoryDate  DateTime?
  currency       String       @default("USD")
  status         OrderStatus  @default(DRAFT)
  notes          String?
  lines          OrderLine[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([buyerId, factoryId, poNumber])
  @@index([status])
  @@index([exFactoryDate])
}

model OrderLine {
  id        String          @id @default(cuid())
  poId      String
  po        PurchaseOrder   @relation(fields: [poId], references: [id], onDelete: Cascade)
  styleId   String
  style     Style           @relation(fields: [styleId], references: [id])
  colourId  String?
  colour    Colour?         @relation(fields: [colourId], references: [id])
  sizes     OrderLineSize[]
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

model OrderLineSize {
  id          String    @id @default(cuid())
  orderLineId String
  orderLine   OrderLine @relation(fields: [orderLineId], references: [id], onDelete: Cascade)
  label       String
  qty         Int       @default(0)
  netFob      Decimal   @default(0) @db.Decimal(12, 4)
  sellFob     Decimal   @default(0) @db.Decimal(12, 4)

  @@unique([orderLineId, label])
}
```

- [ ] **Step 2: Add back-relations to existing models.** In `model Buyer` add `orders PurchaseOrder[]`; in `model Brand` add `orders PurchaseOrder[]`; in `model Factory` add `orders PurchaseOrder[]` and `lots Lot[]`; in `model Style` add `orderLines OrderLine[]`; in `model Colour` add `orderLines OrderLine[]`.

Apply these exact edits:

In `model Buyer { … }`, after the `brands Brand[]` line add:
```prisma
  orders    PurchaseOrder[]
```
In `model Brand { … }`, after the `styles Style[]` line add:
```prisma
  orders    PurchaseOrder[]
```
In `model Factory { … }`, before `active` add:
```prisma
  orders       PurchaseOrder[]
  lots         Lot[]
```
In `model Style { … }`, before `active` add:
```prisma
  orderLines OrderLine[]
```
In `model Colour { … }`, before `active` add:
```prisma
  orderLines OrderLine[]
```

- [ ] **Step 3: Update `src/test/db.ts` TRUNCATE list** to include the new tables (order matters for FK/CASCADE; listing all with CASCADE is safe):

```ts
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "${s}"."AuditLog", "${s}"."OrderLineSize", "${s}"."OrderLine", "${s}"."PurchaseOrder", "${s}"."Lot", "${s}"."Style", "${s}"."Size", "${s}"."SizeScale", "${s}"."Colour", "${s}"."Brand", "${s}"."Buyer", "${s}"."Factory", "${s}"."User" RESTART IDENTITY CASCADE`,
  );
```

- [ ] **Step 4: Migrate dev + test**

Run: `npx prisma migrate dev --name orders`
Run: `npx dotenv -e .env.test -- prisma migrate deploy`
Expected: both succeed; client regenerated.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(orders): PurchaseOrder/Lot/OrderLine/OrderLineSize models + migration"
```

---

## Task 2: Money & totals math (pure, TDD)

**Files:**
- Test: `src/lib/orders/money.test.ts`
- Create: `src/lib/orders/money.ts`

Decimal values from Prisma arrive as objects with `.toString()`; these helpers accept
`number | string | { toString(): string }` and compute in cents to avoid float drift.

- [ ] **Step 1: Write the failing test**

`src/lib/orders/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { lineTotals, sumTotals, type SizeRow } from "./money";

const sizes: SizeRow[] = [
  { qty: 100, netFob: "1.50", sellFob: "2.00" },
  { qty: 50, netFob: 1.5, sellFob: 2 },
];

describe("lineTotals", () => {
  it("sums qty, value (qty*sellFob) and margin (qty*(sellFob-netFob))", () => {
    const t = lineTotals(sizes);
    expect(t.qty).toBe(150);
    expect(t.value).toBe(300); // 150 * 2.00
    expect(t.cost).toBe(225); // 150 * 1.50
    expect(t.margin).toBe(75); // 300 - 225
  });

  it("handles fractional FOB without float drift", () => {
    const t = lineTotals([{ qty: 3, netFob: "0.10", sellFob: "0.30" }]);
    expect(t.value).toBe(0.9);
    expect(t.margin).toBe(0.6);
  });

  it("returns zeros for no sizes", () => {
    expect(lineTotals([])).toEqual({ qty: 0, value: 0, cost: 0, margin: 0 });
  });
});

describe("sumTotals", () => {
  it("aggregates multiple line totals", () => {
    const a = lineTotals(sizes);
    const b = lineTotals([{ qty: 10, netFob: 1, sellFob: 3 }]);
    const total = sumTotals([a, b]);
    expect(total.qty).toBe(160);
    expect(total.value).toBe(330);
    expect(total.margin).toBe(95);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/orders/money.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

`src/lib/orders/money.ts`:

```ts
export type Decimalish = number | string | { toString(): string };
export type SizeRow = { qty: number; netFob: Decimalish; sellFob: Decimalish };
export type Totals = { qty: number; value: number; cost: number; margin: number };

/** Parse a decimalish money value to integer 1/100-cents (4 dp) to avoid float drift. */
function toMills(v: Decimalish): number {
  return Math.round(Number(v.toString()) * 10000);
}

function fromMillsProduct(qty: number, mills: number): number {
  // qty * value, kept in mills then converted to a 2dp number.
  return Math.round((qty * mills) / 100) / 100;
}

export function lineTotals(sizes: SizeRow[]): Totals {
  let qty = 0;
  let value = 0;
  let cost = 0;
  for (const s of sizes) {
    qty += s.qty;
    value += fromMillsProduct(s.qty, toMills(s.sellFob));
    cost += fromMillsProduct(s.qty, toMills(s.netFob));
  }
  value = Math.round(value * 100) / 100;
  cost = Math.round(cost * 100) / 100;
  return { qty, value, cost, margin: Math.round((value - cost) * 100) / 100 };
}

export function sumTotals(totals: Totals[]): Totals {
  return totals.reduce(
    (acc, t) => ({
      qty: acc.qty + t.qty,
      value: Math.round((acc.value + t.value) * 100) / 100,
      cost: Math.round((acc.cost + t.cost) * 100) / 100,
      margin: Math.round((acc.margin + t.margin) * 100) / 100,
    }),
    { qty: 0, value: 0, cost: 0, margin: 0 },
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/orders/money.test.ts` → PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(orders): decimal-safe line/PO totals + margin math"
```

---

## Task 3: Order Zod schemas

**Files:**
- Create: `src/lib/orders/schema.ts`

- [ ] **Step 1: Implement**

`src/lib/orders/schema.ts`:

```ts
import { z } from "zod";

export const orderChannels = ["RALAWISE", "RALATEAM", "DIRECT"] as const;

export const createPoSchema = z.object({
  poNumber: z.string().min(1, "PO number is required"),
  buyerId: z.string().min(1),
  brandId: z.string().min(1),
  factoryId: z.string().min(1),
  channel: z.enum(orderChannels).default("DIRECT"),
  orderDate: z.coerce.date().optional(),
  exFactoryDate: z.coerce.date().optional(),
  currency: z.string().min(1).default("USD"),
  notes: z.string().optional(),
});
export type CreatePoInput = z.infer<typeof createPoSchema>;

export const sizeRowSchema = z.object({
  label: z.string().min(1),
  qty: z.number().int().nonnegative(),
  netFob: z.number().nonnegative(),
  sellFob: z.number().nonnegative(),
});

export const setLineSchema = z.object({
  styleId: z.string().min(1),
  colourId: z.string().optional(),
  sizes: z.array(sizeRowSchema).min(1, "At least one size row required"),
});
export type SetLineInput = z.infer<typeof setLineSchema>;

export const openOrderBookFilterSchema = z.object({
  factoryId: z.string().optional(),
  buyerId: z.string().optional(),
  exFactoryBefore: z.coerce.date().optional(),
});
export type OpenOrderBookFilter = z.infer<typeof openOrderBookFilterSchema>;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(orders): zod schemas for PO, size-wise lines, order-book filter"
```

---

## Task 4: Create PO + Open Order Book (TDD)

**Files:**
- Test: `src/lib/orders/po.test.ts`
- Create: `src/lib/orders/po.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/orders/po.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder, getPurchaseOrder, listOpenOrderBook } from "./po";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };

async function refs() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return { buyer, brand, factory };
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("createPurchaseOrder", () => {
  it("creates a DRAFT PO and audits it", async () => {
    const { buyer, brand, factory } = await refs();
    const po = await createPurchaseOrder(admin, {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
      channel: "RALAWISE",
    });
    expect(po.status).toBe("DRAFT");
    expect(po.poNumber).toBe("209531");
    const audit = await prisma.auditLog.findMany({ where: { entityId: po.id } });
    expect(audit[0].action).toBe("create");
  });

  it("rejects a duplicate PO for the same buyer+factory", async () => {
    const { buyer, brand, factory } = await refs();
    const input = {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
    };
    await createPurchaseOrder(admin, input);
    await expect(createPurchaseOrder(admin, input)).rejects.toThrow(/already exists/i);
  });

  it("forbids a view-only role", async () => {
    const { buyer, brand, factory } = await refs();
    await expect(
      createPurchaseOrder(mgmt, {
        poNumber: "X",
        buyerId: buyer.id,
        brandId: brand.id,
        factoryId: factory.id,
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("listOpenOrderBook", () => {
  it("lists non-closed POs with computed totals and applies filters", async () => {
    const { buyer, brand, factory } = await refs();
    const po = await createPurchaseOrder(admin, {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
    });
    const book = await listOpenOrderBook(admin, {});
    expect(book).toHaveLength(1);
    expect(book[0].id).toBe(po.id);
    expect(book[0].totals).toEqual({ qty: 0, value: 0, cost: 0, margin: 0 });
    // filter miss
    expect(await listOpenOrderBook(admin, { factoryId: "nope" })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/orders/po.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

`src/lib/orders/po.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { createPoSchema, type CreatePoInput, type OpenOrderBookFilter } from "./schema";
import { lineTotals, sumTotals, type Totals } from "./money";

const CLOSED_STATUSES = ["CLOSED", "CANCELLED"] as const;

export async function createPurchaseOrder(actor: SessionUser, input: CreatePoInput) {
  assertPermission(actor, "orders", "create");
  const data = createPoSchema.parse(input);
  const poNumber = data.poNumber.trim();
  const dup = await prisma.purchaseOrder.findUnique({
    where: {
      buyerId_factoryId_poNumber: {
        buyerId: data.buyerId,
        factoryId: data.factoryId,
        poNumber,
      },
    },
  });
  if (dup) throw new Error(`PO ${poNumber} already exists for this buyer/factory`);
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      buyerId: data.buyerId,
      brandId: data.brandId,
      factoryId: data.factoryId,
      channel: data.channel,
      orderDate: data.orderDate,
      exFactoryDate: data.exFactoryDate,
      currency: data.currency,
      notes: data.notes,
    },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "PurchaseOrder",
    entityId: po.id,
    action: "create",
    after: { poNumber: po.poNumber, status: po.status },
  });
  return po;
}

function totalsForLines(
  lines: { sizes: { qty: number; netFob: unknown; sellFob: unknown }[] }[],
): Totals {
  return sumTotals(
    lines.map((l) =>
      lineTotals(
        l.sizes.map((s) => ({
          qty: s.qty,
          netFob: s.netFob as string,
          sellFob: s.sellFob as string,
        })),
      ),
    ),
  );
}

export async function getPurchaseOrder(actor: SessionUser, id: string) {
  assertPermission(actor, "orders", "view");
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      buyer: true,
      brand: true,
      factory: true,
      lot: true,
      lines: { include: { style: true, colour: true, sizes: true } },
    },
  });
  if (!po) return null;
  return { ...po, totals: totalsForLines(po.lines) };
}

export async function listOpenOrderBook(actor: SessionUser, filter: OpenOrderBookFilter) {
  assertPermission(actor, "orders", "view");
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      status: { notIn: [...CLOSED_STATUSES] },
      ...(filter.factoryId ? { factoryId: filter.factoryId } : {}),
      ...(filter.buyerId ? { buyerId: filter.buyerId } : {}),
      ...(filter.exFactoryBefore ? { exFactoryDate: { lte: filter.exFactoryBefore } } : {}),
    },
    include: {
      buyer: true,
      brand: true,
      factory: true,
      lines: { include: { sizes: true } },
    },
    orderBy: [{ exFactoryDate: "asc" }, { createdAt: "asc" }],
  });
  return pos.map((po) => ({ ...po, totals: totalsForLines(po.lines) }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/orders/po.test.ts` → PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(orders): create PO + Open Order Book query with computed totals"
```

---

## Task 5: Set/remove order lines, size-wise (TDD)

**Files:**
- Test: `src/lib/orders/lines.test.ts`
- Create: `src/lib/orders/lines.ts`

`setOrderLine` upserts a line (by po+style+colour) and **replaces** its size rows
atomically — the natural editing model for a size grid.

- [ ] **Step 1: Write the failing test**

`src/lib/orders/lines.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "./po";
import { setOrderLine, removeOrderLine } from "./lines";

const admin = { id: "admin-1", role: "ADMIN" as const };

async function seedPo() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, {
    poNumber: "209531",
    buyerId: buyer.id,
    brandId: brand.id,
    factoryId: factory.id,
  });
  return { po, style };
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("setOrderLine", () => {
  it("creates a line with size-wise quantities and per-size prices", async () => {
    const { po, style } = await seedPo();
    const line = await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [
        { label: "M", qty: 100, netFob: 1.5, sellFob: 2.0 },
        { label: "L", qty: 60, netFob: 1.5, sellFob: 2.0 },
      ],
    });
    const sizes = await prisma.orderLineSize.findMany({ where: { orderLineId: line.id } });
    expect(sizes).toHaveLength(2);
    expect(sizes.reduce((a, s) => a + s.qty, 0)).toBe(160);
  });

  it("supports per-size price overrides (e.g. larger sizes cost more)", async () => {
    const { po, style } = await seedPo();
    const line = await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [
        { label: "M", qty: 10, netFob: 1.5, sellFob: 2.0 },
        { label: "3XL", qty: 5, netFob: 1.8, sellFob: 2.5 },
      ],
    });
    const big = await prisma.orderLineSize.findFirstOrThrow({
      where: { orderLineId: line.id, label: "3XL" },
    });
    expect(big.sellFob.toString()).toBe("2.5");
  });

  it("replaces sizes when called again for the same style+colour (idempotent upsert)", async () => {
    const { po, style } = await seedPo();
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 100, netFob: 1, sellFob: 2 }],
    });
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 120, netFob: 1, sellFob: 2 }],
    });
    const lines = await prisma.orderLine.findMany({ where: { poId: po.id } });
    expect(lines).toHaveLength(1);
    const sizes = await prisma.orderLineSize.findMany({ where: { orderLineId: lines[0].id } });
    expect(sizes).toHaveLength(1);
    expect(sizes[0].qty).toBe(120);
  });

  it("removes a line", async () => {
    const { po, style } = await seedPo();
    const line = await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 1, netFob: 1, sellFob: 2 }],
    });
    await removeOrderLine(admin, line.id);
    expect(await prisma.orderLine.count({ where: { poId: po.id } })).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/orders/lines.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/orders/lines.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { setLineSchema, type SetLineInput } from "./schema";

export async function setOrderLine(actor: SessionUser, poId: string, input: SetLineInput) {
  assertPermission(actor, "orders", "edit");
  const data = setLineSchema.parse(input);
  const colourId = data.colourId ?? null;

  const line = await prisma.$transaction(async (tx) => {
    const existing = await tx.orderLine.findFirst({
      where: { poId, styleId: data.styleId, colourId },
    });
    const ol = existing
      ? existing
      : await tx.orderLine.create({
          data: { poId, styleId: data.styleId, colourId },
        });
    await tx.orderLineSize.deleteMany({ where: { orderLineId: ol.id } });
    await tx.orderLineSize.createMany({
      data: data.sizes.map((s) => ({
        orderLineId: ol.id,
        label: s.label,
        qty: s.qty,
        netFob: s.netFob,
        sellFob: s.sellFob,
      })),
    });
    return ol;
  });

  await recordAudit({
    userId: actor.id,
    entityType: "OrderLine",
    entityId: line.id,
    action: "edit",
    after: { poId, styleId: data.styleId, sizes: data.sizes.length },
  });
  return line;
}

export async function removeOrderLine(actor: SessionUser, lineId: string) {
  assertPermission(actor, "orders", "edit");
  await prisma.orderLine.delete({ where: { id: lineId } });
  await recordAudit({
    userId: actor.id,
    entityType: "OrderLine",
    entityId: lineId,
    action: "delete",
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/orders/lines.test.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(orders): size-wise order line upsert/remove (atomic size replace)"
```

---

## Task 6: Confirm PO — state machine + validation (TDD)

**Files:**
- Test: `src/lib/orders/confirm.test.ts`
- Create: `src/lib/orders/confirm.ts`

A PO cannot be confirmed unless it has ≥1 line and **every** size row has qty>0 and a
sell price>0 (kills the spreadsheet's "un-costed order book" problem). Only
`DRAFT → CONFIRMED` is allowed here.

- [ ] **Step 1: Write the failing test**

`src/lib/orders/confirm.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "./po";
import { setOrderLine } from "./lines";
import { confirmPurchaseOrder } from "./confirm";

const admin = { id: "admin-1", role: "ADMIN" as const };

async function seedPo() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, {
    poNumber: "209531",
    buyerId: buyer.id,
    brandId: brand.id,
    factoryId: factory.id,
  });
  return { po, style };
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("confirmPurchaseOrder", () => {
  it("confirms a fully-costed PO", async () => {
    const { po, style } = await seedPo();
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 100, netFob: 1.5, sellFob: 2.0 }],
    });
    const confirmed = await confirmPurchaseOrder(admin, po.id);
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("refuses to confirm a PO with no lines", async () => {
    const { po } = await seedPo();
    await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/no lines/i);
  });

  it("refuses to confirm when a size has zero qty or zero sell price", async () => {
    const { po, style } = await seedPo();
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 0, netFob: 1.5, sellFob: 2.0 }],
    });
    await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/qty/i);

    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 10, netFob: 1.5, sellFob: 0 }],
    });
    await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/price/i);
  });

  it("refuses to confirm a non-DRAFT PO", async () => {
    const { po, style } = await seedPo();
    await setOrderLine(admin, po.id, {
      styleId: style.id,
      sizes: [{ label: "M", qty: 10, netFob: 1.5, sellFob: 2.0 }],
    });
    await confirmPurchaseOrder(admin, po.id);
    await expect(confirmPurchaseOrder(admin, po.id)).rejects.toThrow(/draft/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/orders/confirm.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/orders/confirm.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function confirmPurchaseOrder(actor: SessionUser, poId: string) {
  assertPermission(actor, "orders", "edit");
  const po = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { lines: { include: { sizes: true } } },
  });

  if (po.status !== "DRAFT") {
    throw new Error(`Only DRAFT orders can be confirmed (current: ${po.status})`);
  }
  if (po.lines.length === 0) {
    throw new Error("Cannot confirm a PO with no lines");
  }
  for (const line of po.lines) {
    if (line.sizes.length === 0) {
      throw new Error("Every line must have at least one size row");
    }
    for (const s of line.sizes) {
      if (s.qty <= 0) {
        throw new Error(`Size ${s.label} must have qty greater than zero`);
      }
      if (Number(s.sellFob.toString()) <= 0) {
        throw new Error(`Size ${s.label} must have a sell price greater than zero`);
      }
    }
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: "CONFIRMED" },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "PurchaseOrder",
    entityId: poId,
    action: "edit",
    after: { status: "CONFIRMED" },
  });
  return updated;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/orders/confirm.test.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(orders): confirm PO with full-costing validation + state machine"
```

---

## Task 7: Lots (TDD)

**Files:**
- Test: `src/lib/orders/lots.test.ts`
- Create: `src/lib/orders/lots.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/orders/lots.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "./po";
import { createLot, assignPoToLot } from "./lots";

const admin = { id: "admin-1", role: "ADMIN" as const };

async function seedPo(poNumber: string, factoryId: string, buyerId: string, brandId: string) {
  return createPurchaseOrder(admin, { poNumber, buyerId, brandId, factoryId });
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("lots", () => {
  it("groups multiple POs into one lot", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const po1 = await seedPo("209531", factory.id, buyer.id, brand.id);
    const po2 = await seedPo("220010080", factory.id, buyer.id, brand.id);

    const lot = await createLot(admin, { name: "LOT-JUN-1", factoryId: factory.id });
    await assignPoToLot(admin, po1.id, lot.id);
    await assignPoToLot(admin, po2.id, lot.id);

    const withOrders = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
      include: { orders: true },
    });
    expect(withOrders.orders).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/orders/lots.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/orders/lots.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createLotSchema = z.object({
  name: z.string().min(1),
  factoryId: z.string().optional(),
});
export type CreateLotInput = z.infer<typeof createLotSchema>;

export async function createLot(actor: SessionUser, input: CreateLotInput) {
  assertPermission(actor, "orders", "create");
  const data = createLotSchema.parse(input);
  const lot = await prisma.lot.create({ data: { name: data.name, factoryId: data.factoryId } });
  await recordAudit({
    userId: actor.id,
    entityType: "Lot",
    entityId: lot.id,
    action: "create",
    after: { name: lot.name },
  });
  return lot;
}

export async function assignPoToLot(actor: SessionUser, poId: string, lotId: string | null) {
  assertPermission(actor, "orders", "edit");
  const po = await prisma.purchaseOrder.update({ where: { id: poId }, data: { lotId } });
  await recordAudit({
    userId: actor.id,
    entityType: "PurchaseOrder",
    entityId: poId,
    action: "edit",
    after: { lotId },
  });
  return po;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/orders/lots.test.ts` → PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(orders): lots — group multiple POs into one production/ship lot"
```

---

## Task 8: Full verification

- [ ] **Step 1: Run the entire suite + type-check**

```bash
npx tsc --noEmit
npm test
```

Expected: all prior tests + money (5) + po (5) + lines (4) + confirm (4) + lots (1) green.

- [ ] **Step 2: Commit (empty allowed)**

```bash
git add -A && git commit -m "test: full Phase 1a verification" --allow-empty
```

---

## Self-Review (completed by plan author)

**Spec coverage (Phase 1a):**
- PO intake / order lines with **size-wise qty + per-size price** (spec §8) → Tasks 1, 3, 5 ✔
- Order can't leave Draft without qty+price (spec §9 ①) → Task 6 ✔
- Open Order Book with computed totals (spec §11) → Task 4 ✔
- Back-to-back margin (spec §9 ③) → Task 2 (margin = sell − net) ✔
- Multi-PO lots (spec §9 ⑤) → Tasks 1, 7 ✔
- RBAC `orders` + audit on every mutation → all tasks ✔

**Placeholder scan:** none.

**Type consistency:** `SessionUser` reused; `Totals`/`SizeRow` defined in money.ts and consumed by po.ts; `CreatePoInput`/`SetLineInput`/`OpenOrderBookFilter` defined in schema.ts and consumed by po.ts/lines.ts; Prisma compound-unique `buyerId_factoryId_poNumber` matches `@@unique` in Task 1.

**Deferred:** order UI (1b), costing approval + invoices (4), production/shipment status transitions beyond DRAFT→CONFIRMED (2/3).
