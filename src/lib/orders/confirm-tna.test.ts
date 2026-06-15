import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createStyle } from "@/lib/masterdata/style";
import { createPurchaseOrder } from "@/lib/orders/po";
import { setOrderLine } from "@/lib/orders/lines";
import { confirmPurchaseOrder } from "@/lib/orders/confirm";
import { approveCosting } from "@/lib/orders/costing";
import { seedTemplates, DEFAULT_TEMPLATES } from "@/lib/tna/templates";

const admin = { id: "admin-1", role: "ADMIN" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

beforeEach(async () => {
  await resetDb();
  await seedTemplates();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("confirm hooks T&A instantiation", () => {
  it("creates back-scheduled milestones atomically on confirm", async () => {
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
    await approveCosting(accounts, po.id);
    await confirmPurchaseOrder(admin, po.id);
    expect(await prisma.taMilestone.count({ where: { poId: po.id } })).toBe(DEFAULT_TEMPLATES.length);

    const pp = await prisma.taMilestone.findFirstOrThrow({ where: { poId: po.id, key: "PP_SAMPLE" } });
    expect(pp.plannedDate?.toISOString()).toBe("2026-05-16T00:00:00.000Z");
  });
});
