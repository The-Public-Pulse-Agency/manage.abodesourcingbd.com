import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBuyer, createBrand } from "@/lib/masterdata/buyer";
import { createFactory } from "@/lib/masterdata/factory";
import { createPurchaseOrder } from "@/lib/orders/po";
import { createInvoice } from "@/lib/finance/invoices";
import { generateAlerts } from "./generate";
import type { Notifier } from "./notifier";

const admin = { id: "admin-1", role: "ADMIN" as const };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const };
const NOW = new Date("2026-06-15T03:00:00.000Z");
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

function capturingNotifier() {
  const sent: { to: string; subject: string; body: string }[] = [];
  const notifier: Notifier = {
    async email(to, subject, body) {
      sent.push({ to, subject, body });
    },
  };
  return { sent, notifier };
}

async function user(email: string, role: "MERCHANDISER" | "ACCOUNTS" | "ADMIN", active = true) {
  return prisma.user.create({ data: { name: email, email, passwordHash: "x", role, active } });
}

async function seedSources() {
  const buyer = await createBuyer(admin, { name: "Ralawise" });
  const brand = await createBrand(admin, { buyerId: buyer.id, name: "TriDri", code: "TRIDRI" });
  const factory = await createFactory(admin, { name: "Liz", type: "KNIT" });
  const live = await createPurchaseOrder(admin, {
    poNumber: "P-LIVE", buyerId: buyer.id, brandId: brand.id, factoryId: factory.id, exFactoryDate: d("2026-06-20"),
  });
  await prisma.purchaseOrder.update({ where: { id: live.id }, data: { status: "CONFIRMED" } });
  // overdue milestone (merch) + the live PO is also ex-fty-soon AND doc-missing (merch x2)
  await prisma.taMilestone.create({ data: { poId: live.id, key: "pp_sample", name: "PP sample", stage: "SAMPLING", position: 6, plannedDate: d("2026-06-10") } });
  // overdue invoice (accounts)
  await createInvoice(accounts, { type: "BUYER", number: "ABD-1", poId: live.id, amount: 200, issueDate: d("2026-03-07") });
  return live;
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("generateAlerts", () => {
  it("fans out to active recipients by role and emails one digest each", async () => {
    const merch = await user("merch@abode.com", "MERCHANDISER");
    const merchOff = await user("off@abode.com", "MERCHANDISER", false); // inactive
    const acc = await user("acc@abode.com", "ACCOUNTS");
    await seedSources();

    const { sent, notifier } = capturingNotifier();
    const { created } = await generateAlerts({ now: NOW, notifier });

    // merch: milestone-overdue + ex-fty + doc-missing = 3 rows; accounts: 1 payment row.
    expect(created).toBe(4);
    expect(await prisma.notification.count({ where: { userId: merch.id } })).toBe(3);
    expect(await prisma.notification.count({ where: { userId: acc.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: merchOff.id } })).toBe(0); // inactive excluded

    // one digest per recipient with new rows
    expect(sent.map((s) => s.to).sort()).toEqual(["acc@abode.com", "merch@abode.com"]);
    expect(sent.find((s) => s.to === "merch@abode.com")?.subject).toContain("3 new");
  });

  it("is idempotent: a second run creates 0 rows and sends 0 emails", async () => {
    await user("merch@abode.com", "MERCHANDISER");
    await user("acc@abode.com", "ACCOUNTS");
    await seedSources();

    const first = await generateAlerts({ now: NOW });
    expect(first.created).toBe(4);

    const { sent, notifier } = capturingNotifier();
    const second = await generateAlerts({ now: NOW, notifier });
    expect(second.created).toBe(0);
    expect(sent).toHaveLength(0);
    expect(await prisma.notification.count()).toBe(4); // no duplicates
  });

  it("does not abort the run when an email send throws", async () => {
    await user("merch@abode.com", "MERCHANDISER");
    await seedSources();
    const boom: Notifier = { async email() { throw new Error("smtp down"); } };
    const { created } = await generateAlerts({ now: NOW, notifier: boom });
    expect(created).toBe(3); // rows still persisted despite the email failure
  });
});
