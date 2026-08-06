-- CreateEnum
CREATE TYPE "MaternalDischargeCondition" AS ENUM ('STABLE', 'GUARDED', 'CRITICAL', 'TRANSFERRED', 'DECEASED');

-- CreateEnum
CREATE TYPE "NewbornDischargeCondition" AS ENUM ('STABLE', 'GUARDED', 'CRITICAL', 'TRANSFERRED', 'DECEASED');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WorklistType" AS ENUM ('IMMUNIZATION_DUE', 'POSTNATAL_DUE');

-- CreateEnum
CREATE TYPE "WorklistDismissalReason" AS ENUM ('GIVEN_ELSEWHERE', 'DECLINED', 'TRANSFERRED_OUT', 'DECEASED', 'OTHER');

-- AlterTable
ALTER TABLE "discharge_summaries" ADD COLUMN     "maternalConditionNotes" TEXT,
ADD COLUMN     "newbornConditionNotes" TEXT,
DROP COLUMN "maternalConditionAtDischarge",
ADD COLUMN     "maternalConditionAtDischarge" "MaternalDischargeCondition",
DROP COLUMN "newbornConditionAtDischarge",
ADD COLUMN     "newbornConditionAtDischarge" "NewbornDischargeCondition";

-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "postnatalVisitId" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedById" TEXT,
ADD COLUMN     "severity" "NotificationSeverity" NOT NULL DEFAULT 'WARNING';

-- AlterTable
ALTER TABLE "postnatal_visits" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "billingStatus" "BillingStatus" NOT NULL DEFAULT 'UNBILLED';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "dhis2DataElementLiveBirths" TEXT,
ADD COLUMN     "dhis2DataElementSeverePostpartumHemorrhage" TEXT;

-- CreateTable
CREATE TABLE "worklist_dismissals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "worklistType" "WorklistType" NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "pregnancyId" TEXT,
    "contactType" "PncContactType",
    "reason" "WorklistDismissalReason" NOT NULL,
    "reasonNotes" TEXT,
    "dismissedById" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worklist_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "worklist_dismissals_tenantId_worklistType_patientId_idx" ON "worklist_dismissals"("tenantId", "worklistType", "patientId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_userId_severity_isRead_idx" ON "notifications"("tenantId", "userId", "severity", "isRead");

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_postnatalVisitId_fkey" FOREIGN KEY ("postnatalVisitId") REFERENCES "postnatal_visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postnatal_visits" ADD CONSTRAINT "postnatal_visits_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worklist_dismissals" ADD CONSTRAINT "worklist_dismissals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worklist_dismissals" ADD CONSTRAINT "worklist_dismissals_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worklist_dismissals" ADD CONSTRAINT "worklist_dismissals_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

