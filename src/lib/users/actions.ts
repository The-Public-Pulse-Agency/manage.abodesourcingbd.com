import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import { createUserSchema, type CreateUserInput } from "./schema";

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

export async function setUserActive(
  actor: SessionUser,
  userId: string,
  active: boolean,
): Promise<PublicUser> {
  assertPermission(actor, "users", "edit");
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
