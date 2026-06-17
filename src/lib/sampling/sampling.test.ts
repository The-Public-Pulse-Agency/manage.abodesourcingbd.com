import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createSampleRequest, updateSampleStatus, listSampleRequests } from "./sampling";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };
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

describe("createSampleRequest", () => {
  it("creates a PENDING sample request and audits it", async () => {
    const po = await seedPo();
    const s = await createSampleRequest(admin, po.id, { type: "PP", remarks: "rush" });
    expect(s.status).toBe("PENDING");
    expect(s.type).toBe("PP");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: s.id, action: "create" } });
    expect(audit).toBeTruthy();
  });

  it("rejects an unknown poId", async () => {
    await expect(createSampleRequest(admin, "nope", { type: "PP" })).rejects.toThrow(/not found/i);
  });

  it("rejects writing to a CANCELLED order", async () => {
    const po = await seedPo();
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "CANCELLED" } });
    await expect(createSampleRequest(admin, po.id, { type: "PP" })).rejects.toThrow(/cancelled/i);
  });

  it("forbids Accounts from sampling", async () => {
    const po = await seedPo();
    await expect(createSampleRequest(accounts, po.id, { type: "PP" })).rejects.toThrow(ForbiddenError);
  });
});

describe("updateSampleStatus", () => {
  it("walks the lifecycle PENDING -> SUBMITTED -> APPROVED with a required date", async () => {
    const po = await seedPo();
    const s = await createSampleRequest(admin, po.id, { type: "LAB_DIP" });
    await updateSampleStatus(admin, s.id, { status: "SUBMITTED" });
    const done = await updateSampleStatus(admin, s.id, { status: "APPROVED", approvedDate: d("2026-05-10") });
    expect(done.status).toBe("APPROVED");
    expect(done.approvedDate?.toISOString()).toBe("2026-05-10T00:00:00.000Z");
  });

  it("rejects an illegal transition (PENDING -> APPROVED)", async () => {
    const po = await seedPo();
    const s = await createSampleRequest(admin, po.id, { type: "LAB_DIP" });
    await expect(
      updateSampleStatus(admin, s.id, { status: "APPROVED", approvedDate: d("2026-05-10") }),
    ).rejects.toThrow(/illegal sample status transition/i);
  });

  it("requires approvedDate when approving", async () => {
    const po = await seedPo();
    const s = await createSampleRequest(admin, po.id, { type: "LAB_DIP" });
    await updateSampleStatus(admin, s.id, { status: "SUBMITTED" });
    await expect(updateSampleStatus(admin, s.id, { status: "APPROVED" })).rejects.toThrow(
      /approveddate is required/i,
    );
  });

  it("clears approvedDate on a non-approved status (REJECTED)", async () => {
    const po = await seedPo();
    const s = await createSampleRequest(admin, po.id, { type: "LAB_DIP" });
    await updateSampleStatus(admin, s.id, { status: "SUBMITTED" });
    const rej = await updateSampleStatus(admin, s.id, { status: "REJECTED" });
    expect(rej.approvedDate).toBeNull();
  });

  it("forbids Accounts from updating sample status", async () => {
    const po = await seedPo();
    const s = await createSampleRequest(admin, po.id, { type: "LAB_DIP" });
    await expect(updateSampleStatus(accounts, s.id, { status: "SUBMITTED" })).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("listSampleRequests", () => {
  it("lists sample requests for a PO", async () => {
    const po = await seedPo();
    await createSampleRequest(admin, po.id, { type: "FIT" });
    await createSampleRequest(admin, po.id, { type: "SIZE_SET" });
    expect(await listSampleRequests(admin, po.id)).toHaveLength(2);
  });
});
