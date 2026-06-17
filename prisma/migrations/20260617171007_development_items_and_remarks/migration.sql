-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "remarks" TEXT;

-- CreateTable
CREATE TABLE "DevelopmentItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "buyerId" TEXT,
    "factoryId" TEXT,
    "styleRef" TEXT NOT NULL,
    "colour" TEXT,
    "labDip" TEXT,
    "knitting" TEXT,
    "firstSample" TEXT,
    "secondSample" TEXT,
    "finalSampleDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevelopmentItem_companyId_idx" ON "DevelopmentItem"("companyId");
