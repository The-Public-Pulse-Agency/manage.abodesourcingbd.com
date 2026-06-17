import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { importMasterData } from "./import-actions";
import type { RawRow } from "./normalize";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const, companyId: "test-co" };

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
