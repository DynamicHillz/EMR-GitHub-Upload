-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "dhis2BaseUrl" TEXT,
ADD COLUMN     "dhis2CategoryOptionCombo" TEXT,
ADD COLUMN     "dhis2DataElementPediatricUnder5" TEXT,
ADD COLUMN     "dhis2DataElementSevereMalnutrition" TEXT,
ADD COLUMN     "dhis2DataElementTotalVisits" TEXT,
ADD COLUMN     "dhis2Enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dhis2OrgUnitId" TEXT,
ADD COLUMN     "dhis2Password" TEXT,
ADD COLUMN     "dhis2Username" TEXT;

-- CreateTable
CREATE TABLE "dhis2_sync_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "responseSummary" JSONB,
    "triggeredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dhis2_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dhis2_sync_logs_tenantId_period_idx" ON "dhis2_sync_logs"("tenantId", "period");

-- AddForeignKey
ALTER TABLE "dhis2_sync_logs" ADD CONSTRAINT "dhis2_sync_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dhis2_sync_logs" ADD CONSTRAINT "dhis2_sync_logs_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
