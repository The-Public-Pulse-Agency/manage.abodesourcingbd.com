# Phase 3a — Shipment & Documents Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the logistics backend — size-wise shipments that consolidate multiple POs into one container, with **balance-quantity tracking** (ordered − shipped per size, no over-shipping), container/BL/Telex tracking, Port & Forwarder master data, automatic PO status transitions (CONFIRMED → PARTLY_SHIPPED → SHIPPED), and a polymorphic Document register (metadata; real file upload deferred).

**Architecture:** Same pattern (Zod → guarded actions → audit). The balance math is a pure, unit-tested function; the DB layer aggregates shipped qty across all shipments. Shipment creation is transactional (shipment + lines + sizes + PO status recompute commit together). Documents are polymorphic (`entityType`+`entityId`, no FK) to attach to a PO or a Shipment.

**Tech Stack:** Existing. No new deps (S3 upload deferred to 3b/infra; documents store metadata + optional `fileUrl`).

**Scope:** Port/Forwarder master data; Shipment + ShipmentLine + ShipmentLineSize; balance math + over-ship guard; createShipment (transactional, with PO status transition); updateShipment (BL/telex/docs); list/get; Document metadata register. **Out of scope:** shipment UI (3b), real S3 file upload (infra), costing/invoices (Phase 4).

**Prerequisites:** Phase 2c merged. Neon reachable. Branch `phase-3a-shipment`. `shipment` and `documents` permissions exist (spec §7: Admin/Merchandiser full shipment; Accounts view; Management view; documents Admin/Merchandiser full, Accounts edit, Management view).

**Conventions:** identical to prior phases. Dates UTC-floored where they drive logic (reuse `startOfUtcDay` from `@/lib/tna/schedule`).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` (modify) | `ShipmentMode`/`TelexStatus`/`DocumentType` enums; `Port`, `Forwarder`, `Shipment`, `ShipmentLine`, `ShipmentLineSize`, `Document`; back-relations |
| `src/test/db.ts` (modify) | Add new tables to TRUNCATE |
| `src/lib/masterdata/logistics.ts` (+test) | Port + Forwarder create/list |
| `src/lib/shipment/balance.ts` (+test) | Pure size-wise remaining/over-ship math |
| `src/lib/shipment/balance-db.ts` (+test) | `getPoBalance(actor, poId)` aggregating shipped across shipments |
| `src/lib/shipment/shipment.ts` (+test) | createShipment (tx, over-ship guard, PO status), updateShipment, list/get |
| `src/lib/documents/documents.ts` (+test) | createDocument / listDocuments (polymorphic) |

---

## Task 1: Schema + migration

**Files:** modify `prisma/schema.prisma`, `src/test/db.ts`

- [ ] **Step 1: Append models**

```prisma
enum ShipmentMode {
  SEA
  AIR
}

enum TelexStatus {
  PENDING
  RECEIVED
  RELEASED
}

enum DocumentType {
  BL
  COMMERCIAL_INVOICE
  PACKING_LIST
  TEST_CERT
  SAMPLE_PHOTO
  OTHER
}

model Port {
  id        String   @id @default(cuid())
  name      String   @unique
  country   String?
  active    Boolean  @default(true)
  shipments Shipment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Forwarder {
  id        String   @id @default(cuid())
  name      String   @unique
  contact   String?
  active    Boolean  @default(true)
  shipments Shipment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Shipment {
  id            String         @id @default(cuid())
  reference     String         @unique
  mode          ShipmentMode   @default(SEA)
  containerNo   String?
  cartons       Int?
  exFactoryDate DateTime?
  blNumber      String?
  blDate        DateTime?
  telexStatus   TelexStatus    @default(PENDING)
  forwarderId   String?
  forwarder     Forwarder?     @relation(fields: [forwarderId], references: [id], onDelete: SetNull)
  portId        String?
  port          Port?          @relation(fields: [portId], references: [id], onDelete: SetNull)
  lines         ShipmentLine[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([telexStatus])
}

model ShipmentLine {
  id          String              @id @default(cuid())
  shipmentId  String
  shipment    Shipment            @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  orderLineId String
  orderLine   OrderLine           @relation(fields: [orderLineId], references: [id])
  sizes       ShipmentLineSize[]
  createdAt   DateTime            @default(now())

  @@index([orderLineId])
}

model ShipmentLineSize {
  id             String       @id @default(cuid())
  shipmentLineId String
  shipmentLine   ShipmentLine @relation(fields: [shipmentLineId], references: [id], onDelete: Cascade)
  label          String
  qty            Int

  @@index([shipmentLineId])
}

model Document {
  id           String       @id @default(cuid())
  entityType   String
  entityId     String
  type         DocumentType
  fileName     String
  fileUrl      String?
  uploadedById String?
  createdAt    DateTime     @default(now())

  @@index([entityType, entityId])
}
```

- [ ] **Step 2: Back-relation.** In `model OrderLine`, after `sizes OrderLineSize[]` add:

```prisma
  shipmentLines ShipmentLine[]
```

- [ ] **Step 3: `src/test/db.ts` TRUNCATE** — add near the front (children before parents):

```ts
    `TRUNCATE TABLE "${s}"."AuditLog", "${s}"."Document", "${s}"."ShipmentLineSize", "${s}"."ShipmentLine", "${s}"."Shipment", "${s}"."Port", "${s}"."Forwarder", "${s}"."Inspection", "${s}"."ProductionRecord", "${s}"."SampleRequest", "${s}"."TaMilestone", "${s}"."TaMilestoneTemplate", "${s}"."OrderLineSize", "${s}"."OrderLine", "${s}"."PurchaseOrder", "${s}"."Lot", "${s}"."Style", "${s}"."Size", "${s}"."SizeScale", "${s}"."Colour", "${s}"."Brand", "${s}"."Buyer", "${s}"."Factory", "${s}"."User" RESTART IDENTITY CASCADE`,
```

- [ ] **Step 4: Migrate dev + test**

Run: `npx prisma migrate dev --name shipment_documents`
Run: `npx dotenv -e .env.test -- prisma migrate deploy`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(3a): Shipment/Document/Port/Forwarder models + migration"
```

---

## Task 2: Port + Forwarder master data (TDD)

**Files:** `src/lib/masterdata/logistics.ts` (+ test)

- [ ] **Step 1: Failing test** `src/lib/masterdata/logistics.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createPort, listPorts, createForwarder, listForwarders } from "./logistics";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("ports & forwarders", () => {
  it("creates and lists ports", async () => {
    await createPort(admin, { name: "Chittagong", country: "BD" });
    expect(await listPorts(admin)).toHaveLength(1);
  });
  it("rejects duplicate port name", async () => {
    await createPort(admin, { name: "Chittagong" });
    await expect(createPort(admin, { name: "Chittagong" })).rejects.toThrow(/already exists/i);
  });
  it("creates and lists forwarders", async () => {
    await createForwarder(admin, { name: "CF Global" });
    expect(await listForwarders(admin)).toHaveLength(1);
  });
  it("forbids a view-only role from creating", async () => {
    await expect(createPort(mgmt, { name: "X" })).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/masterdata/logistics.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createPortSchema = z.object({ name: z.string().min(1), country: z.string().optional() });
export const createForwarderSchema = z.object({ name: z.string().min(1), contact: z.string().optional() });

export async function createPort(actor: SessionUser, input: z.input<typeof createPortSchema>) {
  assertPermission(actor, "masterData", "create");
  const data = createPortSchema.parse(input);
  if (await prisma.port.findUnique({ where: { name: data.name } })) {
    throw new Error(`A port named ${data.name} already exists`);
  }
  const port = await prisma.port.create({ data });
  await recordAudit({ userId: actor.id, entityType: "Port", entityId: port.id, action: "create", after: { name: port.name } });
  return port;
}

export async function listPorts(actor: SessionUser) {
  assertPermission(actor, "masterData", "view");
  return prisma.port.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function createForwarder(actor: SessionUser, input: z.input<typeof createForwarderSchema>) {
  assertPermission(actor, "masterData", "create");
  const data = createForwarderSchema.parse(input);
  if (await prisma.forwarder.findUnique({ where: { name: data.name } })) {
    throw new Error(`A forwarder named ${data.name} already exists`);
  }
  const fwd = await prisma.forwarder.create({ data });
  await recordAudit({ userId: actor.id, entityType: "Forwarder", entityId: fwd.id, action: "create", after: { name: fwd.name } });
  return fwd;
}

export async function listForwarders(actor: SessionUser) {
  assertPermission(actor, "masterData", "view");
  return prisma.forwarder.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat(3a): port + forwarder master data`.

---

## Task 3: Balance math (pure, TDD)

**Files:** `src/lib/shipment/balance.ts` (+ test)

- [ ] **Step 1: Failing test** `src/lib/shipment/balance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { remainingBySize, assertWithinBalance } from "./balance";

describe("remainingBySize", () => {
  it("computes ordered - shipped per size label", () => {
    const out = remainingBySize(
      [{ label: "M", qty: 100 }, { label: "L", qty: 60 }],
      [{ label: "M", qty: 40 }],
    );
    expect(out).toEqual([
      { label: "M", ordered: 100, shipped: 40, balance: 60 },
      { label: "L", ordered: 60, shipped: 0, balance: 60 },
    ]);
  });
  it("aggregates shipped across multiple shipment rows for the same label", () => {
    const out = remainingBySize([{ label: "M", qty: 100 }], [{ label: "M", qty: 30 }, { label: "M", qty: 50 }]);
    expect(out[0].balance).toBe(20);
  });
});

describe("assertWithinBalance", () => {
  it("passes when requested <= balance", () => {
    expect(() => assertWithinBalance([{ label: "M", ordered: 100, shipped: 40, balance: 60 }], [{ label: "M", qty: 60 }])).not.toThrow();
  });
  it("throws when a size is over-shipped", () => {
    expect(() => assertWithinBalance([{ label: "M", ordered: 100, shipped: 40, balance: 60 }], [{ label: "M", qty: 61 }])).toThrow(/exceeds balance/i);
  });
  it("throws for a label not in the order line", () => {
    expect(() => assertWithinBalance([{ label: "M", ordered: 100, shipped: 0, balance: 100 }], [{ label: "XXL", qty: 1 }])).toThrow(/not in the order/i);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/shipment/balance.ts`:

```ts
export type SizeQty = { label: string; qty: number };
export type SizeBalance = { label: string; ordered: number; shipped: number; balance: number };

export function remainingBySize(ordered: SizeQty[], shipped: SizeQty[]): SizeBalance[] {
  const shippedByLabel = new Map<string, number>();
  for (const s of shipped) shippedByLabel.set(s.label, (shippedByLabel.get(s.label) ?? 0) + s.qty);
  return ordered.map((o) => {
    const ship = shippedByLabel.get(o.label) ?? 0;
    return { label: o.label, ordered: o.qty, shipped: ship, balance: o.qty - ship };
  });
}

export function assertWithinBalance(balances: SizeBalance[], requested: SizeQty[]): void {
  const byLabel = new Map(balances.map((b) => [b.label, b]));
  for (const r of requested) {
    if (r.qty <= 0) continue;
    const b = byLabel.get(r.label);
    if (!b) throw new Error(`Size ${r.label} is not in the order line`);
    if (r.qty > b.balance) {
      throw new Error(`Size ${r.label}: shipping ${r.qty} exceeds balance ${b.balance}`);
    }
  }
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat(3a): pure size-wise balance + over-ship guard`.

---

## Task 4: PO balance (DB) (TDD)

**Files:** `src/lib/shipment/balance-db.ts` (+ test)

- [ ] **Step 1: Failing test** `src/lib/shipment/balance-db.test.ts` — seed a confirmed PO with a 100-pc M line, create one shipment of 40 M, then assert `getPoBalance` reports balance 60 for M. (Use the shipment action from Task 5; if writing tests first, this task's test can be merged with Task 5's suite. For TDD ordering, write `getPoBalance` against raw `prisma.shipmentLineSize` rows.)

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "@/lib/orders/po";
import { setOrderLine } from "@/lib/orders/lines";
import { getPoBalance } from "./balance-db";

const admin = { id: "admin-1", role: "ADMIN" as const };

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

it("reports full balance when nothing shipped", async () => {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, { poNumber: "209531", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
  const line = await setOrderLine(admin, po.id, { styleId: style.id, sizes: [{ label: "M", qty: 100, netFob: 1, sellFob: 2 }] });
  const bal = await getPoBalance(admin, po.id);
  expect(bal.find((l) => l.orderLineId === line.id)?.sizes[0]).toMatchObject({ label: "M", ordered: 100, shipped: 0, balance: 100 });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/shipment/balance-db.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { remainingBySize, type SizeBalance } from "./balance";

export type LineBalance = { orderLineId: string; styleCode: string; colour: string | null; sizes: SizeBalance[] };

export async function getPoBalance(actor: SessionUser, poId: string): Promise<LineBalance[]> {
  assertPermission(actor, "shipment", "view");
  const lines = await prisma.orderLine.findMany({
    where: { poId },
    include: {
      style: true,
      colour: true,
      sizes: true,
      shipmentLines: { include: { sizes: true } },
    },
  });
  return lines.map((l) => {
    const shipped = l.shipmentLines.flatMap((sl) => sl.sizes.map((s) => ({ label: s.label, qty: s.qty })));
    const ordered = l.sizes.map((s) => ({ label: s.label, qty: s.qty }));
    return {
      orderLineId: l.id,
      styleCode: l.style.styleCode,
      colour: l.colour?.name ?? null,
      sizes: remainingBySize(ordered, shipped),
    };
  });
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat(3a): per-PO size-wise balance (DB aggregate)`.

---

## Task 5: Create / update shipment (TDD)

**Files:** `src/lib/shipment/shipment.ts` (+ test)

`createShipment` validates every shipped size against current balance, writes shipment +
lines + sizes in a transaction, and recomputes affected POs' status
(CONFIRMED/IN_PRODUCTION/PARTLY_SHIPPED → PARTLY_SHIPPED if some balance remains, SHIPPED
if all lines fully shipped).

- [ ] **Step 1: Failing test** `src/lib/shipment/shipment.test.ts`:

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
import { createShipment, updateShipment } from "./shipment";
import { getPoBalance } from "./balance-db";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function confirmedLine(qty: number) {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, { poNumber: "209531", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
  const line = await setOrderLine(admin, po.id, { styleId: style.id, sizes: [{ label: "M", qty, netFob: 1, sellFob: 2 }] });
  await confirmPurchaseOrder(admin, po.id);
  return { po, line };
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("createShipment", () => {
  it("ships partial qty, decrements balance, sets PARTLY_SHIPPED", async () => {
    const { po, line } = await confirmedLine(100);
    await createShipment(admin, {
      reference: "SHP-1", mode: "SEA", containerNo: "ABCD1234567",
      lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 40 }] }],
    });
    const bal = await getPoBalance(admin, po.id);
    expect(bal[0].sizes[0].balance).toBe(60);
    const after = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(after.status).toBe("PARTLY_SHIPPED");
  });

  it("sets SHIPPED when the full balance ships", async () => {
    const { po, line } = await confirmedLine(100);
    await createShipment(admin, { reference: "SHP-2", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 100 }] }] });
    const after = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(after.status).toBe("SHIPPED");
  });

  it("rejects over-shipping beyond balance (across shipments)", async () => {
    const { line } = await confirmedLine(100);
    await createShipment(admin, { reference: "SHP-3", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 70 }] }] });
    await expect(
      createShipment(admin, { reference: "SHP-4", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 40 }] }] }),
    ).rejects.toThrow(/exceeds balance/i);
  });

  it("rejects a duplicate shipment reference", async () => {
    const { line } = await confirmedLine(100);
    await createShipment(admin, { reference: "DUP", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 10 }] }] });
    await expect(
      createShipment(admin, { reference: "DUP", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 10 }] }] }),
    ).rejects.toThrow(/already exists/i);
  });

  it("forbids a view-only role", async () => {
    const { line } = await confirmedLine(100);
    await expect(
      createShipment(mgmt, { reference: "X", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 1 }] }] }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("updateShipment", () => {
  it("updates BL + telex status", async () => {
    const { line } = await confirmedLine(100);
    const shp = await createShipment(admin, { reference: "SHP-5", lines: [{ orderLineId: line.id, sizes: [{ label: "M", qty: 10 }] }] });
    const upd = await updateShipment(admin, shp.id, { blNumber: "BL123", blDate: d("2026-03-19"), telexStatus: "RELEASED" });
    expect(upd.telexStatus).toBe("RELEASED");
    expect(upd.blNumber).toBe("BL123");
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/shipment/shipment.ts`:

```ts
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { remainingBySize, assertWithinBalance } from "./balance";

const shipmentModes = ["SEA", "AIR"] as const;
const telexStatuses = ["PENDING", "RECEIVED", "RELEASED"] as const;

export const createShipmentSchema = z.object({
  reference: z.string().min(1),
  mode: z.enum(shipmentModes).default("SEA"),
  containerNo: z.string().optional(),
  cartons: z.number().int().nonnegative().optional(),
  exFactoryDate: z.coerce.date().optional(),
  blNumber: z.string().optional(),
  blDate: z.coerce.date().optional(),
  telexStatus: z.enum(telexStatuses).default("PENDING"),
  forwarderId: z.string().optional(),
  portId: z.string().optional(),
  lines: z
    .array(
      z.object({
        orderLineId: z.string().min(1),
        sizes: z.array(z.object({ label: z.string().min(1), qty: z.number().int().positive() })).min(1),
      }),
    )
    .min(1, "A shipment needs at least one line"),
});
export type CreateShipmentInput = z.input<typeof createShipmentSchema>;

const SHIPPABLE = ["CONFIRMED", "IN_PRODUCTION", "PARTLY_SHIPPED"] as const;

export async function createShipment(actor: SessionUser, input: CreateShipmentInput) {
  assertPermission(actor, "shipment", "create");
  const data = createShipmentSchema.parse(input);

  const shipment = await prisma.$transaction(async (tx) => {
    const affectedPoIds = new Set<string>();
    // Validate every line against current balance (computed inside the tx).
    for (const l of data.lines) {
      const ol = await tx.orderLine.findUnique({
        where: { id: l.orderLineId },
        include: { sizes: true, shipmentLines: { include: { sizes: true } }, po: true },
      });
      if (!ol) throw new Error(`Order line ${l.orderLineId} not found`);
      if (!SHIPPABLE.includes(ol.po.status as (typeof SHIPPABLE)[number])) {
        throw new Error(`Cannot ship a ${ol.po.status} order`);
      }
      affectedPoIds.add(ol.poId);
      const shipped = ol.shipmentLines.flatMap((sl) => sl.sizes.map((s) => ({ label: s.label, qty: s.qty })));
      const balances = remainingBySize(ol.sizes.map((s) => ({ label: s.label, qty: s.qty })), shipped);
      assertWithinBalance(balances, l.sizes);
    }

    const created = await tx.shipment.create({
      data: {
        reference: data.reference,
        mode: data.mode,
        containerNo: data.containerNo,
        cartons: data.cartons,
        exFactoryDate: data.exFactoryDate,
        blNumber: data.blNumber,
        blDate: data.blDate,
        telexStatus: data.telexStatus,
        forwarderId: data.forwarderId,
        portId: data.portId,
        lines: {
          create: data.lines.map((l) => ({
            orderLineId: l.orderLineId,
            sizes: { create: l.sizes.map((s) => ({ label: s.label, qty: s.qty })) },
          })),
        },
      },
    });

    // Recompute affected PO statuses.
    for (const poId of affectedPoIds) {
      const lines = await tx.orderLine.findMany({
        where: { poId },
        include: { sizes: true, shipmentLines: { include: { sizes: true } } },
      });
      const fullyShipped = lines.every((l) => {
        const shipped = l.shipmentLines.flatMap((sl) => sl.sizes.map((s) => ({ label: s.label, qty: s.qty })));
        return remainingBySize(l.sizes.map((s) => ({ label: s.label, qty: s.qty })), shipped).every((b) => b.balance <= 0);
      });
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: fullyShipped ? "SHIPPED" : "PARTLY_SHIPPED" },
      });
    }
    return created;
  }).catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A shipment with reference ${data.reference} already exists`);
    }
    throw e;
  });

  await recordAudit({
    userId: actor.id,
    entityType: "Shipment",
    entityId: shipment.id,
    action: "create",
    after: { reference: shipment.reference, lines: data.lines.length },
  });
  return shipment;
}

export const updateShipmentSchema = z.object({
  containerNo: z.string().optional(),
  cartons: z.number().int().nonnegative().optional(),
  blNumber: z.string().optional(),
  blDate: z.coerce.date().optional(),
  telexStatus: z.enum(telexStatuses).optional(),
  forwarderId: z.string().optional(),
  portId: z.string().optional(),
});
export type UpdateShipmentInput = z.input<typeof updateShipmentSchema>;

export async function updateShipment(actor: SessionUser, id: string, input: UpdateShipmentInput) {
  assertPermission(actor, "shipment", "edit");
  const data = updateShipmentSchema.parse(input);
  const shipment = await prisma.shipment.update({ where: { id }, data });
  await recordAudit({
    userId: actor.id,
    entityType: "Shipment",
    entityId: id,
    action: "edit",
    after: data as Prisma.InputJsonValue,
  });
  return shipment;
}

export async function listShipments(actor: SessionUser) {
  assertPermission(actor, "shipment", "view");
  return prisma.shipment.findMany({
    include: { forwarder: true, port: true, lines: { include: { sizes: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getShipment(actor: SessionUser, id: string) {
  assertPermission(actor, "shipment", "view");
  return prisma.shipment.findUnique({
    where: { id },
    include: {
      forwarder: true,
      port: true,
      lines: { include: { sizes: true, orderLine: { include: { style: true, colour: true, po: true } } } },
    },
  });
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat(3a): create/update shipment with balance guard + PO status transition`.

---

## Task 6: Documents register (TDD)

**Files:** `src/lib/documents/documents.ts` (+ test)

- [ ] **Step 1: Failing test** `src/lib/documents/documents.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createDocument, listDocuments } from "./documents";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

it("attaches a document to an entity and lists it", async () => {
  await createDocument(admin, { entityType: "Shipment", entityId: "ship-1", type: "BL", fileName: "bl.pdf" });
  const docs = await listDocuments(admin, "Shipment", "ship-1");
  expect(docs).toHaveLength(1);
  expect(docs[0].type).toBe("BL");
});

it("forbids a view-only role from uploading", async () => {
  await expect(
    createDocument(mgmt, { entityType: "Shipment", entityId: "ship-1", type: "BL", fileName: "bl.pdf" }),
  ).rejects.toThrow(ForbiddenError);
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** `src/lib/documents/documents.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const documentTypes = ["BL", "COMMERCIAL_INVOICE", "PACKING_LIST", "TEST_CERT", "SAMPLE_PHOTO", "OTHER"] as const;
const entityTypes = ["PurchaseOrder", "Shipment"] as const;

export const createDocumentSchema = z.object({
  entityType: z.enum(entityTypes),
  entityId: z.string().min(1),
  type: z.enum(documentTypes),
  fileName: z.string().min(1),
  fileUrl: z.string().optional(),
});
export type CreateDocumentInput = z.input<typeof createDocumentSchema>;

export async function createDocument(actor: SessionUser, input: CreateDocumentInput) {
  assertPermission(actor, "documents", "create");
  const data = createDocumentSchema.parse(input);
  const doc = await prisma.document.create({ data: { ...data, uploadedById: actor.id } });
  await recordAudit({ userId: actor.id, entityType: "Document", entityId: doc.id, action: "create", after: { type: doc.type, on: `${data.entityType}:${data.entityId}` } });
  return doc;
}

export async function listDocuments(actor: SessionUser, entityType: string, entityId: string) {
  assertPermission(actor, "documents", "view");
  return prisma.document.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" } });
}
```

- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat(3a): polymorphic document register (metadata)`.

---

## Task 7: Full verification

- [ ] **Step 1:** `npx tsc --noEmit` then `npm test` → all prior + logistics (4) + balance (5) + balance-db (1) + shipment (6) + documents (2) green.
- [ ] **Step 2:** Commit `test: full Phase 3a verification` `--allow-empty`.

---

## Self-Review (plan author)

**Spec coverage (§4 modules 8–9 / §9⑤):** shipment consolidation + size-wise balance → Tasks 3–5; container/BL/telex → Task 5; partial/short-qty (balance) → Tasks 3–5; ports/forwarders → Task 2; documents → Task 6; PO status transitions → Task 5. RBAC `shipment`/`documents`/`masterData`; audit on all mutations.

**Placeholder scan:** none. **Type consistency:** `SizeQty`/`SizeBalance` shared `balance.ts`→`balance-db.ts`→`shipment.ts`; `z.input` for inputs; reference unique → P2002 mapped.

**Deferred:** shipment UI (3b), real S3 upload, invoices/finance (Phase 4), milestone auto-complete on ex-factory (future), SHIPPED→CLOSED auto-close, shipment deletion + status-restore.

---

## Review Revisions (applied)

1. **Over-ship serialized** — `createShipment` tx runs at Serializable; P2034 → friendly retry error; concurrency test asserts total shipped ≤ ordered.
2. **Duplicate order-line guard** — schema refine rejects repeated `orderLineId`; `@@unique([shipmentId, orderLineId])` + `@@unique([shipmentLineId, label])`.
3. **Conditional PO status** — `updateMany({where:{id, status:{in:SHIPPABLE}}})`; `fullyShipped` requires ≥1 line & every line ≥1 size.
4. **Audit inside tx** — shipment create + each PO status change recorded before→after via `recordAudit(input, tx)`.
5. **Document existence check** — verify target PO/Shipment exists (no orphans); shared `DOCUMENT_ENTITY_TYPES`.
6. **BL uniqueness + telex workflow** — `blNumber @unique` (P2002 mapped); `updateShipment` enforces forward-only telex, RELEASED needs a BL.
7. **Accounts → finance docs only** (spec §7).
8. **Tests** — multi-PO consolidation, balance-across-shipments, non-shippable statuses, duplicate-line, concurrency invariant.
