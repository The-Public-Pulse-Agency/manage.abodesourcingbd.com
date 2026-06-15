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
