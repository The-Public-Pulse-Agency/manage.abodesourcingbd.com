import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { seedTemplates, DEFAULT_TEMPLATES } from "./templates";
import {
  instantiateMilestones,
  completeMilestone,
  rescheduleMilestone,
  rebaseMilestones,
  listPoMilestones,
} from "./milestones";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const, companyId: "test-co" };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function seedPo(exFty: Date | null) {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return createPurchaseOrder(admin, {
    poNumber: "209531",
    buyerId: buyer.id,
    brandId: brand.id,
    factoryId: factory.id,
    exFactoryDate: exFty ?? undefined,
  });
}

beforeEach(async () => {
  await resetDb();
  await seedTemplates("test-co");
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("instantiateMilestones", () => {
  it("creates one milestone per template, back-scheduled from ex-factory, snapshotting offset", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    const ms = await prisma.taMilestone.findMany({ where: { poId: po.id }, orderBy: { position: "asc" } });
    expect(ms).toHaveLength(DEFAULT_TEMPLATES.length);
    const pp = ms.find((m) => m.key === "PP_SAMPLE");
    expect(pp?.plannedDate?.toISOString()).toBe("2026-05-16T00:00:00.000Z");
    expect(pp?.offsetDays).toBe(-45);
    expect(ms.find((m) => m.key === "PAYMENT")?.plannedDate).toBeNull();
  });

  it("floors a non-midnight ex-factory date (no off-by-one)", async () => {
    const po = await seedPo(new Date("2026-06-30T14:30:00.000Z"));
    await instantiateMilestones(po.id);
    const pp = await prisma.taMilestone.findFirstOrThrow({ where: { poId: po.id, key: "PP_SAMPLE" } });
    expect(pp.plannedDate?.toISOString()).toBe("2026-05-16T00:00:00.000Z");
  });

  it("leaves planned dates null when the PO has no ex-factory date", async () => {
    const po = await seedPo(null);
    await instantiateMilestones(po.id);
    const ms = await prisma.taMilestone.findMany({ where: { poId: po.id } });
    expect(ms.every((m) => m.plannedDate === null)).toBe(true);
  });

  it("is idempotent", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    await instantiateMilestones(po.id);
    expect(await prisma.taMilestone.count({ where: { poId: po.id } })).toBe(DEFAULT_TEMPLATES.length);
  });
});

describe("complete / reschedule / list", () => {
  it("completes (floored) and audits before/after", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    const m = await prisma.taMilestone.findFirstOrThrow({ where: { poId: po.id, key: "LAB_DIP" } });
    const done = await completeMilestone(admin, m.id, new Date("2026-05-10T09:15:00.000Z"));
    expect(done.actualDate?.toISOString()).toBe("2026-05-10T00:00:00.000Z");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: m.id, action: "edit" } });
    expect(audit.after).not.toBeNull();
  });

  it("reschedules a planned date (floored)", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    const m = await prisma.taMilestone.findFirstOrThrow({ where: { poId: po.id, key: "CUTTING" } });
    const moved = await rescheduleMilestone(admin, m.id, new Date("2026-06-10T18:00:00.000Z"));
    expect(moved.plannedDate?.toISOString()).toBe("2026-06-10T00:00:00.000Z");
  });

  it("lists milestones with computed RAG; forbids view-only roles from editing", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    const list = await listPoMilestones(admin, po.id, d("2026-06-15"));
    expect(list).toHaveLength(DEFAULT_TEMPLATES.length);
    expect(list.find((m) => m.key === "EX_FACTORY")?.rag).toBe("ON_TRACK");
    await expect(completeMilestone(mgmt, list[0].id, d("2026-06-15"))).rejects.toThrow(ForbiddenError);
  });
});

describe("rebaseMilestones", () => {
  it("re-bases un-actualed milestones from the new ex-factory, leaving completed ones", async () => {
    const po = await seedPo(d("2026-06-30"));
    await instantiateMilestones(po.id);
    // complete LAB_DIP (so it must NOT move)
    const lab = await prisma.taMilestone.findFirstOrThrow({ where: { poId: po.id, key: "LAB_DIP" } });
    await completeMilestone(admin, lab.id, d("2026-05-10"));
    // ex-factory slips by a month
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { exFactoryDate: d("2026-07-30") } });

    const count = await rebaseMilestones(admin, po.id);
    expect(count).toBe(DEFAULT_TEMPLATES.length - 1); // all except the completed LAB_DIP

    const pp = await prisma.taMilestone.findFirstOrThrow({ where: { poId: po.id, key: "PP_SAMPLE" } });
    expect(pp.plannedDate?.toISOString()).toBe("2026-06-15T00:00:00.000Z"); // 30 Jul - 45d
    const labAfter = await prisma.taMilestone.findFirstOrThrow({ where: { poId: po.id, key: "LAB_DIP" } });
    expect(labAfter.actualDate?.toISOString()).toBe("2026-05-10T00:00:00.000Z"); // untouched
  });
});
