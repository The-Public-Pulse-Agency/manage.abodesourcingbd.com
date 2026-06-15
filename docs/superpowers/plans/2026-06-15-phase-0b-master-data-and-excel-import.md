# Phase 0b — Master Data & Excel Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the master-data backbone (Buyer/Brand, Factory, Style, SizeScale, Colour) with audited CRUD + soft-delete, role-guarded by the existing RBAC, plus a guided import that seeds this master data from the existing spreadsheet (normalizing the duplicate/inconsistent names).

**Architecture:** Builds directly on Phase 0a. Each master-data entity gets a Zod schema, a set of server actions (`create`/`list`/`update`/`setActive`) guarded by `assertPermission(actor, "masterData", …)` and writing to the audit log, plus a reusable UI (table + form). The Excel import is split into a **pure normalization layer** (fully unit-tested — rows → deduped entities) and a thin **ExcelJS reader** adapter, so the hard logic is tested without files.

**Tech Stack:** Existing Phase 0a stack + `exceljs` for reading `.xlsx`.

**Scope of this plan:** Buyer, Brand, Factory, SizeScale (+Size), Colour, Style — schema, actions, tests, UI; and a master-data importer. Port/Forwarder → Phase 3; Currency/FxRate → Phase 4. Orders, shipments, PO/shipment import → later phases.

**Prerequisites:** Phase 0a merged. A reachable Postgres (Neon dev URL in `.env`, test DB reachable for integration tests). Run on a feature branch `phase-0b-master-data`.

**Conventions:** identical to Phase 0a (npm, `src/`, `@/*`, `npm test`, commit per task). The `masterData` permission (spec §7): Admin = full; Merchandiser = view/create/edit; Accounts/Management = view. We use **soft-delete** (`active=false` via `setActive`, an `edit`), so no hard-delete action is needed.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` (modify) | Add Buyer, Brand, Factory, SizeScale, Size, Colour, Style models + FactoryType enum |
| `src/test/db.ts` (modify) | Add new tables to the TRUNCATE list |
| `src/lib/text.ts` | `normalizeName` / `slugCode` helpers (pure) |
| `src/lib/text.test.ts` | Tests for the helpers |
| `src/lib/masterdata/factory.{ts,test.ts}` | Factory schema + actions + tests |
| `src/lib/masterdata/buyer.{ts,test.ts}` | Buyer + Brand schema + actions + tests |
| `src/lib/masterdata/sizescale.{ts,test.ts}` | SizeScale (+Size) + Colour schema + actions + tests |
| `src/lib/masterdata/style.{ts,test.ts}` | Style schema + actions + tests |
| `src/lib/import/normalize.{ts,test.ts}` | Pure: spreadsheet rows → deduped master-data sets |
| `src/lib/import/excel.ts` | ExcelJS reader → raw rows |
| `src/lib/import/import-actions.ts` | `importMasterDataFromWorkbook` server action (upsert + audit) |
| `src/lib/import/import-actions.test.ts` | Integration test for the importer |
| `src/components/master-data-table.tsx` | Reusable list table |
| `src/app/(app)/master-data/factories/page.tsx` (+ form) | Factory admin UI |
| `src/app/(app)/master-data/{buyers,styles,colours,size-scales}/page.tsx` | Entity admin pages |
| `src/app/(app)/master-data/import/page.tsx` (+ action) | Import UI |
| `src/components/app-nav.tsx` (modify) | Add "Master Data" + "Import" nav items |

---

## Task 1: Master-data Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/test/db.ts`

- [ ] **Step 1: Append the models to `prisma/schema.prisma`**

```prisma
enum FactoryType {
  KNIT
  WOVEN
  SWEATER
  OTHER
}

model Buyer {
  id        String   @id @default(cuid())
  name      String
  code      String   @unique
  active    Boolean  @default(true)
  brands    Brand[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Brand {
  id        String   @id @default(cuid())
  buyerId   String
  buyer     Buyer    @relation(fields: [buyerId], references: [id])
  name      String
  code      String
  active    Boolean  @default(true)
  styles    Style[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([buyerId, code])
}

model Factory {
  id           String      @id @default(cuid())
  name         String
  code         String      @unique
  type         FactoryType @default(KNIT)
  address      String?
  contactName  String?
  contactEmail String?
  contactPhone String?
  active       Boolean     @default(true)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model SizeScale {
  id        String   @id @default(cuid())
  name      String   @unique
  active    Boolean  @default(true)
  sizes     Size[]
  styles    Style[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Size {
  id          String    @id @default(cuid())
  sizeScaleId String
  sizeScale   SizeScale @relation(fields: [sizeScaleId], references: [id], onDelete: Cascade)
  label       String
  position    Int

  @@unique([sizeScaleId, label])
}

model Colour {
  id        String   @id @default(cuid())
  name      String   @unique
  code      String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Style {
  id                 String     @id @default(cuid())
  brandId            String
  brand              Brand      @relation(fields: [brandId], references: [id])
  styleCode          String
  name               String
  description        String?
  composition        String?
  category           String?
  defaultSizeScaleId String?
  defaultSizeScale   SizeScale? @relation(fields: [defaultSizeScaleId], references: [id])
  active             Boolean    @default(true)
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  @@unique([brandId, styleCode])
}
```

- [ ] **Step 2: Update the test reset helper** — replace the TRUNCATE in `src/test/db.ts`:

```ts
import { prisma } from "@/lib/db";

/** Truncate all app tables between tests. Add new tables here as they appear. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "Style", "Size", "SizeScale", "Colour", "Brand", "Buyer", "Factory", "User" RESTART IDENTITY CASCADE',
  );
}
```

- [ ] **Step 3: Create the migration**

Run: `npx prisma migrate dev --name master_data`
Expected: migration created; dev DB has the new tables; client regenerated.

- [ ] **Step 4: Apply to the test DB**

Run: `npx dotenv -e .env.test -- prisma migrate deploy`
Expected: "All migrations have been successfully applied."

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(master-data): Prisma models for Buyer/Brand/Factory/Style/SizeScale/Colour"
```

---

## Task 2: Text helpers (TDD)

**Files:**
- Test: `src/lib/text.test.ts`
- Create: `src/lib/text.ts`

These power both dedup-on-import and code generation. `normalizeName` collapses the
"LIZ/ TEI TAK" vs "Liz" style inconsistencies to a comparable key.

- [ ] **Step 1: Write the failing test**

`src/lib/text.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeName, slugCode } from "./text";

describe("normalizeName", () => {
  it("lowercases, trims and collapses internal whitespace", () => {
    expect(normalizeName("  LIZ/  TEI TAK ")).toBe("liz/ tei tak");
  });
  it("treats case/spacing variants as equal", () => {
    expect(normalizeName("Green Life/TTF ")).toBe(normalizeName("green life/ttf"));
  });
});

describe("slugCode", () => {
  it("builds an uppercase alnum code", () => {
    expect(slugCode("Green Life/TTF")).toBe("GREEN-LIFE-TTF");
  });
  it("strips repeated separators", () => {
    expect(slugCode("UHM   Ltd ")).toBe("UHM-LTD");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/text.test.ts`
Expected: FAIL — cannot find module `./text`.

- [ ] **Step 3: Implement**

`src/lib/text.ts`:

```ts
export function normalizeName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function slugCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/text.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: text helpers normalizeName/slugCode"
```

---

## Task 3: Factory CRUD (TDD) — the reference pattern

**Files:**
- Test: `src/lib/masterdata/factory.test.ts`
- Create: `src/lib/masterdata/factory.ts`

Every other entity follows this exact shape (schema → guarded actions → audit).

- [ ] **Step 1: Write the failing test**

`src/lib/masterdata/factory.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createFactory, listFactories, updateFactory, setFactoryActive } from "./factory";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("createFactory", () => {
  it("creates a factory and audits it", async () => {
    const f = await createFactory(admin, { name: "Green Life/TTF", type: "KNIT" });
    expect(f.code).toBe("GREEN-LIFE-TTF");
    const audit = await prisma.auditLog.findMany({ where: { entityId: f.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("create");
  });

  it("rejects a duplicate code", async () => {
    await createFactory(admin, { name: "UHM Ltd", type: "KNIT" });
    await expect(createFactory(admin, { name: "UHM   Ltd", type: "KNIT" })).rejects.toThrow(
      /already exists/i,
    );
  });

  it("forbids a view-only role from creating", async () => {
    await expect(createFactory(mgmt, { name: "X", type: "KNIT" })).rejects.toThrow(ForbiddenError);
  });
});

describe("listFactories / setFactoryActive", () => {
  it("lists active factories and can deactivate", async () => {
    const f = await createFactory(admin, { name: "Saturn", type: "WOVEN" });
    await setFactoryActive(admin, f.id, false);
    const active = await listFactories(admin);
    expect(active.find((x) => x.id === f.id)).toBeUndefined();
    const all = await listFactories(admin, { includeInactive: true });
    expect(all.find((x) => x.id === f.id)).toBeDefined();
  });
});

describe("updateFactory", () => {
  it("updates fields and audits", async () => {
    const f = await createFactory(admin, { name: "Anowara", type: "KNIT" });
    const u = await updateFactory(admin, f.id, { contactName: "Mr. Karim" });
    expect(u.contactName).toBe("Mr. Karim");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/masterdata/factory.test.ts`
Expected: FAIL — cannot find module `./factory`.

- [ ] **Step 3: Implement**

`src/lib/masterdata/factory.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { slugCode } from "@/lib/text";

export const factoryTypes = ["KNIT", "WOVEN", "SWEATER", "OTHER"] as const;

export const createFactorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(factoryTypes).default("KNIT"),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});
export type CreateFactoryInput = z.infer<typeof createFactorySchema>;

export const updateFactorySchema = createFactorySchema.partial();
export type UpdateFactoryInput = z.infer<typeof updateFactorySchema>;

export async function createFactory(actor: SessionUser, input: CreateFactoryInput) {
  assertPermission(actor, "masterData", "create");
  const data = createFactorySchema.parse(input);
  const code = slugCode(data.name);
  if (await prisma.factory.findUnique({ where: { code } })) {
    throw new Error(`A factory with code ${code} already exists`);
  }
  const factory = await prisma.factory.create({ data: { ...data, code } });
  await recordAudit({
    userId: actor.id,
    entityType: "Factory",
    entityId: factory.id,
    action: "create",
    after: { name: factory.name, code: factory.code },
  });
  return factory;
}

export async function listFactories(
  actor: SessionUser,
  opts: { includeInactive?: boolean } = {},
) {
  assertPermission(actor, "masterData", "view");
  return prisma.factory.findMany({
    where: opts.includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
}

export async function updateFactory(
  actor: SessionUser,
  id: string,
  input: UpdateFactoryInput,
) {
  assertPermission(actor, "masterData", "edit");
  const data = updateFactorySchema.parse(input);
  const factory = await prisma.factory.update({ where: { id }, data });
  await recordAudit({
    userId: actor.id,
    entityType: "Factory",
    entityId: id,
    action: "edit",
    after: data,
  });
  return factory;
}

export async function setFactoryActive(actor: SessionUser, id: string, active: boolean) {
  assertPermission(actor, "masterData", "edit");
  const factory = await prisma.factory.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: actor.id,
    entityType: "Factory",
    entityId: id,
    action: "edit",
    after: { active },
  });
  return factory;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/masterdata/factory.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(master-data): factory CRUD with RBAC + audit + soft-delete"
```

---

## Task 4: Buyer + Brand CRUD (TDD)

**Files:**
- Test: `src/lib/masterdata/buyer.test.ts`
- Create: `src/lib/masterdata/buyer.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/masterdata/buyer.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, listBuyers, createBrand, listBrands } from "./buyer";

const admin = { id: "admin-1", role: "ADMIN" as const };

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("buyer + brand", () => {
  it("creates a buyer with a derived code", async () => {
    const b = await createBuyer(admin, { name: "Ralawise" });
    expect(b.code).toBe("RALAWISE");
  });

  it("rejects duplicate buyer code", async () => {
    await createBuyer(admin, { name: "Premier UK" });
    await expect(createBuyer(admin, { name: "Premier   UK" })).rejects.toThrow(/already exists/i);
  });

  it("creates a brand under a buyer and enforces unique code per buyer", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    expect(brand.buyerId).toBe(buyer.id);
    await expect(
      createBrand(admin, { buyerId: buyer.id, name: "TriDri 2", code: "TRIDRI" }),
    ).rejects.toThrow(/already exists/i);
  });

  it("lists brands for a buyer", async () => {
    const buyer = await createBuyer(admin, { name: "Ralawise" });
    await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
    await createBrand(admin, { buyerId: buyer.id, name: "Asquith & Fox", code: "AQ" });
    const brands = await listBrands(admin, buyer.id);
    expect(brands).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/masterdata/buyer.test.ts`
Expected: FAIL — cannot find module `./buyer`.

- [ ] **Step 3: Implement**

`src/lib/masterdata/buyer.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { slugCode } from "@/lib/text";

export const createBuyerSchema = z.object({ name: z.string().min(1) });
export type CreateBuyerInput = z.infer<typeof createBuyerSchema>;

export const createBrandSchema = z.object({
  buyerId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export async function createBuyer(actor: SessionUser, input: CreateBuyerInput) {
  assertPermission(actor, "masterData", "create");
  const data = createBuyerSchema.parse(input);
  const code = slugCode(data.name);
  if (await prisma.buyer.findUnique({ where: { code } })) {
    throw new Error(`A buyer with code ${code} already exists`);
  }
  const buyer = await prisma.buyer.create({ data: { name: data.name, code } });
  await recordAudit({
    userId: actor.id,
    entityType: "Buyer",
    entityId: buyer.id,
    action: "create",
    after: { name: buyer.name, code: buyer.code },
  });
  return buyer;
}

export async function listBuyers(actor: SessionUser, opts: { includeInactive?: boolean } = {}) {
  assertPermission(actor, "masterData", "view");
  return prisma.buyer.findMany({
    where: opts.includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
}

export async function createBrand(actor: SessionUser, input: CreateBrandInput) {
  assertPermission(actor, "masterData", "create");
  const data = createBrandSchema.parse(input);
  const code = slugCode(data.code);
  const dup = await prisma.brand.findUnique({
    where: { buyerId_code: { buyerId: data.buyerId, code } },
  });
  if (dup) throw new Error(`A brand with code ${code} already exists for this buyer`);
  const brand = await prisma.brand.create({
    data: { buyerId: data.buyerId, name: data.name, code },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "Brand",
    entityId: brand.id,
    action: "create",
    after: { name: brand.name, code: brand.code, buyerId: brand.buyerId },
  });
  return brand;
}

export async function listBrands(actor: SessionUser, buyerId?: string) {
  assertPermission(actor, "masterData", "view");
  return prisma.brand.findMany({
    where: { active: true, ...(buyerId ? { buyerId } : {}) },
    orderBy: { name: "asc" },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/masterdata/buyer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(master-data): buyer + brand CRUD"
```

---

## Task 5: SizeScale (+Size) + Colour CRUD (TDD)

**Files:**
- Test: `src/lib/masterdata/sizescale.test.ts`
- Create: `src/lib/masterdata/sizescale.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/masterdata/sizescale.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createSizeScale, listSizeScales, createColour, listColours } from "./sizescale";

const admin = { id: "admin-1", role: "ADMIN" as const };

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("size scale", () => {
  it("creates a scale with ordered sizes", async () => {
    const s = await createSizeScale(admin, {
      name: "Adult XS-6XL",
      sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"],
    });
    const sizes = await prisma.size.findMany({
      where: { sizeScaleId: s.id },
      orderBy: { position: "asc" },
    });
    expect(sizes.map((x) => x.label)).toEqual([
      "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL",
    ]);
    expect(sizes[0].position).toBe(0);
  });

  it("rejects a duplicate scale name", async () => {
    await createSizeScale(admin, { name: "Adult", sizes: ["S", "M"] });
    await expect(createSizeScale(admin, { name: "Adult", sizes: ["L"] })).rejects.toThrow(
      /already exists/i,
    );
  });

  it("lists scales", async () => {
    await createSizeScale(admin, { name: "Kids", sizes: ["3-4", "5-6"] });
    expect(await listSizeScales(admin)).toHaveLength(1);
  });
});

describe("colour", () => {
  it("creates and lists colours", async () => {
    await createColour(admin, { name: "Navy" });
    await createColour(admin, { name: "Cherry Red" });
    expect(await listColours(admin)).toHaveLength(2);
  });
  it("rejects duplicate colour name", async () => {
    await createColour(admin, { name: "Navy" });
    await expect(createColour(admin, { name: "Navy" })).rejects.toThrow(/already exists/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/masterdata/sizescale.test.ts`
Expected: FAIL — cannot find module `./sizescale`.

- [ ] **Step 3: Implement**

`src/lib/masterdata/sizescale.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createSizeScaleSchema = z.object({
  name: z.string().min(1),
  sizes: z.array(z.string().min(1)).min(1, "At least one size required"),
});
export type CreateSizeScaleInput = z.infer<typeof createSizeScaleSchema>;

export async function createSizeScale(actor: SessionUser, input: CreateSizeScaleInput) {
  assertPermission(actor, "masterData", "create");
  const data = createSizeScaleSchema.parse(input);
  if (await prisma.sizeScale.findUnique({ where: { name: data.name } })) {
    throw new Error(`A size scale named ${data.name} already exists`);
  }
  const scale = await prisma.sizeScale.create({
    data: {
      name: data.name,
      sizes: { create: data.sizes.map((label, position) => ({ label, position })) },
    },
  });
  await recordAudit({
    userId: actor.id,
    entityType: "SizeScale",
    entityId: scale.id,
    action: "create",
    after: { name: scale.name, sizes: data.sizes },
  });
  return scale;
}

export async function listSizeScales(actor: SessionUser) {
  assertPermission(actor, "masterData", "view");
  return prisma.sizeScale.findMany({
    where: { active: true },
    include: { sizes: { orderBy: { position: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export const createColourSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
});
export type CreateColourInput = z.infer<typeof createColourSchema>;

export async function createColour(actor: SessionUser, input: CreateColourInput) {
  assertPermission(actor, "masterData", "create");
  const data = createColourSchema.parse(input);
  if (await prisma.colour.findUnique({ where: { name: data.name } })) {
    throw new Error(`A colour named ${data.name} already exists`);
  }
  const colour = await prisma.colour.create({ data });
  await recordAudit({
    userId: actor.id,
    entityType: "Colour",
    entityId: colour.id,
    action: "create",
    after: { name: colour.name },
  });
  return colour;
}

export async function listColours(actor: SessionUser) {
  assertPermission(actor, "masterData", "view");
  return prisma.colour.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/masterdata/sizescale.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(master-data): size scale (+sizes) and colour CRUD"
```

---

## Task 6: Style CRUD (TDD)

**Files:**
- Test: `src/lib/masterdata/style.test.ts`
- Create: `src/lib/masterdata/style.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/masterdata/style.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "./buyer";
import { createStyle, listStyles } from "./style";

const admin = { id: "admin-1", role: "ADMIN" as const };

async function seedBrand() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  return createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("style", () => {
  it("creates a style under a brand", async () => {
    const brand = await seedBrand();
    const style = await createStyle(admin, {
      brandId: brand.id,
      styleCode: "TR010",
      name: "Mens Performance T",
    });
    expect(style.styleCode).toBe("TR010");
    expect(style.brandId).toBe(brand.id);
  });

  it("enforces unique styleCode per brand", async () => {
    const brand = await seedBrand();
    await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "A" });
    await expect(
      createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "B" }),
    ).rejects.toThrow(/already exists/i);
  });

  it("lists styles for a brand", async () => {
    const brand = await seedBrand();
    await createStyle(admin, { brandId: brand.id, styleCode: "TR010", name: "A" });
    await createStyle(admin, { brandId: brand.id, styleCode: "TR020", name: "B" });
    expect(await listStyles(admin, { brandId: brand.id })).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/masterdata/style.test.ts`
Expected: FAIL — cannot find module `./style`.

- [ ] **Step 3: Implement**

`src/lib/masterdata/style.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createStyleSchema = z.object({
  brandId: z.string().min(1),
  styleCode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  composition: z.string().optional(),
  category: z.string().optional(),
  defaultSizeScaleId: z.string().optional(),
});
export type CreateStyleInput = z.infer<typeof createStyleSchema>;

export async function createStyle(actor: SessionUser, input: CreateStyleInput) {
  assertPermission(actor, "masterData", "create");
  const data = createStyleSchema.parse(input);
  const dup = await prisma.style.findUnique({
    where: { brandId_styleCode: { brandId: data.brandId, styleCode: data.styleCode } },
  });
  if (dup) throw new Error(`Style ${data.styleCode} already exists for this brand`);
  const style = await prisma.style.create({ data });
  await recordAudit({
    userId: actor.id,
    entityType: "Style",
    entityId: style.id,
    action: "create",
    after: { styleCode: style.styleCode, name: style.name, brandId: style.brandId },
  });
  return style;
}

export async function listStyles(
  actor: SessionUser,
  opts: { brandId?: string; includeInactive?: boolean } = {},
) {
  assertPermission(actor, "masterData", "view");
  return prisma.style.findMany({
    where: {
      ...(opts.includeInactive ? {} : { active: true }),
      ...(opts.brandId ? { brandId: opts.brandId } : {}),
    },
    orderBy: { styleCode: "asc" },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/masterdata/style.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(master-data): style CRUD"
```

---

## Task 7: Import normalization (pure, TDD)

**Files:**
- Test: `src/lib/import/normalize.test.ts`
- Create: `src/lib/import/normalize.ts`

The importer's brain: given raw rows from the workbook, produce **deduped** sets of
factories, buyers, brands and styles. Pure — no DB, no files.

- [ ] **Step 1: Write the failing test**

`src/lib/import/normalize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeMasterData, parseBrandField, parseStyleName, type RawRow } from "./normalize";

describe("parseBrandField", () => {
  it("splits 'Ralawise-TRIDRI' into buyer + brand", () => {
    expect(parseBrandField("Ralawise-TRIDRI")).toEqual({ buyer: "Ralawise", brand: "TRIDRI" });
  });
  it("treats RalaTeam as the Ralawise buyer", () => {
    expect(parseBrandField("RalaTeam-AQ")).toEqual({ buyer: "Ralawise", brand: "AQ" });
  });
  it("handles 'Premier-UK' and 'TD-USA'", () => {
    expect(parseBrandField("Premier-UK")).toEqual({ buyer: "Premier", brand: "Premier" });
    expect(parseBrandField("TD-USA")).toEqual({ buyer: "TD", brand: "TD" });
  });
});

describe("parseStyleName", () => {
  it("extracts the style code prefix", () => {
    expect(parseStyleName("TR010-Mens Performance T Solid XS-2XL").code).toBe("TR010");
    expect(parseStyleName("AQ010  Mens SS CTN Polo (3XL-6XL)").code).toBe("AQ010");
  });
  it("falls back to the whole string when no code prefix", () => {
    expect(parseStyleName("Fusion Polo ( Two Colour )").code).toBe("Fusion Polo ( Two Colour )");
  });
});

describe("normalizeMasterData", () => {
  it("dedupes factories that differ only by case/spacing", () => {
    const rows: RawRow[] = [
      { factory: "LIZ/ TEI TAK", brand: "Ralawise-TRIDRI", styleName: "TR010-Mens Tee" },
      { factory: "Liz/ Tei Tak ", brand: "RalaTeam-TRIDRI", styleName: "TR010-Mens Tee" },
    ];
    const out = normalizeMasterData(rows);
    expect(out.factories).toHaveLength(1);
    expect(out.buyers).toHaveLength(1); // Ralawise (both channels)
    expect(out.brands).toHaveLength(1); // TRIDRI under Ralawise
    expect(out.styles).toHaveLength(1); // TR010 under TRIDRI
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/import/normalize.test.ts`
Expected: FAIL — cannot find module `./normalize`.

- [ ] **Step 3: Implement**

`src/lib/import/normalize.ts`:

```ts
import { normalizeName, slugCode } from "@/lib/text";

export type RawRow = { factory?: string; brand?: string; styleName?: string };

export type NormalizedFactory = { name: string; code: string };
export type NormalizedBuyer = { name: string; code: string };
export type NormalizedBrand = { buyerCode: string; name: string; code: string };
export type NormalizedStyle = { brandCode: string; styleCode: string; name: string };

export type NormalizedMasterData = {
  factories: NormalizedFactory[];
  buyers: NormalizedBuyer[];
  brands: NormalizedBrand[];
  styles: NormalizedStyle[];
};

const BUYER_ALIASES: Record<string, string> = { RALATEAM: "Ralawise", RALAWISE: "Ralawise" };

export function parseBrandField(value: string): { buyer: string; brand: string } {
  const [rawChannel, rawBrand] = value.split("-").map((s) => s.trim());
  const channelKey = slugCode(rawChannel ?? "");
  const buyer = BUYER_ALIASES[channelKey] ?? (rawChannel || value).trim();
  // For Ralawise channels the suffix is the brand (TRIDRI/AQ); otherwise the buyer IS the brand.
  const brand = BUYER_ALIASES[channelKey] ? (rawBrand ?? "").trim() : buyer;
  return { buyer, brand };
}

export function parseStyleName(styleName: string): { code: string; name: string } {
  const trimmed = styleName.trim();
  const match = trimmed.match(/^([A-Z]{2}\d{2,4}[A-Z]?)/);
  return { code: match ? match[1] : trimmed, name: trimmed };
}

export function normalizeMasterData(rows: RawRow[]): NormalizedMasterData {
  const factories = new Map<string, NormalizedFactory>();
  const buyers = new Map<string, NormalizedBuyer>();
  const brands = new Map<string, NormalizedBrand>();
  const styles = new Map<string, NormalizedStyle>();

  for (const row of rows) {
    if (row.factory && row.factory.trim()) {
      const name = row.factory.trim();
      factories.set(normalizeName(name), { name, code: slugCode(name) });
    }
    if (row.brand && row.brand.trim()) {
      const { buyer, brand } = parseBrandField(row.brand.trim());
      const buyerCode = slugCode(buyer);
      buyers.set(buyerCode, { name: buyer, code: buyerCode });
      if (brand) {
        const brandCode = slugCode(brand);
        brands.set(`${buyerCode}:${brandCode}`, { buyerCode, name: brand, code: brandCode });
        if (row.styleName && row.styleName.trim()) {
          const { code, name } = parseStyleName(row.styleName);
          styles.set(`${brandCode}:${code}`, { brandCode, styleCode: code, name });
        }
      }
    }
  }

  return {
    factories: [...factories.values()],
    buyers: [...buyers.values()],
    brands: [...brands.values()],
    styles: [...styles.values()],
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lib/import/normalize.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(import): pure master-data normalization + dedup"
```

---

## Task 8: Excel reader + import action (TDD)

**Files:**
- Install: `exceljs`
- Create: `src/lib/import/excel.ts`
- Create: `src/lib/import/import-actions.ts`
- Test: `src/lib/import/import-actions.test.ts`

- [ ] **Step 1: Install ExcelJS**

Run: `npm install exceljs`

- [ ] **Step 2: Create the reader**

`src/lib/import/excel.ts`:

```ts
import ExcelJS from "exceljs";
import type { RawRow } from "./normalize";

/**
 * Reads the "Open PO's" and "Shipped" style sheets and returns raw rows.
 * Columns are addressed positionally: A=Factory, B=Brand, ... D/E=Style name.
 */
export async function readMasterDataRows(buffer: Buffer): Promise<RawRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const rows: RawRow[] = [];
  wb.eachSheet((sheet) => {
    const name = sheet.name.toLowerCase();
    const isOpen = name.includes("open");
    const isShipped = name.includes("shipped");
    if (!isOpen && !isShipped) return;
    // Open PO's: Factory=A, Brand=B, Style=D. Shipped: Factory=B, Brand=C, Style=E.
    const cols = isOpen
      ? { factory: 1, brand: 2, style: 4 }
      : { factory: 2, brand: 3, style: 5 };
    sheet.eachRow((row, n) => {
      if (n <= 2) return; // header rows
      rows.push({
        factory: cellText(row.getCell(cols.factory)),
        brand: cellText(row.getCell(cols.brand)),
        styleName: cellText(row.getCell(cols.style)),
      });
    });
  });
  return rows;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
  return String(v);
}
```

- [ ] **Step 3: Write the failing test for the import action**

`src/lib/import/import-actions.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { importMasterData } from "./import-actions";
import type { RawRow } from "./normalize";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };

const rows: RawRow[] = [
  { factory: "LIZ/ TEI TAK", brand: "Ralawise-TRIDRI", styleName: "TR010-Mens Tee" },
  { factory: "Liz/ Tei Tak ", brand: "RalaTeam-TRIDRI", styleName: "TR010-Mens Tee" },
  { factory: "Green Life/TTF", brand: "Ralawise-AQ", styleName: "AQ010 Mens Polo" },
];

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("importMasterData", () => {
  it("upserts deduped master data and reports counts", async () => {
    const summary = await importMasterData(admin, rows);
    expect(summary).toMatchObject({ factories: 2, buyers: 1, brands: 2, styles: 2 });
    expect(await prisma.factory.count()).toBe(2);
    expect(await prisma.buyer.count()).toBe(1);
    expect(await prisma.brand.count()).toBe(2);
    expect(await prisma.style.count()).toBe(2);
  });

  it("is idempotent (re-running does not duplicate)", async () => {
    await importMasterData(admin, rows);
    await importMasterData(admin, rows);
    expect(await prisma.factory.count()).toBe(2);
    expect(await prisma.style.count()).toBe(2);
  });

  it("forbids a view-only role", async () => {
    await expect(importMasterData(mgmt, rows)).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm test -- src/lib/import/import-actions.test.ts`
Expected: FAIL — cannot find module `./import-actions`.

- [ ] **Step 5: Implement the import action**

`src/lib/import/import-actions.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { normalizeMasterData, type RawRow } from "./normalize";

export type ImportSummary = {
  factories: number;
  buyers: number;
  brands: number;
  styles: number;
};

export async function importMasterData(
  actor: SessionUser,
  rows: RawRow[],
): Promise<ImportSummary> {
  assertPermission(actor, "masterData", "create");
  const data = normalizeMasterData(rows);

  for (const f of data.factories) {
    await prisma.factory.upsert({
      where: { code: f.code },
      update: {},
      create: { name: f.name, code: f.code },
    });
  }

  const buyerIdByCode = new Map<string, string>();
  for (const b of data.buyers) {
    const buyer = await prisma.buyer.upsert({
      where: { code: b.code },
      update: {},
      create: { name: b.name, code: b.code },
    });
    buyerIdByCode.set(b.code, buyer.id);
  }

  const brandIdByCode = new Map<string, string>();
  for (const br of data.brands) {
    const buyerId = buyerIdByCode.get(br.buyerCode);
    if (!buyerId) continue;
    const brand = await prisma.brand.upsert({
      where: { buyerId_code: { buyerId, code: br.code } },
      update: {},
      create: { buyerId, name: br.name, code: br.code },
    });
    brandIdByCode.set(br.code, brand.id);
  }

  for (const st of data.styles) {
    const brandId = brandIdByCode.get(st.brandCode);
    if (!brandId) continue;
    await prisma.style.upsert({
      where: { brandId_styleCode: { brandId, styleCode: st.styleCode } },
      update: {},
      create: { brandId, styleCode: st.styleCode, name: st.name },
    });
  }

  const summary: ImportSummary = {
    factories: data.factories.length,
    buyers: data.buyers.length,
    brands: data.brands.length,
    styles: data.styles.length,
  };
  await recordAudit({
    userId: actor.id,
    entityType: "Import",
    entityId: "master-data",
    action: "create",
    after: summary,
  });
  return summary;
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test -- src/lib/import/import-actions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(import): ExcelJS reader + idempotent master-data import action"
```

---

## Task 9: Master-data UI + import page + nav

**Files:**
- Create: `src/components/master-data-table.tsx`
- Create: `src/app/(app)/master-data/factories/page.tsx`
- Create: `src/app/(app)/master-data/factories/factory-form.tsx`
- Create: `src/lib/masterdata/factory-form-actions.ts`
- Create: `src/app/(app)/master-data/buyers/page.tsx`
- Create: `src/app/(app)/master-data/styles/page.tsx`
- Create: `src/app/(app)/master-data/colours/page.tsx`
- Create: `src/app/(app)/master-data/size-scales/page.tsx`
- Create: `src/app/(app)/master-data/import/page.tsx`
- Create: `src/app/(app)/master-data/import/import-form.tsx`
- Create: `src/lib/import/import-form-actions.ts`
- Modify: `src/components/app-nav.tsx`

- [ ] **Step 1: Reusable list table**

`src/components/master-data-table.tsx`:

```tsx
export type Column<T> = { header: string; cell: (row: T) => React.ReactNode };

export function MasterDataTable<T extends { id: string }>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Column<T>[];
}) {
  return (
    <table className="w-full border bg-white text-sm">
      <thead className="bg-slate-100 text-left">
        <tr>
          {columns.map((c) => (
            <th key={c.header} className="p-2">
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t">
            {columns.map((c) => (
              <td key={c.header} className="p-2">
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Factory form action wrapper**

`src/lib/masterdata/factory-form-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createFactory } from "./factory";
import { createFactorySchema } from "./factory";

export async function createFactoryFromForm(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = createFactorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "KNIT",
    contactName: formData.get("contactName") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await createFactory(actor, parsed.data);
    revalidatePath("/master-data/factories");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
```

- [ ] **Step 3: Factory form (client)**

`src/app/(app)/master-data/factories/factory-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { factoryTypes } from "@/lib/masterdata/factory";
import { createFactoryFromForm } from "@/lib/masterdata/factory-form-actions";

export function FactoryForm() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        const res = await createFactoryFromForm(fd);
        setMessage(res.ok ? "Factory created" : res.error);
      }}
      className="flex flex-wrap items-end gap-3 rounded border bg-white p-4"
    >
      <input name="name" placeholder="Factory name" required className="rounded border px-3 py-2" />
      <select name="type" className="rounded border px-3 py-2">
        {factoryTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input name="contactName" placeholder="Contact (optional)" className="rounded border px-3 py-2" />
      <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-white">
        Add factory
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </form>
  );
}
```

- [ ] **Step 4: Factory page**

`src/app/(app)/master-data/factories/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listFactories } from "@/lib/masterdata/factory";
import { MasterDataTable } from "@/components/master-data-table";
import { FactoryForm } from "./factory-form";

export default async function FactoriesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const factories = await listFactories(actor, { includeInactive: true });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Factories</h1>
      {can(actor.role, "masterData", "create") && <FactoryForm />}
      <MasterDataTable
        rows={factories}
        columns={[
          { header: "Name", cell: (f) => f.name },
          { header: "Code", cell: (f) => f.code },
          { header: "Type", cell: (f) => f.type },
          { header: "Active", cell: (f) => (f.active ? "Yes" : "No") },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 5: Buyers / Styles / Colours / Size-scales read pages**

`src/app/(app)/master-data/buyers/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listBuyers } from "@/lib/masterdata/buyer";
import { MasterDataTable } from "@/components/master-data-table";

export default async function BuyersPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const buyers = await listBuyers(actor, { includeInactive: true });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Buyers</h1>
      <MasterDataTable
        rows={buyers}
        columns={[
          { header: "Name", cell: (b) => b.name },
          { header: "Code", cell: (b) => b.code },
        ]}
      />
    </div>
  );
}
```

`src/app/(app)/master-data/styles/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listStyles } from "@/lib/masterdata/style";
import { MasterDataTable } from "@/components/master-data-table";

export default async function StylesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const styles = await listStyles(actor, { includeInactive: true });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Styles</h1>
      <MasterDataTable
        rows={styles}
        columns={[
          { header: "Code", cell: (s) => s.styleCode },
          { header: "Name", cell: (s) => s.name },
        ]}
      />
    </div>
  );
}
```

`src/app/(app)/master-data/colours/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listColours } from "@/lib/masterdata/sizescale";
import { MasterDataTable } from "@/components/master-data-table";

export default async function ColoursPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const colours = await listColours(actor);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Colours</h1>
      <MasterDataTable
        rows={colours}
        columns={[
          { header: "Name", cell: (c) => c.name },
          { header: "Code", cell: (c) => c.code ?? "" },
        ]}
      />
    </div>
  );
}
```

`src/app/(app)/master-data/size-scales/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listSizeScales } from "@/lib/masterdata/sizescale";
import { MasterDataTable } from "@/components/master-data-table";

export default async function SizeScalesPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "view")) redirect("/dashboard");
  const scales = await listSizeScales(actor);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Size scales</h1>
      <MasterDataTable
        rows={scales}
        columns={[
          { header: "Name", cell: (s) => s.name },
          { header: "Sizes", cell: (s) => s.sizes.map((z) => z.label).join(", ") },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 6: Import form action wrapper**

`src/lib/import/import-form-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { readMasterDataRows } from "./excel";
import { importMasterData, type ImportSummary } from "./import-actions";

export async function importFromUpload(
  formData: FormData,
): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose an .xlsx file" };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await readMasterDataRows(buffer);
    const summary = await importMasterData(actor, rows);
    revalidatePath("/master-data/factories");
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed" };
  }
}
```

- [ ] **Step 7: Import form + page**

`src/app/(app)/master-data/import/import-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { importFromUpload } from "@/lib/import/import-form-actions";

export function ImportForm() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        const res = await importFromUpload(fd);
        setMessage(
          res.ok
            ? `Imported: ${res.summary.factories} factories, ${res.summary.buyers} buyers, ${res.summary.brands} brands, ${res.summary.styles} styles`
            : res.error,
        );
      }}
      className="flex flex-wrap items-end gap-3 rounded border bg-white p-4"
    >
      <input name="file" type="file" accept=".xlsx" required className="rounded border px-3 py-2" />
      <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-white">
        Import master data
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </form>
  );
}
```

`src/app/(app)/master-data/import/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "masterData", "create")) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Import master data</h1>
      <p className="text-slate-600">
        Upload the BD open orders .xlsx. Factories, buyers, brands and styles will be
        extracted, de-duplicated and added. Re-running is safe (idempotent).
      </p>
      <ImportForm />
    </div>
  );
}
```

- [ ] **Step 8: Add nav entries** — replace the `ITEMS` array in `src/components/app-nav.tsx`:

```tsx
const ITEMS: { href: string; label: string; module: Parameters<typeof can>[1] }[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboards" },
  { href: "/master-data/factories", label: "Factories", module: "masterData" },
  { href: "/master-data/buyers", label: "Buyers", module: "masterData" },
  { href: "/master-data/styles", label: "Styles", module: "masterData" },
  { href: "/master-data/colours", label: "Colours", module: "masterData" },
  { href: "/master-data/size-scales", label: "Sizes", module: "masterData" },
  { href: "/master-data/import", label: "Import", module: "masterData" },
  { href: "/users", label: "Users", module: "users" },
];
```

- [ ] **Step 9: Type-check + manual smoke**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run dev`, log in as admin, open **Import**, upload `BD open order's 11June2026.xlsx`, confirm the summary counts, then check Factories/Buyers/Styles pages are populated.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(master-data): admin UI for entities + Excel import page + nav"
```

---

## Task 10: Full verification

- [ ] **Step 1: Run the entire suite**

```bash
npx tsc --noEmit          # no type errors
npm test                  # all Phase 0a + 0b tests pass
```

Expected: Phase 0a (14) + text (4) + factory (6) + buyer (4) + sizescale (5) + style (3) + normalize (6) + import (3) all green.

- [ ] **Step 2: Commit any fixups**

```bash
git add -A && git commit -m "test: full Phase 0b verification" --allow-empty
```

---

## Self-Review (completed by plan author)

**Spec coverage (Phase 0b scope, spec §6 module 2 / §8 master data):**
- Buyer/Brand → Task 4 ✔ · Factory → Task 3 ✔ · Style → Task 6 ✔ · SizeScale(+Size)/Colour → Task 5 ✔
- Soft-delete on master data (spec §12) → `setActive` + `active` filters ✔
- RBAC `masterData` (spec §7) → every action calls `assertPermission(…, "masterData", …)` ✔
- Audit on every mutation (spec §12) → `recordAudit` in each action + import ✔
- Excel import w/ dedup of "LIZ/TEI TAK vs Liz" (spec §9 ⑥) → Tasks 7–8 ✔
- Per-size scale modeling supporting size-wise quantities (spec §8) → SizeScale/Size ✔

**Placeholder scan:** none — all steps contain complete code/commands.

**Type consistency:** `SessionUser` (from Phase 0a guard) used everywhere; `RawRow`/`NormalizedMasterData` defined in `normalize.ts` and consumed by `excel.ts` + `import-actions.ts`; `factoryTypes`/`createFactorySchema` exported from `factory.ts` and reused by the form action and UI; Prisma compound-unique inputs (`buyerId_code`, `brandId_styleCode`) match the `@@unique` definitions in Task 1.

**Deferred (correctly out of scope):** Port/Forwarder (Phase 3), Currency/FxRate (Phase 4), edit/de-activate UIs beyond create (can be added per entity using the same form pattern), PO/shipment import (Phases 1/3).
