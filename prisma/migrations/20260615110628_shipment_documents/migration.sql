-- CreateEnum
CREATE TYPE "ShipmentMode" AS ENUM ('SEA', 'AIR');

-- CreateEnum
CREATE TYPE "TelexStatus" AS ENUM ('PENDING', 'RECEIVED', 'RELEASED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BL', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'TEST_CERT', 'SAMPLE_PHOTO', 'OTHER');

-- CreateTable
CREATE TABLE "Port" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Forwarder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Forwarder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "mode" "ShipmentMode" NOT NULL DEFAULT 'SEA',
    "containerNo" TEXT,
    "cartons" INTEGER,
    "exFactoryDate" TIMESTAMP(3),
    "blNumber" TEXT,
    "blDate" TIMESTAMP(3),
    "telexStatus" "TelexStatus" NOT NULL DEFAULT 'PENDING',
    "forwarderId" TEXT,
    "portId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLine" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLineSize" (
    "id" TEXT NOT NULL,
    "shipmentLineId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "ShipmentLineSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Port_name_key" ON "Port"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Forwarder_name_key" ON "Forwarder"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_reference_key" ON "Shipment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_blNumber_key" ON "Shipment"("blNumber");

-- CreateIndex
CREATE INDEX "Shipment_telexStatus_idx" ON "Shipment"("telexStatus");

-- CreateIndex
CREATE INDEX "ShipmentLine_orderLineId_idx" ON "ShipmentLine"("orderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentLine_shipmentId_orderLineId_key" ON "ShipmentLine"("shipmentId", "orderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentLineSize_shipmentLineId_label_key" ON "ShipmentLineSize"("shipmentLineId", "label");

-- CreateIndex
CREATE INDEX "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_forwarderId_fkey" FOREIGN KEY ("forwarderId") REFERENCES "Forwarder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLineSize" ADD CONSTRAINT "ShipmentLineSize_shipmentLineId_fkey" FOREIGN KEY ("shipmentLineId") REFERENCES "ShipmentLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
