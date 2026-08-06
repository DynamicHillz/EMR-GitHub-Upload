-- AlterEnum
ALTER TYPE "ClaimStatus" ADD VALUE 'PAID';

-- AlterTable
ALTER TABLE "insurance_claims" ADD COLUMN     "paidAmount" DECIMAL(12,2),
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "hmoProviderId" TEXT;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_hmoProviderId_fkey" FOREIGN KEY ("hmoProviderId") REFERENCES "insurance_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
