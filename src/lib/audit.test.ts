import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { recordAudit } from "./audit";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("recordAudit", () => {
  it("writes an audit row with actor, entity, action and payloads", async () => {
    await recordAudit({
      userId: "actor-1",
      entityType: "User",
      entityId: "user-9",
      action: "create",
      after: { email: "a@b.com" },
    });

    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].entityType).toBe("User");
    expect(rows[0].entityId).toBe("user-9");
    expect(rows[0].action).toBe("create");
    expect(rows[0].userId).toBe("actor-1");
    expect(rows[0].after).toEqual({ email: "a@b.com" });
  });
});
