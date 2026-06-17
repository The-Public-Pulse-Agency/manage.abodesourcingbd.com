import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/auth/guard";

// Notifications are personal: every query is scoped to the actor's own userId. Since a
// user belongs to exactly one company, userId scoping is already strictly tenant-tight
// (no companyId needed — and the app layout calls unreadCount without a company context).

export function listNotifications(actor: SessionUser, opts?: { limit?: number }) {
  return prisma.notification.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
  });
}

export function unreadCount(actor: SessionUser): Promise<number> {
  return prisma.notification.count({ where: { userId: actor.id, read: false } });
}

/** Marks one notification read; returns rows affected (0 if it isn't the actor's). */
export async function markRead(actor: SessionUser, id: string): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { id, userId: actor.id },
    data: { read: true },
  });
  return res.count;
}

export async function markAllRead(actor: SessionUser): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { userId: actor.id, read: false },
    data: { read: true },
  });
  return res.count;
}
