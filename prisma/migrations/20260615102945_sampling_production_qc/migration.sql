-- CreateEnum
CREATE TYPE "SampleType" AS ENUM ('LAB_DIP', 'FIT', 'PP', 'SIZE_SET');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('INLINE', 'FINAL');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'FAIL');

-- CreateTable
CREATE TABLE "SampleRequest" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "colourId" TEXT,
    "type" "SampleType" NOT NULL,
    "status" "SampleStatus" NOT NULL DEFAULT 'PENDING',
    "sentDate" TIMESTAMP(3),
    "approvedDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRecord" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "cutQty" INTEGER NOT NULL DEFAULT 0,
    "sewQty" INTEGER NOT NULL DEFAULT 0,
    "finishQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "aql" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SampleRequest_poId_idx" ON "SampleRequest"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRecord_poId_key" ON "ProductionRecord"("poId");

-- CreateIndex
CREATE INDEX "Inspection_poId_idx" ON "Inspection"("poId");

-- AddForeignKey
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRecord" ADD CONSTRAINT "ProductionRecord_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
