# Phase 2a — Critical Path (T&A) Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Time & Action (Critical Path) backend — a default milestone template, per-order milestones instantiated on confirm (back-scheduled from the ex-factory date), pure RAG/overdue logic, complete/reschedule actions, and a cross-order critical-path board — all audited, RBAC-guarded, and tested.

**Architecture:** Builds on Phase 1. Pure date math (back-schedule + RAG) lives in a dependency-free module so it is exhaustively unit-testable. Milestones are denormalized snapshots of the template (key/name/stage/position copied at instantiation) so later template edits never rewrite history. RAG is **computed on read** from `plannedDate`/`actualDate`/`now` (no stored status to drift; the daily alert job is a later phase). Instantiation hooks into the existing `confirmPurchaseOrder` (spec §9②: milestones created on confirm).

**Tech Stack:** Existing (Next.js, Prisma 6, Zod, Vitest). No new deps.

**Scope:** `TaMilestoneTemplate`, `TaMilestone` models; schedule/RAG math; template seed + list; instantiate-on-confirm; complete/reschedule/list-with-RAG; critical-path board query. **Out of scope (later):** sampling + production/QC records (2b), T&A UI / board screen (2c), scheduled alert job + notifications (Phase 5).

**Prerequisites:** Phase 1b merged. Neon reachable. Branch `phase-2a-tna`.

**Conventions:** identical to prior phases. T&A uses the `criticalPath` permission (spec §7: Admin/Merchandiser full; Accounts/Management view). Dates compared **date-only in UTC** (milestones stored at UTC midnight) to avoid time-of-day/timezone drift; `now` is always injected for testability.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` (modify) | `TaStage` enum; `TaMilestoneTemplate`, `TaMilestone`; PO back-relation |
| `src/test/db.ts` (modify) | Add T&A tables to TRUNCATE list |
| `src/lib/tna/schedule.ts` (+test) | Pure: `addDaysUtc`, `plannedDateFor`, `computeRag` |
| `src/lib/tna/templates.ts` (+test) | Default template data; `seedTemplates`, `listTemplates` |
| `src/lib/tna/milestones.ts` (+test) | `instantiateMilestones`, `completeMilestone`, `rescheduleMilestone`, `listPoMilestones` |
| `src/lib/tna/board.ts` (+test) | `criticalPathBoard` (overdue / due-soon across open POs) |
| `src/lib/orders/confirm.ts` (modify) | Call `instantiateMilestones` after a successful confirm |

---

## Task 1: T&A schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/test/db.ts`

- [ ] **Step 1: Append to `prisma/schema.prisma`**

```prisma
enum TaStage {
  PRE_PRODUCTION
  SAMPLING
  PRODUCTION_QC
  SHIPPING
}

model TaMilestoneTemplate {
  id         String   @id @default(cuid())
  key        String   @unique
  name       String
  stage      TaStage
  offsetDays Int?
  position   Int
  active     Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model TaMilestone {
  id          String        @id @default(cuid())
  poId        String
  po          PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  key         String
  name        String
  stage       TaStage
  position    Int
  plannedDate DateTime?
  actualDate  DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([poId, key])
  @@index([plannedDate])
}
```

- [ ] **Step 2: Add the PO back-relation.** In `model PurchaseOrder`, after the `lines OrderLine[]` line add:

```prisma
  milestones    TaMilestone[]
```

- [ ] **Step 3: Update `src/test/db.ts` TRUNCATE list** — replace the table list to include the two new tables (TaMilestone before PurchaseOrder; templates have no FK):

```ts
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "${s}"."AuditLog", "${s}"."TaMilestone", "${s}"."TaMilestoneTemplate", "${s}"."OrderLineSize", "${s}"."OrderLine", "${s}"."PurchaseOrder", "${s}"."Lot", "${s}"."Style", "${s}"."Size", "${s}"."SizeScale", "${s}"."Colour", "${s}"."Brand", "${s}"."Buyer", "${s}"."Factory", "${s}"."User" RESTART IDENTITY CASCADE`,
  );
```

- [ ] **Step 4: Migrate dev + test**

Run: `npx prisma migrate dev --name tna`
Run: `npx dotenv -e .env.test -- prisma migrate deploy`
Expected: both succeed; client regenerated.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(tna): TaMilestoneTemplate + TaMilestone models + migration"
```

---

## Task 2: Schedule & RAG math (pure, TDD)

**Files:**
- Test: `src/lib/tna/schedule.test.ts`
- Create: `src/lib/tna/schedule.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/tna/schedule.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addDaysUtc, plannedDateFor, computeRag } from "./schedule";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("addDaysUtc", () => {
  it("adds and subtracts whole days in UTC", () => {
    expect(addDaysUtc(d("2026-06-30"), -5).toISOString()).toBe("2026-06-25T00:00:00.000Z");
    expect(addDaysUtc(d("2026-06-30"), 7).toISOString()).toBe("2026-07-07T00:00:00.000Z");
  });
});

describe("plannedDateFor", () => {
  it("back-schedules from ex-factory using the (negative) offset", () => {
    expect(plannedDateFor(d("2026-06-30"), -45)?.toISOString()).toBe("2026-05-16T00:00:00.000Z");
  });
  it("returns null when ex-factory or offset is missing", () => {
    expect(plannedDateFor(null, -45)).toBeNull();
    expect(plannedDateFor(d("2026-06-30"), null)).toBeNull();
  });
});

describe("computeRag", () => {
  const now = d("2026-06-15");
  it("DONE when an actual date is set (regardless of planned)", () => {
    expect(computeRag(d("2026-06-01"), d("2026-06-02"), now)).toBe("DONE");
  });
  it("UNSCHEDULED when no planned date", () => {
    expect(computeRag(null, null, now)).toBe("UNSCHEDULED");
  });
  it("OVERDUE when planned is before today and not done", () => {
    expect(computeRag(d("2026-06-14"), null, now)).toBe("OVERDUE");
  });
  it("DUE_SOON when planned is today or within the window", () => {
    expect(computeRag(d("2026-06-15"), null, now)).toBe("DUE_SOON");
    expect(computeRag(d("2026-06-22"), null, now)).toBe("DUE_SOON");
  });
  it("ON_TRACK when planned is beyond the window", () => {
    expect(computeRag(d("2026-06-23"), null, now)).toBe("ON_TRACK");
  });
  it("ignores time-of-day (date-only comparison)", () => {
    const lateToday = new Date("2026-06-15T23:30:00.000Z");
    expect(computeRag(d("2026-06-15"), null, lateToday)).toBe("DUE_SOON");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/tna/schedule.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

`src/lib/tna/schedule.ts`:

```ts
export type Rag = "DONE" | "OVERDUE" | "DUE_SOON" | "ON_TRACK" | "UNSCHEDULED";

const MS_PER_DAY = 86_400_000;

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Back-schedule a milestone's planned date from the ex-factory date. */
export function plannedDateFor(
  exFactoryDate: Date | null | undefined,
  offsetDays: number | null | undefined,
): Date | null {
  if (!exFactoryDate || offsetDays === null || offsetDays === undefined) return null;
  return addDaysUtc(exFactoryDate, offsetDays);
}

/** UTC day index, for date-only comparison. */
function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

export function computeRag(
  plannedDate: Date | null | undefined,
  actualDate: Date | null | undefined,
  now: Date,
  dueSoonDays = 7,
): Rag {
  if (actualDate) return "DONE";
  if (!plannedDate) return "UNSCHEDULED";
  const diff = dayNumber(plannedDate) - dayNumber(now);
  if (diff < 0) return "OVERDUE";
  if (diff <= dueSoonDays) return "DUE_SOON";
  return "ON_TRACK";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/tna/schedule.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(tna): pure back-schedule + RAG date math"
```

---

## Task 3: Default template data + seed/list (TDD)

**Files:**
- Test: `src/lib/tna/templates.test.ts`
- Create: `src/lib/tna/templates.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/tna/templates.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { DEFAULT_TEMPLATES, seedTemplates, listTemplates } from "./templates";

const admin = { id: "admin-1", role: "ADMIN" as const };

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("templates", () => {
  it("has unique keys and ascending positions", () => {
    const keys = DEFAULT_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const positions = DEFAULT_TEMPLATES.map((t) => t.position);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("seeds idempotently", async () => {
    await seedTemplates();
    await seedTemplates();
    expect(await prisma.taMilestoneTemplate.count()).toBe(DEFAULT_TEMPLATES.length);
  });

  it("lists active templates in order", async () => {
    await seedTemplates();
    const list = await listTemplates(admin);
    expect(list[0].key).toBe(DEFAULT_TEMPLATES[0].key);
    expect(list).toHaveLength(DEFAULT_TEMPLATES.length);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/tna/templates.test.ts` → FAIL.

- [ ] **Step 3: Implement** (offsets mirror spec §10; negative = days before ex-factory; `null` = scheduled manually)

`src/lib/tna/templates.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import type { TaStage } from "@prisma/client";

export type TemplateDef = {
  key: string;
  name: string;
  stage: TaStage;
  offsetDays: number | null;
  position: number;
};

export const DEFAULT_TEMPLATES: TemplateDef[] = [
  { key: "COSTING_PI", name: "Costing / PI approved", stage: "PRE_PRODUCTION", offsetDays: -75, position: 0 },
  { key: "FABRIC_BOOKED", name: "Yarn / fabric booked", stage: "PRE_PRODUCTION", offsetDays: -60, position: 1 },
  { key: "TRIMS_BOOKED", name: "Trims & accessories booked", stage: "PRE_PRODUCTION", offsetDays: -55, position: 2 },
  { key: "LAB_DIP", name: "Lab dip approved", stage: "SAMPLING", offsetDays: -55, position: 3 },
  { key: "FIT_SAMPLE", name: "Fit sample approved", stage: "SAMPLING", offsetDays: -50, position: 4 },
  { key: "PP_SAMPLE", name: "PP sample approved", stage: "SAMPLING", offsetDays: -45, position: 5 },
  { key: "FABRIC_IN", name: "Bulk fabric in-house", stage: "PRODUCTION_QC", offsetDays: -30, position: 6 },
  { key: "CUTTING", name: "Cutting started", stage: "PRODUCTION_QC", offsetDays: -25, position: 7 },
  { key: "SEWING", name: "Sewing in progress", stage: "PRODUCTION_QC", offsetDays: -20, position: 8 },
  { key: "INLINE_INSP", name: "Inline inspection", stage: "PRODUCTION_QC", offsetDays: -12, position: 9 },
  { key: "FINAL_AQL", name: "Final AQL inspection", stage: "PRODUCTION_QC", offsetDays: -5, position: 10 },
  { key: "EX_FACTORY", name: "Ex-factory", stage: "SHIPPING", offsetDays: 0, position: 11 },
  { key: "BL_TELEX", name: "BL / Telex released", stage: "SHIPPING", offsetDays: 7, position: 12 },
  { key: "TC_SENT", name: "TC / test cert sent", stage: "SHIPPING", offsetDays: 10, position: 13 },
  { key: "PAYMENT", name: "Payment realised", stage: "SHIPPING", offsetDays: null, position: 14 },
];

export async function seedTemplates(): Promise<void> {
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.taMilestoneTemplate.upsert({
      where: { key: t.key },
      update: {},
      create: t,
    });
  }
}

export async function listTemplates(actor: SessionUser) {
  assertPermission(actor, "criticalPath", "view");
  return prisma.taMilestoneTemplate.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/tna/templates.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(tna): default milestone templates + idempotent seed/list"
```

---

## Task 4: Instantiate + milestone actions (TDD)

**Files:**
- Test: `src/lib/tna/milestones.test.ts`
- Create: `src/lib/tna/milestones.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/tna/milestones.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { seedTemplates, DEFAULT_TEMPLATES } from "./templates";
import {
  instantiateMilestones,
  completeMilestone,
  rescheduleMilestone,
  listPoMilestones,
} from "./milestones";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function seedPo(exFty: Date | null) {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return createPurchaseOrder(admin, {
    poNumber: "209531",
    buyerId: buyer.id,
    brandId: brand.id,
    factoryId: factory.id,
    exFactoryDate: exFty ?? undefined,
  });
}

beforeEach(async () => {
  await resetDb();
  await seedTemplates();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("instantiateMilestones", () => {
  it("creates one milestone per template, back-scheduled from ex-factory", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    const ms = await prisma.taMilestone.findMany({ where: { poId: po.id }, orderBy: { position: "asc" } });
    expect(ms).toHaveLength(DEFAULT_TEMPLATES.length);
    const pp = ms.find((m) => m.key === "PP_SAMPLE");
    expect(pp?.plannedDate?.toISOString()).toBe("2026-05-16T00:00:00.000Z"); // -45d
    const payment = ms.find((m) => m.key === "PAYMENT");
    expect(payment?.plannedDate).toBeNull(); // null offset
  });

  it("leaves planned dates null when the PO has no ex-factory date", async () => {
    const po = await seedPo(null);
    await instantiateMilestones(po.id);
    const ms = await prisma.taMilestone.findMany({ where: { poId: po.id } });
    expect(ms).toHaveLength(DEFAULT_TEMPLATES.length);
    expect(ms.every((m) => m.plannedDate === null)).toBe(true);
  });

  it("is idempotent (no duplicate milestones on re-run)", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    await instantiateMilestones(po.id);
    expect(await prisma.taMilestone.count({ where: { poId: po.id } })).toBe(DEFAULT_TEMPLATES.length);
  });
});

describe("completeMilestone / reschedule / list", () => {
  it("completes a milestone (sets actual date) and audits before/after", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    const m = await prisma.taMilestone.findFirstOrThrow({ where: { poId: po.id, key: "LAB_DIP" } });
    const done = await completeMilestone(admin, m.id, d("2026-05-10"));
    expect(done.actualDate?.toISOString()).toBe("2026-05-10T00:00:00.000Z");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: m.id, action: "edit" } });
    expect(audit.after).not.toBeNull();
  });

  it("reschedules a planned date", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    const m = await prisma.taMilestone.findFirstOrThrow({ where: { poId: po.id, key: "CUTTING" } });
    const moved = await rescheduleMilestone(admin, m.id, d("2026-06-10"));
    expect(moved.plannedDate?.toISOString()).toBe("2026-06-10T00:00:00.000Z");
  });

  it("lists milestones with computed RAG and forbids no-access roles from editing", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    const list = await listPoMilestones(admin, po.id, d("2026-06-15"));
    expect(list).toHaveLength(DEFAULT_TEMPLATES.length);
    expect(list.every((m) => typeof m.rag === "string")).toBe(true);
    const ex = list.find((m) => m.key === "EX_FACTORY");
    expect(ex?.rag).toBe("ON_TRACK"); // ex-fty 30 Jun, now 15 Jun -> >7d away

    const m = list[0];
    await expect(completeMilestone(mgmt, m.id, d("2026-06-15"))).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/tna/milestones.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/tna/milestones.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { computeRag, plannedDateFor, type Rag } from "./schedule";

/** Create milestones for a PO from active templates (idempotent). Safe to call inside
 *  or outside a transaction; it no-ops if the PO already has milestones. */
export async function instantiateMilestones(poId: string): Promise<void> {
  const existing = await prisma.taMilestone.count({ where: { poId } });
  if (existing > 0) return;
  const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  const templates = await prisma.taMilestoneTemplate.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
  });
  if (templates.length === 0) return;
  await prisma.taMilestone.createMany({
    data: templates.map((t) => ({
      poId,
      key: t.key,
      name: t.name,
      stage: t.stage,
      position: t.position,
      plannedDate: plannedDateFor(po.exFactoryDate, t.offsetDays),
    })),
    skipDuplicates: true,
  });
}

export async function completeMilestone(actor: SessionUser, id: string, actualDate: Date) {
  assertPermission(actor, "criticalPath", "edit");
  const before = await prisma.taMilestone.findUniqueOrThrow({ where: { id } });
  const updated = await prisma.taMilestone.update({ where: { id }, data: { actualDate } });
  await recordAudit({
    userId: actor.id,
    entityType: "TaMilestone",
    entityId: id,
    action: "edit",
    before: { actualDate: before.actualDate?.toISOString() ?? null },
    after: { actualDate: actualDate.toISOString() },
  });
  return updated;
}

export async function rescheduleMilestone(actor: SessionUser, id: string, plannedDate: Date) {
  assertPermission(actor, "criticalPath", "edit");
  const before = await prisma.taMilestone.findUniqueOrThrow({ where: { id } });
  const updated = await prisma.taMilestone.update({ where: { id }, data: { plannedDate } });
  await recordAudit({
    userId: actor.id,
    entityType: "TaMilestone",
    entityId: id,
    action: "edit",
    before: { plannedDate: before.plannedDate?.toISOString() ?? null },
    after: { plannedDate: plannedDate.toISOString() },
  });
  return updated;
}

export type MilestoneView = {
  id: string;
  key: string;
  name: string;
  stage: string;
  position: number;
  plannedDate: Date | null;
  actualDate: Date | null;
  rag: Rag;
};

export async function listPoMilestones(
  actor: SessionUser,
  poId: string,
  now: Date,
): Promise<MilestoneView[]> {
  assertPermission(actor, "criticalPath", "view");
  const ms = await prisma.taMilestone.findMany({ where: { poId }, orderBy: { position: "asc" } });
  return ms.map((m) => ({
    id: m.id,
    key: m.key,
    name: m.name,
    stage: m.stage,
    position: m.position,
    plannedDate: m.plannedDate,
    actualDate: m.actualDate,
    rag: computeRag(m.plannedDate, m.actualDate, now),
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/tna/milestones.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(tna): instantiate + complete/reschedule/list milestones with RAG"
```

---

## Task 5: Critical-path board query (TDD)

**Files:**
- Test: `src/lib/tna/board.test.ts`
- Create: `src/lib/tna/board.ts`

The board surfaces incomplete milestones that are **overdue or due-soon** across all
non-closed orders — the "what needs attention this week" view.

- [ ] **Step 1: Write the failing test**

`src/lib/tna/board.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { seedTemplates } from "./templates";
import { instantiateMilestones } from "./milestones";
import { criticalPathBoard } from "./board";

const admin = { id: "admin-1", role: "ADMIN" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

beforeEach(async () => {
  await resetDb();
  await seedTemplates();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("criticalPathBoard", () => {
  it("returns only overdue/due-soon incomplete milestones, with PO context, sorted by planned date", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
    // ex-factory 20 Jun -> with "now" = 15 Jun, near-term milestones are overdue/due-soon.
    const po = await createPurchaseOrder(admin, {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
      exFactoryDate: d("2026-06-20"),
    });
    await instantiateMilestones(po.id);

    const now = d("2026-06-15");
    const board = await criticalPathBoard(admin, { now, withinDays: 7 });
    expect(board.length).toBeGreaterThan(0);
    // every returned item is overdue or due-soon and not done
    expect(board.every((b) => b.actualDate === null)).toBe(true);
    expect(board.every((b) => b.rag === "OVERDUE" || b.rag === "DUE_SOON")).toBe(true);
    // PO context present
    expect(board[0].poNumber).toBe("209531");
    expect(board[0].factory).toBe("Liz");
    // sorted ascending by planned date
    const dates = board.map((b) => b.plannedDate?.getTime() ?? 0);
    expect([...dates].sort((a, z) => a - z)).toEqual(dates);
  });

  it("excludes completed milestones and closed orders", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
    const po = await createPurchaseOrder(admin, {
      poNumber: "209531",
      buyerId: buyer.id,
      brandId: brand.id,
      factoryId: factory.id,
      exFactoryDate: d("2026-06-20"),
    });
    await instantiateMilestones(po.id);
    await prisma.taMilestone.updateMany({ where: { poId: po.id }, data: { actualDate: d("2026-06-01") } });
    const board = await criticalPathBoard(admin, { now: d("2026-06-15"), withinDays: 7 });
    expect(board).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/tna/board.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/tna/board.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { addDaysUtc, computeRag, type Rag } from "./schedule";

const OPEN_PO = { status: { notIn: ["CLOSED", "CANCELLED"] as const } };

export type BoardItem = {
  id: string;
  poId: string;
  poNumber: string;
  buyer: string;
  factory: string;
  name: string;
  stage: string;
  plannedDate: Date | null;
  actualDate: Date | null;
  rag: Rag;
};

export async function criticalPathBoard(
  actor: SessionUser,
  opts: { now: Date; withinDays?: number },
): Promise<BoardItem[]> {
  assertPermission(actor, "criticalPath", "view");
  const withinDays = opts.withinDays ?? 7;
  // Candidate window: planned <= now + withinDays (overdue + due-soon), not yet done.
  const horizon = addDaysUtc(opts.now, withinDays);
  const rows = await prisma.taMilestone.findMany({
    where: {
      actualDate: null,
      plannedDate: { not: null, lte: horizon },
      po: OPEN_PO,
    },
    include: { po: { include: { buyer: true, factory: true } } },
    orderBy: { plannedDate: "asc" },
  });
  return rows.map((m) => ({
    id: m.id,
    poId: m.poId,
    poNumber: m.po.poNumber,
    buyer: m.po.buyer.name,
    factory: m.po.factory.name,
    name: m.name,
    stage: m.stage,
    plannedDate: m.plannedDate,
    actualDate: m.actualDate,
    rag: computeRag(m.plannedDate, m.actualDate, opts.now, withinDays),
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/tna/board.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(tna): critical-path board (overdue/due-soon across open orders)"
```

---

## Task 6: Hook instantiation into confirm (TDD)

**Files:**
- Modify: `src/lib/orders/confirm.ts`
- Test: `src/lib/orders/confirm-tna.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/orders/confirm-tna.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "@/lib/orders/po";
import { setOrderLine } from "@/lib/orders/lines";
import { confirmPurchaseOrder } from "@/lib/orders/confirm";
import { seedTemplates, DEFAULT_TEMPLATES } from "@/lib/tna/templates";

const admin = { id: "admin-1", role: "ADMIN" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

beforeEach(async () => {
  await resetDb();
  await seedTemplates();
});
afterAll(async () => {
  await prisma.$disconnect();
});

it("instantiates T&A milestones when a PO is confirmed", async () => {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const style = await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "Tee" });
  const po = await createPurchaseOrder(admin, {
    poNumber: "209531",
    buyerId: buyer.id,
    brandId: brand.id,
    factoryId: factory.id,
    exFactoryDate: d("2026-06-30"),
  });
  await setOrderLine(admin, po.id, {
    styleId: style.id,
    sizes: [{ label: "M", qty: 100, netFob: 1.5, sellFob: 2.0 }],
  });
  expect(await prisma.taMilestone.count({ where: { poId: po.id } })).toBe(0);
  await confirmPurchaseOrder(admin, po.id);
  expect(await prisma.taMilestone.count({ where: { poId: po.id } })).toBe(DEFAULT_TEMPLATES.length);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/orders/confirm-tna.test.ts` → FAIL (no milestones created).

- [ ] **Step 3: Implement** — in `src/lib/orders/confirm.ts`, add the import and call after the audit, before the final return:

Add import at top:

```ts
import { instantiateMilestones } from "@/lib/tna/milestones";
```

Replace the final `return prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });` with:

```ts
  // Spec §9②: create the Critical Path milestones on confirm.
  await instantiateMilestones(poId);

  return prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/orders/confirm-tna.test.ts` → PASS.

Also re-run the existing confirm tests to ensure no regression:
Run: `npm test -- src/lib/orders/confirm.test.ts` → PASS (templates not seeded there; instantiate no-ops on empty templates, so confirm still succeeds).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(tna): instantiate milestones on PO confirm (spec §9②)"
```

---

## Task 7: Seed templates into dev/test + full verification

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Seed templates in the seed script.** In `prisma/seed.ts`, import and call `seedTemplates`:

Add import:

```ts
import { seedTemplates } from "../src/lib/tna/templates";
```

> Note: `seedTemplates` imports `@/lib/db`. If `tsx` cannot resolve the `@/` alias in the
> seed context, instead inline the template upserts in `seed.ts` using the local
> `prisma` client and `DEFAULT_TEMPLATES` imported via a relative path
> (`../src/lib/tna/templates`). Verify `npm run db:seed` runs before relying on it.

At the end of `main()`:

```ts
  await seedTemplates();
  console.log("Seeded T&A milestone templates");
```

- [ ] **Step 2: Seed dev DB**

Run: `npm run db:seed` → confirms templates seeded.

- [ ] **Step 3: Full verification**

```bash
npx tsc --noEmit
npm test
```

Expected: all prior tests + schedule + templates + milestones + board + confirm-tna green.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore(tna): seed default milestone templates" --allow-empty
```

---

## Self-Review (completed by plan author)

**Spec coverage (Phase 2a, spec §4 module / §9② / §10):**
- Milestone template (editable, default set §10) → Task 3 ✔
- Instantiate on confirm, back-scheduled from ex-factory → Tasks 4, 6 ✔
- RAG / overdue computed → Task 2 (pure), surfaced in Tasks 4–5 ✔
- Complete + reschedule milestones, audited → Task 4 ✔
- Critical-path board (overdue / due-soon) → Task 5 ✔
- RBAC `criticalPath` + audit → all actions ✔

**Placeholder scan:** none.

**Type consistency:** `Rag` defined in schedule.ts and reused in milestones.ts/board.ts; `TemplateDef`/`DEFAULT_TEMPLATES` in templates.ts; `TaStage` from Prisma; `instantiateMilestones(poId)` signature matches the confirm call site.

**Deferred:** sampling + production/QC records (2b), T&A board + per-order timeline UI (2c), scheduled daily alert job + notifications (Phase 5), template-editing UI.
