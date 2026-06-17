import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createFactory, listFactories, updateFactory, setFactoryActive } from "./factory";

const admin = { id: "admin-1", role: "ADMIN" as const, companyId: "test-co" };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const, companyId: "test-co" };

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("createFactory", () => {
  it("creates a factory and audits it", async () => {
    const f = await createFactory(admin, { name: "Green Life/TTF", type: "KNIT" });
    expect(f.code).toBe("GREEN-LIFE-TTF");
    const audit = await prisma.auditLog.findMany({ where: { entityId: f.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("create");
  });

  it("rejects a duplicate code", async () => {
    await createFactory(admin, { name: "UHM Ltd", type: "KNIT" });
    await expect(createFactory(admin, { name: "UHM   Ltd", type: "KNIT" })).rejects.toThrow(
      /already exists/i,
    );
  });

  it("forbids a view-only role from creating", async () => {
    await expect(createFactory(mgmt, { name: "X", type: "KNIT" })).rejects.toThrow(ForbiddenError);
  });
});

describe("listFactories / setFactoryActive", () => {
  it("lists active factories and can deactivate", async () => {
    const f = await createFactory(admin, { name: "Saturn", type: "WOVEN" });
    await setFactoryActive(admin, f.id, false);
    const active = await listFactories(admin);
    expect(active.find((x) => x.id === f.id)).toBeUndefined();
    const all = await listFactories(admin, { includeInactive: true });
    expect(all.find((x) => x.id === f.id)).toBeDefined();
  });
});

describe("updateFactory", () => {
  it("updates fields and audits", async () => {
    const f = await createFactory(admin, { name: "Anowara", type: "KNIT" });
    const u = await updateFactory(admin, f.id, { contactName: "Mr. Karim" });
    expect(u.contactName).toBe("Mr. Karim");
  });
});
