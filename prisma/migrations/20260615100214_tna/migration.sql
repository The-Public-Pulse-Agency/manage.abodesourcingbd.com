-- CreateEnum
CREATE TYPE "TaStage" AS ENUM ('PRE_PRODUCTION', 'SAMPLING', 'PRODUCTION_QC', 'SHIPPING');

-- CreateTable
CREATE TABLE "TaMilestoneTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "TaStage" NOT NULL,
    "offsetDays" INTEGER,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaMilestoneTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaMilestone" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "TaStage" NOT NULL,
    "position" INTEGER NOT NULL,
    "offsetDays" INTEGER,
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaMilestoneTemplate_key_key" ON "TaMilestoneTemplate"("key");

-- CreateIndex
CREATE INDEX "TaMilestone_plannedDate_idx" ON "TaMilestone"("plannedDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaMilestone_poId_key_key" ON "TaMilestone"("poId", "key");

-- AddForeignKey
ALTER TABLE "TaMilestone" ADD CONSTRAINT "TaMilestone_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
