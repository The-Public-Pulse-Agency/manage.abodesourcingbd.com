import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { verifyPassword } from "@/lib/auth/password";
import { createUser, listUsers, setUserActive } from "./actions";

const admin = { id: "admin-1", role: "ADMIN" as const };
const merch = { id: "merch-1", role: "MERCHANDISER" as const };

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createUser", () => {
  it("lets an Admin create a user with a hashed password", async () => {
    const user = await createUser(admin, {
      name: "Asha",
      email: "Asha@Abode.com",
      password: "supersecret",
      role: "MERCHANDISER",
    });
    expect(user.email).toBe("asha@abode.com"); // normalized lowercase
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).not.toBe("supersecret");
    expect(await verifyPassword("supersecret", row.passwordHash)).toBe(true);
  });

  it("forbids a non-Admin from creating users", async () => {
    await expect(
      createUser(merch, {
        name: "X",
        email: "x@abode.com",
        password: "supersecret",
        role: "ACCOUNTS",
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a duplicate email", async () => {
    const input = {
      name: "A",
      email: "dup@abode.com",
      password: "supersecret",
      role: "ACCOUNTS" as const,
    };
    await createUser(admin, input);
    await expect(createUser(admin, input)).rejects.toThrow(/already exists/i);
  });

  it("writes an audit row on creation", async () => {
    const user = await createUser(admin, {
      name: "Bina",
      email: "bina@abode.com",
      password: "supersecret",
      role: "ACCOUNTS",
    });
    const audits = await prisma.auditLog.findMany({ where: { entityId: user.id } });
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("create");
    expect(audits[0].userId).toBe(admin.id);
  });
});

describe("listUsers", () => {
  it("returns users without password hashes", async () => {
    await createUser(admin, {
      name: "C",
      email: "c@abode.com",
      password: "supersecret",
      role: "ACCOUNTS",
    });
    const users = await listUsers(admin);
    expect(users).toHaveLength(1);
    expect(users[0]).not.toHaveProperty("passwordHash");
  });
});

describe("setUserActive", () => {
  it("deactivates a user", async () => {
    const u = await createUser(admin, {
      name: "D",
      email: "d@abode.com",
      password: "supersecret",
      role: "ACCOUNTS",
    });
    const updated = await setUserActive(admin, u.id, false);
    expect(updated.active).toBe(false);
  });
});
