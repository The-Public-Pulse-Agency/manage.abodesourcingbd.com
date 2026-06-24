-- Per-style critical-path: milestones can belong to a specific style (null = legacy PO-level).
ALTER TABLE "TaMilestone" ADD COLUMN "styleId" TEXT;

-- Swap the unique from (poId,key) to (poId,styleId,key) so each style gets its own set.
DROP INDEX "TaMilestone_poId_key_key";
CREATE UNIQUE INDEX "TaMilestone_poId_styleId_key_key" ON "TaMilestone"("poId", "styleId", "key");
CREATE INDEX "TaMilestone_styleId_idx" ON "TaMilestone"("styleId");

ALTER TABLE "TaMilestone" ADD CONSTRAINT "TaMilestone_styleId_fkey"
  FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE CASCADE ON UPDATE CASCADE;
