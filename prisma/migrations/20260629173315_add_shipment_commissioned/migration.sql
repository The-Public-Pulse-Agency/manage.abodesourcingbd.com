-- Buying-house commission settled flag (Yes/No) per shipment.
ALTER TABLE "Shipment" ADD COLUMN "commissioned" BOOLEAN NOT NULL DEFAULT false;
