-- CreateTable
CREATE TABLE "FactoryCertificate" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactoryCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactoryCertificate_factoryId_idx" ON "FactoryCertificate"("factoryId");

-- AddForeignKey
ALTER TABLE "FactoryCertificate" ADD CONSTRAINT "FactoryCertificate_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
