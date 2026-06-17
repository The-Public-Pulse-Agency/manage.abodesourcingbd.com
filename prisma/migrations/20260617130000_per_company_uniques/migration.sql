-- Make tenant-data uniques per-company (was global) so each company can reuse codes/names.
DROP INDEX "Buyer_code_key";
CREATE UNIQUE INDEX "Buyer_companyId_code_key" ON "Buyer"("companyId", "code");

DROP INDEX "Factory_code_key";
CREATE UNIQUE INDEX "Factory_companyId_code_key" ON "Factory"("companyId", "code");

DROP INDEX "SizeScale_name_key";
CREATE UNIQUE INDEX "SizeScale_companyId_name_key" ON "SizeScale"("companyId", "name");

DROP INDEX "Colour_name_key";
CREATE UNIQUE INDEX "Colour_companyId_name_key" ON "Colour"("companyId", "name");

DROP INDEX "Port_name_key";
CREATE UNIQUE INDEX "Port_companyId_name_key" ON "Port"("companyId", "name");

DROP INDEX "Forwarder_name_key";
CREATE UNIQUE INDEX "Forwarder_companyId_name_key" ON "Forwarder"("companyId", "name");

DROP INDEX "Shipment_reference_key";
CREATE UNIQUE INDEX "Shipment_companyId_reference_key" ON "Shipment"("companyId", "reference");

DROP INDEX "Shipment_blNumber_key";
CREATE UNIQUE INDEX "Shipment_companyId_blNumber_key" ON "Shipment"("companyId", "blNumber");

DROP INDEX "Invoice_type_number_key";
CREATE UNIQUE INDEX "Invoice_companyId_type_number_key" ON "Invoice"("companyId", "type", "number");
