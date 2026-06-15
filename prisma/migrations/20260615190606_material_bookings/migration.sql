-- CreateEnum
CREATE TYPE "MaterialKind" AS ENUM ('FABRIC', 'TRIM', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('BOOKED', 'PARTIAL', 'IN_HOUSE');

-- CreateTable
CREATE TABLE "MaterialBooking" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "kind" "MaterialKind" NOT NULL,
    "description" TEXT NOT NULL,
    "supplier" TEXT,
    "bookedQty" DECIMAL(12,2),
    "unit" TEXT,
    "bookingRef" TEXT,
    "etaDate" TIMESTAMP(3),
    "receivedQty" DECIMAL(12,2),
    "receivedDate" TIMESTAMP(3),
    "status" "MaterialStatus" NOT NULL DEFAULT 'BOOKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialBooking_poId_idx" ON "MaterialBooking"("poId");

-- AddForeignKey
ALTER TABLE "MaterialBooking" ADD CONSTRAINT "MaterialBooking_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
