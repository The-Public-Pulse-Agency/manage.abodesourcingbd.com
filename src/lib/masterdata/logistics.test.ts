import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { createPort, listPorts, createForwarder, listForwarders } from "./logistics";

const admin = { id: "admin-1", role: "ADMIN" as const };
const mgmt = { id: "mgmt-1", role: "MANAGEMENT" as const };

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("ports & forwarders", () => {
  it("creates and lists ports", async () => {
    await createPort(admin, { name: "Chittagong", country: "BD" });
    expect(await listPorts(admin)).toHaveLength(1);
  });
  it("rejects duplicate port name", async () => {
    await createPort(admin, { name: "Chittagong" });
    await expect(createPort(admin, { name: "Chittagong" })).rejects.toThrow(/already exists/i);
  });
  it("creates and lists forwarders", async () => {
    await createForwarder(admin, { name: "CF Global" });
    expect(await listForwarders(admin)).toHaveLength(1);
  });
  it("forbids a view-only role from creating", async () => {
    await expect(createPort(mgmt, { name: "X" })).rejects.toThrow(ForbiddenError);
  });
});
