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
import { approveCosting } from "@/lib/orders/costing";
import { addInspection, listInspections } from "./qc";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function confirmedPo() {
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
    sizes: [{ label: "M", qty: 100, netFob: 1, sellFob: 2 }],
  });
  await approveCosting(accounts, po.id);
  await confirmPurchaseOrder(admin, po.id);
  return po;
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("qc inspections", () => {
  it("records a final AQL inspection and audits it", async () => {
    const po = await confirmedPo();
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

  it("lists inspections strictly newest-first by date", async () => {
    const po = await confirmedPo();
    await addInspection(admin, po.id, { type: "INLINE", result: "PASS", date: d("2026-06-10") });
    await addInspection(admin, po.id, { type: "FINAL", result: "FAIL", date: d("2026-06-25") });
    const list = await listInspections(admin, po.id);
    expect(list.map((i) => i.type)).toEqual(["FINAL", "INLINE"]);
  });

  it("returns same-date inspections deterministically", async () => {
    const po = await confirmedPo();
    await addInspection(admin, po.id, { type: "INLINE", result: "PASS", date: d("2026-06-10") });
    await addInspection(admin, po.id, { type: "INLINE", result: "FAIL", date: d("2026-06-10") });
    const first = await listInspections(admin, po.id);
    const second = await listInspections(admin, po.id);
    expect(first).toHaveLength(2);
    expect(first.map((i) => i.id)).toEqual(second.map((i) => i.id)); // stable order
  });

  it("rejects an unknown poId", async () => {
    await expect(
      addInspection(admin, "nope", { type: "FINAL", result: "PASS", date: d("2026-06-25") }),
    ).rejects.toThrow(/not found/i);
  });

  it("forbids a view-only role from recording", async () => {
    const po = await confirmedPo();
    await expect(
      addInspection(mgmt, po.id, { type: "FINAL", result: "PASS", date: d("2026-06-25") }),
    ).rejects.toThrow(ForbiddenError);
  });
});
