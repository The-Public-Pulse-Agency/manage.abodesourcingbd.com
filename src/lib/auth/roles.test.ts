import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "./guard";
import { seedCompanyRoles, listRoles, createRole, updateRole, deleteRole, resolvePermissions } from "./roles";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const accounts = { id: "acc-1", role: "ACCOUNTS" as const, companyId: "test-co" };

beforeEach(async () => {
  await resetDb();
  await seedCompanyRoles("test-co");
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("dynamic roles", () => {
  it("seeds the four system roles", async () => {
    const roles = await listRoles(admin);
    expect(roles.map((r) => r.key).sort()).toEqual(["ACCOUNTS", "ADMIN", "MANAGEMENT", "MERCHANDISER"]);
    expect(roles.every((r) => r.isSystem)).toBe(true);
  });

  it("creates a custom role with a derived key and sanitized permissions", async () => {
    const r = await createRole(admin, { name: "QC Lead", permissions: { productionQc: ["view", "edit"], companies: ["view"] } });
    expect(r.key).toBe("QC_LEAD");
    expect(r.permissions.productionQc).toEqual(["view", "edit"]);
    // platform module stripped from a tenant role
    expect((r.permissions as Record<string, unknown>).companies).toBeUndefined();
  });

  it("never mints a reserved key (shadowing SUPERADMIN/system roles)", async () => {
    const r = await createRole(admin, { name: "Admin" });
    expect(r.key).not.toBe("ADMIN");
    const s = await createRole(admin, { name: "Superadmin" });
    expect(s.key).not.toBe("SUPERADMIN");
  });

  it("keeps ADMIN able to manage users + roles even if unticked", async () => {
    const adminRole = (await listRoles(admin)).find((r) => r.key === "ADMIN")!;
    await updateRole(admin, adminRole.id, { permissions: { orders: ["view"] } });
    const updated = (await listRoles(admin)).find((r) => r.key === "ADMIN")!;
    expect(updated.permissions.roles).toEqual(expect.arrayContaining(["view", "edit"]));
    expect(updated.permissions.users).toEqual(expect.arrayContaining(["view", "edit"]));
  });

  it("blocks deleting a system role and a role still in use", async () => {
    const adminRole = (await listRoles(admin)).find((r) => r.key === "ADMIN")!;
    await expect(deleteRole(admin, adminRole.id)).rejects.toThrow(/system/i);

    const custom = await createRole(admin, { name: "Temp Role" });
    await prisma.user.create({ data: { name: "U", email: "u@x.com", passwordHash: "x", role: custom.key, companyId: "test-co" } });
    await expect(deleteRole(admin, custom.id)).rejects.toThrow(/in use/i);
  });

  it("forbids a non-roles-permitted actor from managing roles", async () => {
    await expect(createRole(accounts, { name: "X" })).rejects.toThrow(ForbiddenError);
  });

  it("resolves SUPERADMIN platform perms only for a tenant-less actor", async () => {
    expect(await resolvePermissions(null, "SUPERADMIN")).toMatchObject({ companies: expect.any(Array) });
    expect(await resolvePermissions("test-co", "SUPERADMIN")).toEqual({});
  });

  it("resolves a tenant role's stored permissions", async () => {
    const custom = await createRole(admin, { name: "Viewer", permissions: { orders: ["view"], finance: ["view"] } });
    const perms = await resolvePermissions("test-co", custom.key);
    expect(perms.orders).toEqual(["view"]);
    expect(perms.finance).toEqual(["view"]);
  });
});
