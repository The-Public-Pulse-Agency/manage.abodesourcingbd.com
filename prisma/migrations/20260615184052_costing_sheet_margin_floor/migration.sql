-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('FABRIC', 'CM', 'TRIMS', 'TEST', 'FREIGHT', 'COMMISSION', 'OTHER');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "minMarginPct" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CostItem" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "amountPerUnit" DECIMAL(12,4) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostItem_poId_idx" ON "CostItem"("poId");

-- AddForeignKey
ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
