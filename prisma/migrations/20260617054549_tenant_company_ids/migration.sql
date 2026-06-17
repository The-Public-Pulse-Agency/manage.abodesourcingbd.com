-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Buyer" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Colour" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CostItem" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Factory" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "FactoryCertificate" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Forwarder" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Lot" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "MaterialBooking" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "OrderLineSize" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Port" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ProductionRecord" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "SampleRequest" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ShipmentLine" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ShipmentLineSize" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Size" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "SizeScale" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Style" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "TaMilestone" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "TaMilestoneTemplate" ADD COLUMN     "companyId" TEXT;
