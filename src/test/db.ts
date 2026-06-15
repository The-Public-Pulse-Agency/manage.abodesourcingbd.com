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
    `TRUNCATE TABLE "${s}"."Enquiry", "${s}"."CostItem", "${s}"."SubscriptionPayment", "${s}"."Subscription", "${s}"."Notification", "${s}"."AuditLog", "${s}"."Payment", "${s}"."Invoice", "${s}"."Document", "${s}"."ShipmentLineSize", "${s}"."ShipmentLine", "${s}"."Shipment", "${s}"."Port", "${s}"."Forwarder", "${s}"."Inspection", "${s}"."ProductionRecord", "${s}"."SampleRequest", "${s}"."TaMilestone", "${s}"."TaMilestoneTemplate", "${s}"."OrderLineSize", "${s}"."OrderLine", "${s}"."PurchaseOrder", "${s}"."Lot", "${s}"."Style", "${s}"."Size", "${s}"."SizeScale", "${s}"."Colour", "${s}"."Brand", "${s}"."Buyer", "${s}"."Factory", "${s}"."User" RESTART IDENTITY CASCADE`,
  );
}
