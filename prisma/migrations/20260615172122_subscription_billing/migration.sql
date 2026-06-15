-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'BLOCKED');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "amountBdt" INTEGER NOT NULL DEFAULT 3333,
    "periodDays" INTEGER NOT NULL DEFAULT 30,
    "planName" TEXT NOT NULL DEFAULT 'ABD OMS — Managed SaaS',
    "planNotes" TEXT NOT NULL DEFAULT 'Full SLA, all modifications & upgrades included.',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "lastPaymentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amountBdt" INTEGER NOT NULL,
    "status" "SubPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "epsRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_orderId_key" ON "SubscriptionPayment"("orderId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
