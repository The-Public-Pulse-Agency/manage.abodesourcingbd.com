import { prisma } from "@/lib/db";

/** Schema the tests run against (from the `schema=` param of the test DATABASE_URL). */
function dbSchema(): string {
  const m = (process.env.DATABASE_URL ?? "").match(/[?&]schema=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : "public";
}

/**
 * Truncate all app tables between tests. Table names are schema-qualified because
 * Prisma schema-qualifies its model queries but raw SQL does not — without the
 * qualifier an unqualified TRUNCATE would target `public` while data lives in the
 * test schema. Add new tables here as they appear.
 */
export async function resetDb() {
  const s = dbSchema();
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "${s}"."AuditLog", "${s}"."User" RESTART IDENTITY CASCADE`,
  );
}
