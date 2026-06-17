-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "buyerId" TEXT,
    "factoryId" TEXT,
    "factoryInvoiceNo" TEXT,
    "factoryInvoiceValue" DECIMAL(14,2),
    "commissionPct" DECIMAL(6,2),
    "ownInvoiceNo" TEXT,
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "paymentStatus" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionEntry_companyId_idx" ON "CommissionEntry"("companyId");
