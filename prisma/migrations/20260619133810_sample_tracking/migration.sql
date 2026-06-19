-- Buyer Sample Tracking (outbound dispatch)
CREATE TABLE "BuyerSampleDispatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "buyerName" TEXT,
    "sampleType" TEXT,
    "artNo" TEXT,
    "styleName" TEXT,
    "factoryName" TEXT,
    "courierName" TEXT,
    "awbNumber" TEXT,
    "sendDate" TIMESTAMP(3),
    "numSamples" INTEGER,
    "approxArrival" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BuyerSampleDispatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BuyerSampleDispatch_companyId_idx" ON "BuyerSampleDispatch"("companyId");

-- Dhaka Office Sample In/Out ledger
CREATE TABLE "SampleMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "direction" TEXT NOT NULL,
    "movementDate" TIMESTAMP(3),
    "sampleType" TEXT,
    "qty" INTEGER,
    "artNo" TEXT,
    "buyer" TEXT,
    "poNumber" TEXT,
    "factoryName" TEXT,
    "colour" TEXT,
    "receivedFrom" TEXT,
    "sentTo" TEXT,
    "courierName" TEXT,
    "awbNumber" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SampleMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SampleMovement_companyId_idx" ON "SampleMovement"("companyId");
CREATE INDEX "SampleMovement_artNo_idx" ON "SampleMovement"("artNo");
