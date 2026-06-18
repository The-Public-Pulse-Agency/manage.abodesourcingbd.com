import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "./guard";
import { recordAudit } from "@/lib/audit";
import {
  ACTIONS,
  COMPANY_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
  SUPERADMIN_KEY,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_NAMES,
  type Action,
  type Module,
  type PermissionMap,
} from "./permissions";

/**
 * Resolve the effective permission map for a role. SUPERADMIN (and any company-less actor)
 * uses the seeded defaults; tenant roles load their editable Role row, falling back to the
 * seeded defaults for a system key if the row is missing (e.g. before backfill).
 */
export async function resolvePermissions(companyId: string | null, roleKey: string): Promise<PermissionMap> {
  // Platform perms are granted ONLY to a genuine tenant-less operator. A tenant-scoped row
  // keyed SUPERADMIN (or any company-less non-superadmin) can never confer platform access.
  if (roleKey === SUPERADMIN_KEY) {
    return companyId === null ? DEFAULT_ROLE_PERMISSIONS.SUPERADMIN : {};
  }
  if (!companyId) return {};
  const row = await prisma.role.findFirst({ where: { companyId, key: roleKey }, select: { permissions: true } });
  if (row?.permissions) return row.permissions as PermissionMap;
  return DEFAULT_ROLE_PERMISSIONS[roleKey] ?? {};
}

// Keys a custom role may never take — they shadow platform/system identifiers.
const RESERVED_ROLE_KEYS = new Set<string>([SUPERADMIN_KEY, ...SYSTEM_ROLE_KEYS]);

/** Seed the system roles for a company (idempotent). Used at signup + backfill. */
export async function seedCompanyRoles(companyId: string, db: Prisma.TransactionClient = prisma): Promise<void> {
  const existing = await db.role.count({ where: { companyId } });
  if (existing > 0) return;
  await db.role.createMany({
    data: SYSTEM_ROLE_KEYS.map((key) => ({
      companyId,
      key,
      name: SYSTEM_ROLE_NAMES[key] ?? key,
      isSystem: true,
      permissions: (DEFAULT_ROLE_PERMISSIONS[key] ?? {}) as Prisma.InputJsonValue,
    })),
  });
}

/** Keep only valid company modules/actions — never lets a tenant role grant platform modules. */
function sanitizePermissions(input: unknown): PermissionMap {
  const out: PermissionMap = {};
  if (!input || typeof input !== "object") return out;
  const rec = input as Record<string, unknown>;
  for (const m of COMPANY_MODULES) {
    const raw = rec[m];
    if (!Array.isArray(raw)) continue;
    const acts = (ACTIONS as readonly string[]).filter((a) => raw.includes(a)) as Action[];
    if (acts.length) out[m as Module] = acts;
  }
  return out;
}

export type RoleRow = { id: string; key: string; name: string; isSystem: boolean; permissions: PermissionMap };

export async function listRoles(actor: SessionUser): Promise<RoleRow[]> {
  assertPermission(actor, "roles", "view");
  const rows = await prisma.role.findMany({
    where: { companyId: tenantId(actor) },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return rows.map((r) => ({ id: r.id, key: r.key, name: r.name, isSystem: r.isSystem, permissions: r.permissions as PermissionMap }));
}

const createRoleSchema = z.object({ name: z.string().trim().min(2, "Role name is required").max(40) });

/** Derive a stable uppercase key from a name; ensure unique per company. */
async function uniqueKey(companyId: string, name: string): Promise<string> {
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "ROLE";
  // Never let a custom role take a reserved key (would shadow SUPERADMIN / a system role).
  let key = RESERVED_ROLE_KEYS.has(base) ? `${base}_2` : base;
  for (let i = 2; RESERVED_ROLE_KEYS.has(key) || (await prisma.role.findFirst({ where: { companyId, key }, select: { id: true } })); i++) {
    key = `${base}_${i}`;
  }
  return key;
}

export async function createRole(actor: SessionUser, input: { name: string; permissions?: unknown }): Promise<RoleRow> {
  assertPermission(actor, "roles", "create");
  const cid = tenantId(actor);
  const data = createRoleSchema.parse(input);
  const key = await uniqueKey(cid, data.name);
  const permissions = sanitizePermissions(input.permissions);
  const r = await prisma.role.create({
    data: { companyId: cid, key, name: data.name, isSystem: false, permissions: permissions as Prisma.InputJsonValue },
  });
  await recordAudit({ userId: actor.id, entityType: "Role", entityId: r.id, action: "create", after: { key, name: data.name } });
  return { id: r.id, key: r.key, name: r.name, isSystem: r.isSystem, permissions };
}

export async function updateRole(actor: SessionUser, id: string, input: { name?: string; permissions?: unknown }): Promise<void> {
  assertPermission(actor, "roles", "edit");
  const cid = tenantId(actor);
  const existing = await prisma.role.findFirst({ where: { id, companyId: cid } });
  if (!existing) throw new Error("Role not found");
  const data: { name?: string; permissions?: Prisma.InputJsonValue } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("Role name is required");
    data.name = name;
  }
  if (input.permissions !== undefined) {
    // ADMIN's own permissions can be edited, but never stripped of role management — that
    // would lock everyone out of the Role Manager.
    const perms = sanitizePermissions(input.permissions);
    if (existing.key === "ADMIN") {
      perms.roles = [...new Set([...(perms.roles ?? []), "view", "edit"])] as Action[];
      perms.users = [...new Set([...(perms.users ?? []), "view", "edit"])] as Action[];
    }
    data.permissions = perms as Prisma.InputJsonValue;
  }
  await prisma.role.update({ where: { id }, data });
  await recordAudit({ userId: actor.id, entityType: "Role", entityId: id, action: "edit", after: { name: data.name ?? existing.name } });
}

export async function deleteRole(actor: SessionUser, id: string): Promise<void> {
  assertPermission(actor, "roles", "delete");
  const cid = tenantId(actor);
  const role = await prisma.role.findFirst({ where: { id, companyId: cid } });
  if (!role) throw new Error("Role not found");
  if (role.isSystem) throw new Error("System roles cannot be deleted");
  const inUse = await prisma.user.count({ where: { companyId: cid, role: role.key } });
  if (inUse > 0) throw new Error(`In use by ${inUse} user(s) — reassign them before deleting this role`);
  await prisma.role.deleteMany({ where: { id, companyId: cid } });
  await recordAudit({ userId: actor.id, entityType: "Role", entityId: id, action: "delete", before: { key: role.key } });
}

/** Assignable role keys for the user create/edit form (this company's roles). */
export async function assignableRoles(actor: SessionUser): Promise<{ key: string; name: string }[]> {
  assertPermission(actor, "users", "view");
  const rows = await prisma.role.findMany({ where: { companyId: tenantId(actor) }, orderBy: [{ isSystem: "desc" }, { name: "asc" }], select: { key: true, name: true } });
  return rows;
}
