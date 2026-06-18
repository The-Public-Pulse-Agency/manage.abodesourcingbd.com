-- Production tracked per order line (style/colour) instead of per PO
ALTER TABLE "ProductionRecord" ADD COLUMN "orderLineId" TEXT;
DROP INDEX IF EXISTS "ProductionRecord_poId_key";
CREATE INDEX IF NOT EXISTS "ProductionRecord_poId_idx" ON "ProductionRecord"("poId");
CREATE UNIQUE INDEX "ProductionRecord_orderLineId_key" ON "ProductionRecord"("orderLineId");
ALTER TABLE "ProductionRecord"
  ADD CONSTRAINT "ProductionRecord_orderLineId_fkey"
  FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Drop legacy per-PO records (no order line) so they don't linger as orphans
DELETE FROM "ProductionRecord" WHERE "orderLineId" IS NULL;

-- Critical-path milestone remarks/note
ALTER TABLE "TaMilestone" ADD COLUMN "note" TEXT;
