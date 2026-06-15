import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { seedTemplates } from "./templates";
import { instantiateMilestones } from "./milestones";
import { criticalPathBoard } from "./board";

const admin = { id: "admin-1", role: "ADMIN" as const };
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

type Refs = { buyerId: string; brandId: string; factoryId: string };

async function refs(): Promise<Refs> {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  return { buyerId: buyer.id, brandId: brand.id, factoryId: factory.id };
}

async function mkPo(r: Refs, poNumber: string, exFty: Date) {
  const order = await createPurchaseOrder(admin, {
    poNumber,
    buyerId: r.buyerId,
    brandId: r.brandId,
    factoryId: r.factoryId,
    exFactoryDate: exFty,
  });
  await instantiateMilestones(order.id);
  return order;
}

beforeEach(async () => {
  await resetDb();
  await seedTemplates();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("criticalPathBoard", () => {
  it("returns only overdue/due-soon incomplete milestones with PO context, sorted by date", async () => {
    const r = await refs();
    await mkPo(r, "209531", d("2026-06-20"));
    const board = await criticalPathBoard(admin, { now: d("2026-06-15") });
    expect(board.length).toBeGreaterThan(0);
    expect(board.every((b) => b.actualDate === null)).toBe(true);
    expect(board.every((b) => b.rag === "OVERDUE" || b.rag === "DUE_SOON")).toBe(true);
    expect(board[0].poNumber).toBe("209531");
    expect(board[0].factory).toBe("Liz");
    const dates = board.map((b) => b.plannedDate?.getTime() ?? 0);
    expect([...dates].sort((a, z) => a - z)).toEqual(dates);
  });

  it("includes the inclusive 7-day edge and excludes just beyond it", async () => {
    const r = await refs();
    await mkPo(r, "EDGE-7", d("2026-06-22")); // EX_FACTORY planned now+7
    await mkPo(r, "EDGE-8", d("2026-06-23")); // EX_FACTORY planned now+8
    const board = await criticalPathBoard(admin, { now: d("2026-06-15") });
    const keys = board.map((b) => `${b.poNumber}:${b.name}`);
    expect(keys).toContain("EDGE-7:Ex-factory");
    expect(keys).not.toContain("EDGE-8:Ex-factory");
  });

  it("still includes a due-soon milestone rescheduled to a non-midnight time", async () => {
    const r = await refs();
    const order = await mkPo(r, "209531", d("2026-09-30"));
    const m = await prisma.taMilestone.findFirstOrThrow({ where: { poId: order.id, key: "EX_FACTORY" } });
    await prisma.taMilestone.update({
      where: { id: m.id },
      data: { plannedDate: new Date("2026-06-22T09:00:00.000Z") },
    });
    const board = await criticalPathBoard(admin, { now: d("2026-06-15") });
    expect(board.some((b) => b.id === m.id)).toBe(true);
  });

  it("excludes completed milestones, closed and on-hold orders", async () => {
    const r = await refs();
    const order = await mkPo(r, "209531", d("2026-06-20"));
    await prisma.taMilestone.updateMany({ where: { poId: order.id }, data: { actualDate: d("2026-06-01") } });
    expect(await criticalPathBoard(admin, { now: d("2026-06-15") })).toHaveLength(0);

    const held = await mkPo(r, "HOLD-1", d("2026-06-20"));
    await prisma.purchaseOrder.update({ where: { id: held.id }, data: { status: "ON_HOLD" } });
    const board = await criticalPathBoard(admin, { now: d("2026-06-15") });
    expect(board.every((b) => b.poId !== held.id)).toBe(true);
  });
});
