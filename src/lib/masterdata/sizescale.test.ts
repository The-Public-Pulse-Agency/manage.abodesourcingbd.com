import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createSizeScale, listSizeScales, createColour, listColours } from "./sizescale";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };

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
