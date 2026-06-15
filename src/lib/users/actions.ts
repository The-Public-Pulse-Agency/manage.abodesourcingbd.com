import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "./schema";

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
  const email = data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with this email already exists");

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email,
      role: data.role,
      passwordHash: await hashPassword(data.password),
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
  return prisma.user.findMany({ select: PUBLIC_SELECT, orderBy: { createdAt: "asc" } });
}

export async function getUser(
  actor: SessionUser,
  userId: string,
): Promise<PublicUser | null> {
  assertPermission(actor, "users", "view");
  return prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_SELECT });
}

/**
 * Best-effort guard: refuse a change that would leave zero *active* admins.
 * `excludeUserId` is the user being changed; `wouldRemainAdmin` says whether
 * that user is still an active admin after the change.
 */
async function ensureNotLastAdmin(
  excludeUserId: string,
  wouldRemainAdmin: boolean,
): Promise<void> {
  if (wouldRemainAdmin) return;
  const otherActiveAdmins = await prisma.user.count({
    where: { role: "ADMIN", active: true, id: { not: excludeUserId } },
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

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, active: true },
  });
  if (!current) throw new Error("User not found");

  // Guard: changing an active admin's role away from ADMIN must not strip the
  // last admin.
  if (current.role === "ADMIN" && current.active) {
    await ensureNotLastAdmin(userId, data.role === "ADMIN");
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

export async function setUserActive(
  actor: SessionUser,
  userId: string,
  active: boolean,
): Promise<PublicUser> {
  assertPermission(actor, "users", "edit");

  // Guard: deactivating the last active admin is not allowed.
  if (!active) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, active: true },
    });
    if (current?.role === "ADMIN" && current.active) {
      await ensureNotLastAdmin(userId, false);
    }
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
