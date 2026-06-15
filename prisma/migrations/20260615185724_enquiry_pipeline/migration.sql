-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'QUOTING', 'QUOTED', 'WON', 'LOST', 'DROPPED');

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "factoryId" TEXT,
    "styleRef" TEXT NOT NULL,
    "targetQty" INTEGER,
    "targetPriceUsd" DECIMAL(12,4),
    "quotedPriceUsd" DECIMAL(12,4),
    "requiredShipDate" TIMESTAMP(3),
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "lostReason" TEXT,
    "notes" TEXT,
    "convertedPoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enquiry_status_idx" ON "Enquiry"("status");
