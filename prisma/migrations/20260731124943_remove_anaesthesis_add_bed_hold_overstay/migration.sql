-- AlterTable
ALTER TABLE "admissions" ADD COLUMN     "bedClearedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "operation_notes" DROP COLUMN "anaesthesis";

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "overstayGraceDays" INTEGER NOT NULL DEFAULT 2;

