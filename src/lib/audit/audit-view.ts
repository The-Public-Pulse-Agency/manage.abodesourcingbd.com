import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";

export type AuditRow = {
  id: string;
  createdAt: Date;
  user: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
};

export type AuditFilter = { action?: string; entityType?: string; userId?: string; q?: string };

/** Compact one-line summary of the changed fields (prefers `after`, falls back to `before`). */
function summarise(before: Prisma.JsonValue, after: Prisma.JsonValue): string {
  const obj = (after && typeof after === "object" && !Array.isArray(after) ? after : null)
    ?? (before && typeof before === "object" && !Array.isArray(before) ? before : null);
  if (!obj) return "";
  return Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${v && typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .slice(0, 8)
    .join(" · ");
}

/**
 * Company-scoped activity feed. Audit rows carry no companyId, so we scope by the set of users
 * that belong to the actor's company (a tenant can never see another tenant's activity). System
 * rows (no userId) are intentionally excluded from the tenant view.
 */
export async function listAuditLog(actor: SessionUser, filter: AuditFilter, opts: { page?: number; pageSize?: number } = {}) {
  assertPermission(actor, "auditLog", "view");
  const cid = tenantId(actor);
  const users = await prisma.user.findMany({ where: { companyId: cid }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
  const uname = new Map(users.map((u) => [u.id, u.name || u.email]));
  const ids = users.map((u) => u.id);
  // A requested user filter must still resolve to someone in this company.
  const userScope = filter.userId && ids.includes(filter.userId) ? filter.userId : { in: ids };

  const q = filter.q?.trim();
  const where: Prisma.AuditLogWhereInput = {
    userId: userScope,
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.entityType ? { entityType: filter.entityType } : {}),
    ...(q ? { OR: [{ entityType: { contains: q, mode: "insensitive" } }, { entityId: { contains: q, mode: "insensitive" } }] } : {}),
  };

  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const [rows, entityTypeRows] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.findMany({ where: { userId: { in: ids } }, select: { entityType: true }, distinct: ["entityType"], orderBy: { entityType: "asc" } }),
  ]);

  return {
    rows: rows.map((r): AuditRow => ({
      id: r.id,
      createdAt: r.createdAt,
      user: r.userId ? (uname.get(r.userId) ?? "—") : "(system)",
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      detail: summarise(r.before, r.after),
    })),
    total,
    page,
    pageSize,
    totalPages,
    users: users.map((u) => ({ value: u.id, label: u.name || u.email })),
    entityTypes: entityTypeRows.map((e) => e.entityType),
  };
}
