import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { DEFAULT_TEMPLATES, seedTemplates, listTemplates } from "./templates";

const admin = { id: "admin-1", role: "ADMIN" as const };

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("templates", () => {
  it("has unique keys and ascending positions", () => {
    const keys = DEFAULT_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const positions = DEFAULT_TEMPLATES.map((t) => t.position);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("seeds idempotently", async () => {
    await seedTemplates();
    await seedTemplates();
    expect(await prisma.taMilestoneTemplate.count()).toBe(DEFAULT_TEMPLATES.length);
  });

  it("lists active templates in order", async () => {
    await seedTemplates();
    const list = await listTemplates(admin);
    expect(list).toHaveLength(DEFAULT_TEMPLATES.length);
    expect(list[0].key).toBe(DEFAULT_TEMPLATES[0].key);
  });
});
