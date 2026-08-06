-- CreateEnum
CREATE TYPE "PncContactType" AS ENUM ('PNC_24H', 'PNC_DAY3', 'PNC_WEEK1', 'PNC_WEEK6', 'OTHER');

-- AlterTable
ALTER TABLE "discharge_summaries" ADD COLUMN     "breastfeedingCounselingDone" BOOLEAN,
ADD COLUMN     "familyPlanningMethodDiscussed" TEXT,
ADD COLUMN     "maternalConditionAtDischarge" TEXT,
ADD COLUMN     "newbornConditionAtDischarge" TEXT,
ADD COLUMN     "newbornDangerSignsCounseled" BOOLEAN,
ADD COLUMN     "postnatalFollowUpDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "labor_records" ADD COLUMN     "newbornPatientId" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "motherPatientId" TEXT;

-- CreateTable
CREATE TABLE "postnatal_visits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "pregnancyId" TEXT,
    "contactType" "PncContactType" NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "maternalTemperature" DOUBLE PRECISION,
    "maternalSystolicBP" INTEGER,
    "maternalDiastolicBP" INTEGER,
    "lochiaStatus" TEXT,
    "uterineInvolutionNormal" BOOLEAN,
    "perinealWoundStatus" TEXT,
    "breastfeedingStatus" TEXT,
    "moodScreeningConcern" BOOLEAN,
    "newbornWeightGrams" INTEGER,
    "newbornTemperature" DOUBLE PRECISION,
    "newbornFeedingWell" BOOLEAN,
    "cordConditionNormal" BOOLEAN,
    "jaundiceObserved" BOOLEAN,
    "newbornDangerSigns" TEXT[],
    "familyPlanningCounselingDone" BOOLEAN,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "postnatal_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "postnatal_visits_tenantId_patientId_idx" ON "postnatal_visits"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "postnatal_visits_tenantId_pregnancyId_idx" ON "postnatal_visits"("tenantId", "pregnancyId");

-- CreateIndex
CREATE UNIQUE INDEX "labor_records_newbornPatientId_key" ON "labor_records"("newbornPatientId");

-- CreateIndex
CREATE INDEX "patients_tenantId_motherPatientId_idx" ON "patients"("tenantId", "motherPatientId");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_motherPatientId_fkey" FOREIGN KEY ("motherPatientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_records" ADD CONSTRAINT "labor_records_newbornPatientId_fkey" FOREIGN KEY ("newbornPatientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postnatal_visits" ADD CONSTRAINT "postnatal_visits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postnatal_visits" ADD CONSTRAINT "postnatal_visits_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postnatal_visits" ADD CONSTRAINT "postnatal_visits_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "anc_pregnancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postnatal_visits" ADD CONSTRAINT "postnatal_visits_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "diagnosis_code_mappings_sourceSystem_sourceCode_targetSyst_key" RENAME TO "diagnosis_code_mappings_sourceSystem_sourceCode_targetSyste_key";

