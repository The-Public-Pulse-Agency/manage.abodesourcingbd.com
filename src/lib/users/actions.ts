import { prisma } from "@/lib/db";
import { assertPermission, tenantId, type SessionUser } from "@/lib/auth/guard";
import { SYSTEM_ROLE_KEYS } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "./schema";

/** The assigned role must be a real Role in the actor's company (and never SUPERADMIN). System
 *  role keys are always valid (seeded into every company). */
async function assertRoleInCompany(companyId: string, roleKey: string): Promise<void> {
  if ((SYSTEM_ROLE_KEYS as readonly string[]).includes(roleKey)) return;
  const role = await prisma.role.findFirst({ where: { companyId, key: roleKey }, select: { id: true } });
  if (!role) throw new Error("Invalid role for this company");
}

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date;
};

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export async function createUser(
  actor: SessionUser,
  input: CreateUserInput,
): Promise<PublicUser> {
  assertPermission(actor, "users", "create");
  const data = createUserSchema.parse(input);
  await assertRoleInCompany(tenantId(actor), data.role);
  const email = data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with this email already exists");

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email,
      role: data.role,
      passwordHash: await hashPassword(data.password),
      companyId: tenantId(actor),
    },
    select: PUBLIC_SELECT,
  });

  await recordAudit({
    userId: actor.id,
    entityType: "User",
    entityId: user.id,
    action: "create",
    after: { name: user.name, email: user.email, role: user.role },
  });

  return user;
}

export async function listUsers(actor: SessionUser): Promise<PublicUser[]> {
  assertPermission(actor, "users", "view");
  return prisma.user.findMany({
    where: { companyId: tenantId(actor) },
    select: PUBLIC_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

export async function getUser(
  actor: SessionUser,
  userId: string,
): Promise<PublicUser | null> {
  assertPermission(actor, "users", "view");
  return prisma.user.findFirst({ where: { id: userId, companyId: tenantId(actor) }, select: PUBLIC_SELECT });
}

/**
 * Best-effort guard: refuse a change that would leave zero *active* admins in the
 * company. Scoped per-company so one tenant's admin count can't affect another's.
 */
async function ensureNotLastAdmin(
  companyId: string,
  excludeUserId: string,
  wouldRemainAdmin: boolean,
): Promise<void> {
  if (wouldRemainAdmin) return;
  const otherActiveAdmins = await prisma.user.count({
    where: { role: "ADMIN", active: true, companyId, id: { not: excludeUserId } },
  });
  if (otherActiveAdmins === 0) {
    throw new Error("Cannot remove the last active admin");
  }
}

export async function updateUser(
  actor: SessionUser,
  userId: string,
  input: UpdateUserInput,
): Promise<PublicUser> {
  assertPermission(actor, "users", "edit");
  const data = updateUserSchema.parse(input);
  const cid = tenantId(actor);
  await assertRoleInCompany(cid, data.role);

  const current = await prisma.user.findFirst({
    where: { id: userId, companyId: cid },
    select: { role: true, active: true },
  });
  if (!current) throw new Error("User not found");

  // Guard: changing an active admin's role away from ADMIN must not strip the
  // last admin.
  if (current.role === "ADMIN" && current.active) {
    await ensureNotLastAdmin(cid, userId, data.role === "ADMIN");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: data.name, role: data.role },
    select: PUBLIC_SELECT,
  });

  await recordAudit({
    userId: actor.id,
    entityType: "User",
    entityId: userId,
    action: "edit",
    after: { name: user.name, role: user.role },
  });
  return user;
}

export async function deleteUser(actor: SessionUser, userId: string): Promise<void> {
  assertPermission(actor, "users", "delete");
  const cid = tenantId(actor);
  if (userId === actor.id) throw new Error("You can't delete your own account");
  const target = await prisma.user.findFirst({
    where: { id: userId, companyId: cid },
    select: { id: true, role: true, active: true, name: true, email: true },
  });
  if (!target) throw new Error("User not found");
  // Never delete the last active admin (would lock the company out).
  if (target.role === "ADMIN" && target.active) {
    await ensureNotLastAdmin(cid, userId, false);
  }
  // Notifications cascade (FK onDelete: Cascade); audit/uploadedBy/approvedBy are soft refs.
  await prisma.user.delete({ where: { id: userId } });
  await recordAudit({
    userId: actor.id,
    entityType: "User",
    entityId: userId,
    action: "delete",
    before: { name: target.name, email: target.email, role: target.role },
  });
}

export async function setUserActive(
  actor: SessionUser,
  userId: string,
  active: boolean,
): Promise<PublicUser> {
  assertPermission(actor, "users", "edit");
  const cid = tenantId(actor);

  // Verify the target belongs to the actor's company (no cross-tenant toggles).
  const current = await prisma.user.findFirst({
    where: { id: userId, companyId: cid },
    select: { role: true, active: true },
  });
  if (!current) throw new Error("User not found");
  if (!active && current.role === "ADMIN" && current.active) {
    await ensureNotLastAdmin(cid, userId, false);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { active },
    select: PUBLIC_SELECT,
  });
  await recordAudit({
    userId: actor.id,
    entityType: "User",
    entityId: userId,
    action: "edit",
    after: { active },
  });
  return user;
}
