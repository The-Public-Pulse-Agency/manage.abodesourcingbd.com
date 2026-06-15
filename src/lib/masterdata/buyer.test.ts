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
