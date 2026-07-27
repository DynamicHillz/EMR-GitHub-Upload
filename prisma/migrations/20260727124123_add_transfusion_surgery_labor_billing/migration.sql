-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "laborRecordId" TEXT,
ADD COLUMN     "operationNoteId" TEXT,
ADD COLUMN     "transfusionChartId" TEXT;

-- AlterTable
ALTER TABLE "labor_records" ADD COLUMN     "billingStatus" "BillingStatus" NOT NULL DEFAULT 'UNBILLED';

-- AlterTable
ALTER TABLE "operation_notes" ADD COLUMN     "billingStatus" "BillingStatus" NOT NULL DEFAULT 'UNBILLED';

-- AlterTable
ALTER TABLE "transfusion_charts" ADD COLUMN     "billingStatus" "BillingStatus" NOT NULL DEFAULT 'UNBILLED';

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_transfusionChartId_fkey" FOREIGN KEY ("transfusionChartId") REFERENCES "transfusion_charts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_operationNoteId_fkey" FOREIGN KEY ("operationNoteId") REFERENCES "operation_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_laborRecordId_fkey" FOREIGN KEY ("laborRecordId") REFERENCES "labor_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
