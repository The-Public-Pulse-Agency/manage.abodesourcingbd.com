-- CreateEnum
CREATE TYPE "FactoryType" AS ENUM ('KNIT', 'WOVEN', 'SWEATER', 'OTHER');

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "FactoryType" NOT NULL DEFAULT 'KNIT',
    "address" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SizeScale" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SizeScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Size" (
    "id" TEXT NOT NULL,
    "sizeScaleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Size_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colour" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Style" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "styleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "composition" TEXT,
    "category" TEXT,
    "defaultSizeScaleId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Style_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_code_key" ON "Buyer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_buyerId_code_key" ON "Brand"("buyerId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Factory_code_key" ON "Factory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SizeScale_name_key" ON "SizeScale"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Size_sizeScaleId_label_key" ON "Size"("sizeScaleId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Colour_name_key" ON "Colour"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Style_brandId_styleCode_key" ON "Style"("brandId", "styleCode");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Size" ADD CONSTRAINT "Size_sizeScaleId_fkey" FOREIGN KEY ("sizeScaleId") REFERENCES "SizeScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Style" ADD CONSTRAINT "Style_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Style" ADD CONSTRAINT "Style_defaultSizeScaleId_fkey" FOREIGN KEY ("defaultSizeScaleId") REFERENCES "SizeScale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
