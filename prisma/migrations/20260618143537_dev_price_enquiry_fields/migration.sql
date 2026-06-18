-- Development tracker: confirmed price (free-text to match the informal tracker fields)
ALTER TABLE "DevelopmentItem" ADD COLUMN "confirmedPrice" TEXT;

-- Enquiry: price quoted date + fabric composition
ALTER TABLE "Enquiry" ADD COLUMN "priceQuotedDate" TIMESTAMP(3);
ALTER TABLE "Enquiry" ADD COLUMN "fabricComposition" TEXT;
