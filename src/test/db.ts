import { prisma } from "@/lib/db";

/** Truncate all app tables between tests. Add new tables here as they appear. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "User" RESTART IDENTITY CASCADE',
  );
}
