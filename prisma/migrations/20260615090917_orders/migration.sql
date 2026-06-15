-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('RALAWISE', 'RALATEAM', 'DIRECT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'PARTLY_SHIPPED', 'SHIPPED', 'CLOSED', 'CANCELLED', 'ON_HOLD');

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "factoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "channel" "OrderChannel" NOT NULL DEFAULT 'DIRECT',
    "factoryId" TEXT NOT NULL,
    "lotId" TEXT,
    "orderDate" TIMESTAMP(3),
    "crd" TIMESTAMP(3),
    "exFactoryDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "colourId" TEXT,
    "colourKey" TEXT NOT NULL DEFAULT '',
    "sizeScaleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineSize" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "netFob" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "sellFob" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLineSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_exFactoryDate_idx" ON "PurchaseOrder"("exFactoryDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_factoryId_idx" ON "PurchaseOrder"("factoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_buyerId_factoryId_channel_poNumber_key" ON "PurchaseOrder"("buyerId", "factoryId", "channel", "poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_poId_styleId_colourKey_key" ON "OrderLine"("poId", "styleId", "colourKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLineSize_orderLineId_label_key" ON "OrderLineSize"("orderLineId", "label");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_sizeScaleId_fkey" FOREIGN KEY ("sizeScaleId") REFERENCES "SizeScale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineSize" ADD CONSTRAINT "OrderLineSize_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
