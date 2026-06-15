import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createDocument, listDocuments } from "./documents";

const admin = { id: "admin-1", role: "ADMIN" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };

async function seedPo() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return createPurchaseOrder(admin, { poNumber: "209531", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id });
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("documents", () => {
  it("attaches a document to a real entity and lists it", async () => {
    const po = await seedPo();
    await createDocument(admin, { entityType: "PurchaseOrder", entityId: po.id, type: "BL", fileName: "bl.pdf" });
    const docs = await listDocuments(admin, "PurchaseOrder", po.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].type).toBe("BL");
  });

  it("rejects attaching to a non-existent entity (no orphans)", async () => {
    await expect(
      createDocument(admin, { entityType: "Shipment", entityId: "nope", type: "BL", fileName: "bl.pdf" }),
    ).rejects.toThrow(/not found/i);
  });

  it("lets Accounts attach a finance doc but not a sample photo", async () => {
    const po = await seedPo();
    await createDocument(accounts, { entityType: "PurchaseOrder", entityId: po.id, type: "COMMERCIAL_INVOICE", fileName: "ci.pdf" });
    await expect(
      createDocument(accounts, { entityType: "PurchaseOrder", entityId: po.id, type: "SAMPLE_PHOTO", fileName: "p.jpg" }),
    ).rejects.toThrow(/finance documents/i);
  });

  it("forbids a view-only role from uploading", async () => {
    const po = await seedPo();
    await expect(
      createDocument(mgmt, { entityType: "PurchaseOrder", entityId: po.id, type: "BL", fileName: "bl.pdf" }),
    ).rejects.toThrow(ForbiddenError);
  });
});
