import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { listNotifications, unreadCount, markRead, markAllRead } from "./notifications";

async function user(email: string) {
  return prisma.user.create({ data: { name: email, email, passwordHash: "x", role: "MERCHANDISER" } });
}
async function notif(userId: string, dedupKey: string) {
  return prisma.notification.create({
    data: { userId, type: "EX_FACTORY_SOON", message: dedupKey, link: "/x", dedupKey },
  });
}

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("notifications lib", () => {
  it("scopes list + unread count per user", async () => {
    const a = await user("a@x.com");
    const b = await user("b@x.com");
    await notif(a.id, "k1");
    await notif(a.id, "k2");
    await notif(b.id, "k1");

    expect(await listNotifications({ id: a.id, role: "MERCHANDISER" })).toHaveLength(2);
    expect(await unreadCount({ id: a.id, role: "MERCHANDISER" })).toBe(2);
    expect(await unreadCount({ id: b.id, role: "MERCHANDISER" })).toBe(1);
  });

  it("markRead only affects the actor's own notification", async () => {
    const a = await user("a@x.com");
    const b = await user("b@x.com");
    const na = await notif(a.id, "k1");

    // b cannot read a's notification
    expect(await markRead({ id: b.id, role: "MERCHANDISER" }, na.id)).toBe(0);
    expect((await prisma.notification.findUnique({ where: { id: na.id } }))?.read).toBe(false);

    // a can
    expect(await markRead({ id: a.id, role: "MERCHANDISER" }, na.id)).toBe(1);
    expect((await prisma.notification.findUnique({ where: { id: na.id } }))?.read).toBe(true);
  });

  it("markAllRead clears only the actor's unread", async () => {
    const a = await user("a@x.com");
    const b = await user("b@x.com");
    await notif(a.id, "k1");
    await notif(a.id, "k2");
    await notif(b.id, "k1");

    expect(await markAllRead({ id: a.id, role: "MERCHANDISER" })).toBe(2);
    expect(await unreadCount({ id: a.id, role: "MERCHANDISER" })).toBe(0);
    expect(await unreadCount({ id: b.id, role: "MERCHANDISER" })).toBe(1);
  });
});
