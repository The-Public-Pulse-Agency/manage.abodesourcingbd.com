-- Make critical-path template keys unique per company (was global).
DROP INDEX "TaMilestoneTemplate_key_key";
CREATE UNIQUE INDEX "TaMilestoneTemplate_companyId_key_key" ON "TaMilestoneTemplate"("companyId", "key");
