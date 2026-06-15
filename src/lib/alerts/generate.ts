import { prisma } from "@/lib/db";
import type { Role } from "@/lib/auth/permissions";
import { fetchAlertData } from "./data";
import { computeAlerts } from "./rules";
import { getNotifier, type Notifier } from "./notifier";

type Row = { userId: string; type: ReturnType<typeof computeAlerts>[number]["type"]; message: string; link: string; dedupKey: string };

/**
 * Daily alert run (system actor — bypasses RBAC; the cron route is secret-guarded).
 * Idempotent: `@@unique([userId, dedupKey])` + skipDuplicates means re-running never
 * duplicates rows. Email digests go ONLY to recipients with at least one genuinely new
 * row (determined by diffing against pre-existing keys, not a wall-clock boundary).
 */
export async function generateAlerts(opts: { now: Date; notifier?: Notifier }): Promise<{ created: number }> {
  const notifier = opts.notifier ?? getNotifier();
  const drafts = computeAlerts(await fetchAlertData(opts.now));
  if (drafts.length === 0) return { created: 0 };

  const roles = [...new Set(drafts.flatMap((d) => d.roles))] as Role[];
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: roles } },
    select: { id: true, email: true, role: true },
  });
  const byRole = new Map<Role, typeof users>();
  for (const u of users) {
    const list = byRole.get(u.role) ?? [];
    list.push(u);
    byRole.set(u.role, list);
  }

  // Expand drafts → per-recipient rows (a user has one role; dedupe by id per draft).
  const rows: Row[] = [];
  for (const d of drafts) {
    const seen = new Set<string>();
    for (const r of d.roles) {
      for (const u of byRole.get(r) ?? []) {
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        rows.push({ userId: u.id, type: d.type, message: d.message, link: d.link, dedupKey: d.dedupKey });
      }
    }
  }
  if (rows.length === 0) return { created: 0 };

  // Which (userId,dedupKey) already exist? Everything else is genuinely new.
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const dedupKeys = [...new Set(rows.map((r) => r.dedupKey))];
  const existing = await prisma.notification.findMany({
    where: { userId: { in: userIds }, dedupKey: { in: dedupKeys } },
    select: { userId: true, dedupKey: true },
  });
  const existingSet = new Set(existing.map((e) => `${e.userId}|${e.dedupKey}`));
  const freshRows = rows.filter((r) => !existingSet.has(`${r.userId}|${r.dedupKey}`));

  const { count } = await prisma.notification.createMany({ data: rows, skipDuplicates: true });

  // Best-effort per-user digest — DB rows already persisted; isolate each send so one
  // failure (e.g. Resend down) neither aborts the run nor skips other recipients.
  const freshByUser = new Map<string, string[]>();
  for (const r of freshRows) {
    const list = freshByUser.get(r.userId) ?? [];
    list.push(r.message);
    freshByUser.set(r.userId, list);
  }
  for (const [userId, messages] of freshByUser) {
    const email = users.find((u) => u.id === userId)?.email;
    if (!email) continue;
    try {
      await notifier.email(email, `Pulse OMS — ${messages.length} new alert(s)`, messages.join("\n"));
    } catch (err) {
      console.error(`[alerts] digest email failed for ${email}:`, err);
    }
  }

  return { created: count };
}
