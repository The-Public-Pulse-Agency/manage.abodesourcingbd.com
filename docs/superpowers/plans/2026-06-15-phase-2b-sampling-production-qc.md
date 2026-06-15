# Phase 2b — Sampling + Production/QC Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Complete the Phase 2 data layer — sample requests (lab dip / fit / PP / size-set) with an approval lifecycle, per-PO production progress (cut/sew/finish vs ordered qty), and QC inspections (inline / final AQL) — all audited, RBAC-guarded, tested.

**Architecture:** Same pattern as prior phases (Zod → guarded server actions → audit). Records hang off `PurchaseOrder`. Production progress percentages are a pure function over ordered qty (reuses Phase 1a order totals). Sampling uses the `sampling` permission; production + QC use `productionQc` (spec §7).

**Tech Stack:** Existing. No new deps.

**Scope:** `SampleRequest`, `ProductionRecord`, `Inspection` models + actions + tests. **Out of scope (later):** auto-completing T&A milestones from sample/QC events (documented future enhancement), sampling/production/QC UI (folded into Phase 2c), shipment (Phase 3).

**Prerequisites:** Phase 2a merged. Neon reachable. Branch `phase-2b-sampling-qc`.

**Conventions:** identical to prior phases.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` (modify) | `SampleType`/`SampleStatus`/`InspectionType`/`InspectionResult` enums; `SampleRequest`, `ProductionRecord`, `Inspection`; PO back-relations |
| `src/test/db.ts` (modify) | Add the 3 tables to TRUNCATE |
| `src/lib/production/progress.ts` (+test) | Pure cut/sew/finish → percent vs ordered qty |
| `src/lib/sampling/sampling.ts` (+test) | create / update-status / list sample requests |
| `src/lib/production/production.ts` (+test) | upsert / get production record (with progress + ordered qty) |
| `src/lib/qc/qc.ts` (+test) | add / list inspections |

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/test/db.ts`

- [ ] **Step 1: Append to `prisma/schema.prisma`**

```prisma
enum SampleType {
  LAB_DIP
  FIT
  PP
  SIZE_SET
}

enum SampleStatus {
  PENDING
  SUBMITTED
  APPROVED
  REJECTED
}

enum InspectionType {
  INLINE
  FINAL
}

enum InspectionResult {
  PASS
  FAIL
}

model SampleRequest {
  id           String        @id @default(cuid())
  poId         String
  po           PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  type         SampleType
  status       SampleStatus  @default(PENDING)
  sentDate     DateTime?
  approvedDate DateTime?
  remarks      String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([poId])
}

model ProductionRecord {
  id         String        @id @default(cuid())
  poId       String        @unique
  po         PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  cutQty     Int           @default(0)
  sewQty     Int           @default(0)
  finishQty  Int           @default(0)
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
}

model Inspection {
  id        String           @id @default(cuid())
  poId      String
  po        PurchaseOrder    @relation(fields: [poId], references: [id], onDelete: Cascade)
  type      InspectionType
  result    InspectionResult
  date      DateTime
  aql       String?
  remarks   String?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@index([poId])
}
```

- [ ] **Step 2: PO back-relations.** In `model PurchaseOrder`, after `milestones TaMilestone[]` add:

```prisma
  sampleRequests SampleRequest[]
  production     ProductionRecord?
  inspections    Inspection[]
```

- [ ] **Step 3: Update `src/test/db.ts` TRUNCATE list** — add the three tables near the front (before PurchaseOrder):

```ts
    `TRUNCATE TABLE "${s}"."AuditLog", "${s}"."Inspection", "${s}"."ProductionRecord", "${s}"."SampleRequest", "${s}"."TaMilestone", "${s}"."TaMilestoneTemplate", "${s}"."OrderLineSize", "${s}"."OrderLine", "${s}"."PurchaseOrder", "${s}"."Lot", "${s}"."Style", "${s}"."Size", "${s}"."SizeScale", "${s}"."Colour", "${s}"."Brand", "${s}"."Buyer", "${s}"."Factory", "${s}"."User" RESTART IDENTITY CASCADE`,
```

- [ ] **Step 4: Migrate dev + test**

Run: `npx prisma migrate dev --name sampling_production_qc`
Run: `npx dotenv -e .env.test -- prisma migrate deploy`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(2b): SampleRequest/ProductionRecord/Inspection models + migration"
```

---

## Task 2: Production progress math (pure, TDD)

**Files:**
- Test: `src/lib/production/progress.test.ts`
- Create: `src/lib/production/progress.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/production/progress.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { productionProgress } from "./progress";

describe("productionProgress", () => {
  it("computes percent of ordered qty for each stage", () => {
    const p = productionProgress(1000, { cutQty: 500, sewQty: 250, finishQty: 100 });
    expect(p).toEqual({ cutPct: 50, sewPct: 25, finishPct: 10 });
  });

  it("rounds to a whole percent", () => {
    const p = productionProgress(300, { cutQty: 100, sewQty: 0, finishQty: 0 });
    expect(p.cutPct).toBe(33);
  });

  it("returns zeros when ordered qty is zero (no divide-by-zero)", () => {
    expect(productionProgress(0, { cutQty: 0, sewQty: 0, finishQty: 0 })).toEqual({
      cutPct: 0,
      sewPct: 0,
      finishPct: 0,
    });
  });

  it("caps each stage at 100 percent (over-production clamps)", () => {
    const p = productionProgress(100, { cutQty: 150, sewQty: 120, finishQty: 100 });
    expect(p).toEqual({ cutPct: 100, sewPct: 100, finishPct: 100 });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- src/lib/production/progress.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/production/progress.ts`:

```ts
export type ProductionQty = { cutQty: number; sewQty: number; finishQty: number };
export type ProductionPct = { cutPct: number; sewPct: number; finishPct: number };

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export function productionProgress(orderedQty: number, q: ProductionQty): ProductionPct {
  return {
    cutPct: pct(q.cutQty, orderedQty),
    sewPct: pct(q.sewQty, orderedQty),
    finishPct: pct(q.finishQty, orderedQty),
  };
}
```

- [ ] **Step 4: Run to verify it passes** — PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(2b): pure production progress percentages"
```

---

## Task 3: Sampling actions (TDD)

**Files:**
- Test: `src/lib/sampling/sampling.test.ts`
- Create: `src/lib/sampling/sampling.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/sampling/sampling.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createSampleRequest, updateSampleStatus, listSampleRequests } from "./sampling";

const admin = { id: "admin-1", role: "ADMIN" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function seedPo() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return createPurchaseOrder(admin, {
    poNumber: "209531",
    buyerId: buyer.id,
    brandId: brand.id,
    factoryId: factory.id,
  });
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("sampling", () => {
  it("creates a PENDING sample request and audits it", async () => {
    const po = await seedPo();
    const s = await createSampleRequest(admin, po.id, { type: "PP", remarks: "rush" });
    expect(s.status).toBe("PENDING");
    expect(s.type).toBe("PP");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: s.id, action: "create" } });
    expect(audit).toBeTruthy();
  });

  it("updates status to APPROVED with an approval date", async () => {
    const po = await seedPo();
    const s = await createSampleRequest(admin, po.id, { type: "LAB_DIP" });
    const upd = await updateSampleStatus(admin, s.id, { status: "APPROVED", approvedDate: d("2026-05-10") });
    expect(upd.status).toBe("APPROVED");
    expect(upd.approvedDate?.toISOString()).toBe("2026-05-10T00:00:00.000Z");
  });

  it("lists sample requests for a PO", async () => {
    const po = await seedPo();
    await createSampleRequest(admin, po.id, { type: "FIT" });
    await createSampleRequest(admin, po.id, { type: "SIZE_SET" });
    expect(await listSampleRequests(admin, po.id)).toHaveLength(2);
  });

  it("forbids Accounts from sampling (no sampling permission)", async () => {
    const po = await seedPo();
    await expect(createSampleRequest(accounts, po.id, { type: "PP" })).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

`src/lib/sampling/sampling.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const sampleTypes = ["LAB_DIP", "FIT", "PP", "SIZE_SET"] as const;
const sampleStatuses = ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"] as const;

export const createSampleSchema = z.object({
  type: z.enum(sampleTypes),
  sentDate: z.coerce.date().optional(),
  remarks: z.string().optional(),
});
export type CreateSampleInput = z.input<typeof createSampleSchema>;

export const updateSampleSchema = z.object({
  status: z.enum(sampleStatuses),
  approvedDate: z.coerce.date().optional(),
  remarks: z.string().optional(),
});
export type UpdateSampleInput = z.input<typeof updateSampleSchema>;

export async function createSampleRequest(actor: SessionUser, poId: string, input: CreateSampleInput) {
  assertPermission(actor, "sampling", "create");
  const data = createSampleSchema.parse(input);
  const sample = await prisma.sampleRequest.create({ data: { poId, ...data } });
  await recordAudit({
    userId: actor.id,
    entityType: "SampleRequest",
    entityId: sample.id,
    action: "create",
    after: { poId, type: sample.type, status: sample.status },
  });
  return sample;
}

export async function updateSampleStatus(actor: SessionUser, id: string, input: UpdateSampleInput) {
  assertPermission(actor, "sampling", "edit");
  const data = updateSampleSchema.parse(input);
  const before = await prisma.sampleRequest.findUniqueOrThrow({ where: { id } });
  const sample = await prisma.sampleRequest.update({ where: { id }, data });
  await recordAudit({
    userId: actor.id,
    entityType: "SampleRequest",
    entityId: id,
    action: "edit",
    before: { status: before.status },
    after: { status: sample.status },
  });
  return sample;
}

export async function listSampleRequests(actor: SessionUser, poId: string) {
  assertPermission(actor, "sampling", "view");
  return prisma.sampleRequest.findMany({ where: { poId }, orderBy: { createdAt: "asc" } });
}
```

- [ ] **Step 4: Run to verify it passes** — PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(2b): sample request lifecycle (create/update-status/list)"
```

---

## Task 4: Production actions (TDD)

**Files:**
- Test: `src/lib/production/production.test.ts`
- Create: `src/lib/production/production.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/production/production.test.ts`:

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
import { upsertProduction, getProduction } from "./production";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };

async function seedPoWithQty(orderedQty: number) {
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
  await setOrderLine(admin, po.id, {
    styleId: style.id,
    sizes: [{ label: "M", qty: orderedQty, netFob: 1, sellFob: 2 }],
  });
  return po;
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("production", () => {
  it("upserts a production record and returns progress vs ordered qty", async () => {
    const po = await seedPoWithQty(1000);
    await upsertProduction(admin, po.id, { cutQty: 500, sewQty: 250, finishQty: 100 });
    const got = await getProduction(admin, po.id);
    expect(got?.orderedQty).toBe(1000);
    expect(got?.progress).toEqual({ cutPct: 50, sewPct: 25, finishPct: 10 });
  });

  it("is idempotent (second upsert updates the same row)", async () => {
    const po = await seedPoWithQty(1000);
    await upsertProduction(admin, po.id, { cutQty: 100, sewQty: 0, finishQty: 0 });
    await upsertProduction(admin, po.id, { cutQty: 900, sewQty: 800, finishQty: 700 });
    expect(await prisma.productionRecord.count({ where: { poId: po.id } })).toBe(1);
    const got = await getProduction(admin, po.id);
    expect(got?.cutQty).toBe(900);
  });

  it("forbids a view-only role from upserting", async () => {
    const po = await seedPoWithQty(10);
    await expect(upsertProduction(mgmt, po.id, { cutQty: 1, sewQty: 0, finishQty: 0 })).rejects.toThrow(
      ForbiddenError,
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

`src/lib/production/production.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { lineMills } from "@/lib/orders/money";
import { productionProgress } from "./progress";

export const productionSchema = z.object({
  cutQty: z.number().int().nonnegative(),
  sewQty: z.number().int().nonnegative(),
  finishQty: z.number().int().nonnegative(),
});
export type ProductionInput = z.input<typeof productionSchema>;

async function orderedQtyFor(poId: string): Promise<number> {
  const lines = await prisma.orderLine.findMany({ where: { poId }, include: { sizes: true } });
  return lines.reduce((sum, l) => sum + lineMills(l.sizes).qty, 0);
}

export async function upsertProduction(actor: SessionUser, poId: string, input: ProductionInput) {
  assertPermission(actor, "productionQc", "edit");
  const data = productionSchema.parse(input);
  const record = await prisma.productionRecord.upsert({
    where: { poId },
    update: data,
    create: { poId, ...data },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "ProductionRecord",
    entityId: record.id,
    action: "edit",
    after: data,
  });
  return record;
}

export async function getProduction(actor: SessionUser, poId: string) {
  assertPermission(actor, "productionQc", "view");
  const record = await prisma.productionRecord.findUnique({ where: { poId } });
  const orderedQty = await orderedQtyFor(poId);
  const q = {
    cutQty: record?.cutQty ?? 0,
    sewQty: record?.sewQty ?? 0,
    finishQty: record?.finishQty ?? 0,
  };
  return { ...q, orderedQty, progress: productionProgress(orderedQty, q) };
}
```

- [ ] **Step 4: Run to verify it passes** — PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(2b): production record upsert + progress vs ordered qty"
```

---

## Task 5: QC inspections (TDD)

**Files:**
- Test: `src/lib/qc/qc.test.ts`
- Create: `src/lib/qc/qc.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/qc/qc.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { addInspection, listInspections } from "./qc";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function seedPo() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return createPurchaseOrder(admin, {
    poNumber: "209531",
    buyerId: buyer.id,
    brandId: brand.id,
    factoryId: factory.id,
  });
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("qc inspections", () => {
  it("records a final AQL inspection result and audits it", async () => {
    const po = await seedPo();
    const insp = await addInspection(admin, po.id, {
      type: "FINAL",
      result: "PASS",
      date: d("2026-06-25"),
      aql: "2.5",
    });
    expect(insp.type).toBe("FINAL");
    expect(insp.result).toBe("PASS");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: insp.id, action: "create" } });
    expect(audit).toBeTruthy();
  });

  it("lists inspections newest-first", async () => {
    const po = await seedPo();
    await addInspection(admin, po.id, { type: "INLINE", result: "PASS", date: d("2026-06-10") });
    await addInspection(admin, po.id, { type: "FINAL", result: "FAIL", date: d("2026-06-25") });
    const list = await listInspections(admin, po.id);
    expect(list).toHaveLength(2);
    expect(list[0].date.getTime()).toBeGreaterThanOrEqual(list[1].date.getTime());
  });

  it("forbids a view-only role from recording", async () => {
    const po = await seedPo();
    await expect(
      addInspection(mgmt, po.id, { type: "FINAL", result: "PASS", date: d("2026-06-25") }),
    ).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

`src/lib/qc/qc.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const inspectionTypes = ["INLINE", "FINAL"] as const;
const inspectionResults = ["PASS", "FAIL"] as const;

export const addInspectionSchema = z.object({
  type: z.enum(inspectionTypes),
  result: z.enum(inspectionResults),
  date: z.coerce.date(),
  aql: z.string().optional(),
  remarks: z.string().optional(),
});
export type AddInspectionInput = z.input<typeof addInspectionSchema>;

export async function addInspection(actor: SessionUser, poId: string, input: AddInspectionInput) {
  assertPermission(actor, "productionQc", "create");
  const data = addInspectionSchema.parse(input);
  const insp = await prisma.inspection.create({ data: { poId, ...data } });
  await recordAudit({
    userId: actor.id,
    entityType: "Inspection",
    entityId: insp.id,
    action: "create",
    after: { poId, type: insp.type, result: insp.result },
  });
  return insp;
}

export async function listInspections(actor: SessionUser, poId: string) {
  assertPermission(actor, "productionQc", "view");
  return prisma.inspection.findMany({ where: { poId }, orderBy: { date: "desc" } });
}
```

- [ ] **Step 4: Run to verify it passes** — PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(2b): QC inspections (add/list)"
```

---

## Task 6: Full verification

- [ ] **Step 1: Run tsc + suite**

```bash
npx tsc --noEmit
npm test
```

Expected: all prior + progress (4) + sampling (4) + production (3) + qc (3) green.

- [ ] **Step 2: Commit (empty allowed)**

```bash
git add -A && git commit -m "test: full Phase 2b verification" --allow-empty
```

---

## Self-Review (completed by plan author)

**Spec coverage (Phase 2b, spec §4 modules 5–6 / §9):**
- Sampling lab dip/fit/PP/size-set + approval lifecycle → Task 3 ✔
- Production cut/sew/finish vs ordered qty → Tasks 2, 4 ✔
- QC inline + final AQL inspections → Task 5 ✔
- RBAC: `sampling` (Merchandiser full; Accounts none; Management view) and `productionQc` (Admin/Merchandiser full; Accounts/Management view) → all actions ✔
- Audit on every mutation ✔

**Placeholder scan:** none.
**Type consistency:** `ProductionQty`/`ProductionPct` in progress.ts; `lineMills` reused from money.ts for ordered qty; all inputs use `z.input`.
**Deferred:** auto-completing T&A milestones from sample-approved / AQL-pass events (future); all 2b UI → Phase 2c.
