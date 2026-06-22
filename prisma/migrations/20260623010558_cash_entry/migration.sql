-- BDT cash book (office money received + expenses)
CREATE TABLE "CashEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "kind" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "amountBdt" DECIMAL(14,2) NOT NULL,
    "sender" TEXT,
    "head" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashEntry_companyId_entryDate_idx" ON "CashEntry"("companyId", "entryDate");
