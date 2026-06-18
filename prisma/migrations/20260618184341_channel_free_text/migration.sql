-- Channel is now free text (custom channel/buyer names), not a fixed enum
ALTER TABLE "PurchaseOrder" ALTER COLUMN "channel" DROP DEFAULT;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "channel" TYPE TEXT USING "channel"::TEXT;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "channel" SET DEFAULT 'DIRECT';
DROP TYPE IF EXISTS "OrderChannel";
