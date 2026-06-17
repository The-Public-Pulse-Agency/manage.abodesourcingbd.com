-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "signupIp" TEXT;

-- CreateIndex
CREATE INDEX "Company_signupIp_createdAt_idx" ON "Company"("signupIp", "createdAt");
