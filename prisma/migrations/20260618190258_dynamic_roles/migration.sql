-- User.role becomes a free-form role KEY (was enum)
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
DROP TYPE IF EXISTS "Role";

-- Dynamic per-company roles with a granular permission map
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_companyId_key_key" ON "Role"("companyId", "key");
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- Seed the system roles for every existing company (idempotent via the unique index)
INSERT INTO "Role" ("id","companyId","key","name","isSystem","permissions","createdAt","updatedAt")
SELECT gen_random_uuid()::text, c.id, 'ADMIN', 'Admin', true,
  '{"users":["view","create","edit","delete"],"roles":["view","create","edit","delete"],"masterData":["view","create","edit","delete"],"orders":["view","create","edit","delete"],"criticalPath":["view","create","edit","delete"],"sampling":["view","create","edit","delete"],"productionQc":["view","create","edit","delete"],"costing":["view","create","edit","delete","approve"],"shipment":["view","create","edit","delete"],"documents":["view","create","edit","delete"],"finance":["view","create","edit","delete"],"dashboards":["view"],"auditLog":["view"]}'::jsonb,
  now(), now() FROM "Company" c
ON CONFLICT ("companyId","key") DO NOTHING;

INSERT INTO "Role" ("id","companyId","key","name","isSystem","permissions","createdAt","updatedAt")
SELECT gen_random_uuid()::text, c.id, 'MERCHANDISER', 'Merchandiser', true,
  '{"masterData":["view","create","edit"],"orders":["view","create","edit","delete"],"criticalPath":["view","create","edit","delete"],"sampling":["view","create","edit","delete"],"productionQc":["view","create","edit","delete"],"costing":["view","create","edit"],"shipment":["view","create","edit","delete"],"documents":["view","create","edit","delete"],"finance":["view"],"dashboards":["view"]}'::jsonb,
  now(), now() FROM "Company" c
ON CONFLICT ("companyId","key") DO NOTHING;

INSERT INTO "Role" ("id","companyId","key","name","isSystem","permissions","createdAt","updatedAt")
SELECT gen_random_uuid()::text, c.id, 'ACCOUNTS', 'Accounts', true,
  '{"masterData":["view"],"orders":["view"],"criticalPath":["view"],"productionQc":["view"],"costing":["view","create","edit","delete","approve"],"shipment":["view"],"documents":["view","create","edit"],"finance":["view","create","edit","delete"],"dashboards":["view"]}'::jsonb,
  now(), now() FROM "Company" c
ON CONFLICT ("companyId","key") DO NOTHING;

INSERT INTO "Role" ("id","companyId","key","name","isSystem","permissions","createdAt","updatedAt")
SELECT gen_random_uuid()::text, c.id, 'MANAGEMENT', 'Management', true,
  '{"users":["view"],"masterData":["view"],"orders":["view"],"criticalPath":["view"],"sampling":["view"],"productionQc":["view"],"costing":["view"],"shipment":["view"],"documents":["view"],"finance":["view"],"dashboards":["view"],"auditLog":["view"]}'::jsonb,
  now(), now() FROM "Company" c
ON CONFLICT ("companyId","key") DO NOTHING;
