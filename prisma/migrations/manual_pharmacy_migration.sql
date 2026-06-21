-- Manual Migration for Pharmacy Management Module
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Create New Enums
-- ============================================

-- Batch Status Enum
CREATE TYPE "BatchStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DEPLETED', 'RECALLED');

-- Drug Interaction Severity Enum
CREATE TYPE "InteractionSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'SEVERE');

-- Alert Type Enum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'NEAR_EXPIRY', 'EXPIRED', 'REORDER_POINT');

-- Alert Severity Enum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- Alert Status Enum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- ============================================
-- STEP 2: Modify Existing Medication Table
-- ============================================

-- Add new columns to medications table
ALTER TABLE "medications"
  ADD COLUMN IF NOT EXISTS "activeIngredient" TEXT,
  ADD COLUMN IF NOT EXISTS "drugClass" TEXT,
  ADD COLUMN IF NOT EXISTS "rxcui" TEXT;

-- Remove old single-batch tracking columns (if they exist)
-- Note: Only run these if the columns exist and have no data you need to preserve
-- ALTER TABLE "medications" DROP COLUMN IF EXISTS "batchNumber";
-- ALTER TABLE "medications" DROP COLUMN IF EXISTS "expiryDate";
-- ALTER TABLE "medications" DROP COLUMN IF EXISTS "supplier";

-- Create new indexes on medications
CREATE INDEX IF NOT EXISTS "medications_tenantId_activeIngredient_idx" ON "medications"("tenantId", "activeIngredient");
CREATE INDEX IF NOT EXISTS "medications_tenantId_drugClass_idx" ON "medications"("tenantId", "drugClass");

-- ============================================
-- STEP 3: Create MedicationBatch Table
-- ============================================

CREATE TABLE IF NOT EXISTS "medication_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "supplier" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "status" "BatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_batches_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
ALTER TABLE "medication_batches"
  ADD CONSTRAINT "medication_batches_tenantId_medicationId_batchNumber_key"
  UNIQUE ("tenantId", "medicationId", "batchNumber");

-- Create indexes
CREATE INDEX IF NOT EXISTS "medication_batches_tenantId_expiryDate_idx" ON "medication_batches"("tenantId", "expiryDate");
CREATE INDEX IF NOT EXISTS "medication_batches_tenantId_medicationId_status_idx" ON "medication_batches"("tenantId", "medicationId", "status");

-- Add foreign key constraints
ALTER TABLE "medication_batches"
  ADD CONSTRAINT "medication_batches_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_batches"
  ADD CONSTRAINT "medication_batches_medicationId_fkey"
  FOREIGN KEY ("medicationId") REFERENCES "medications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- STEP 4: Create DispensingRecord Table
-- ============================================

CREATE TABLE IF NOT EXISTS "dispensing_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "pharmacistId" TEXT NOT NULL,
    "quantityDispensed" INTEGER NOT NULL,
    "dispensedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "labelGenerated" BOOLEAN NOT NULL DEFAULT false,
    "labelUrl" TEXT,
    "pharmacistNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispensing_records_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on prescriptionId
ALTER TABLE "dispensing_records"
  ADD CONSTRAINT "dispensing_records_prescriptionId_key"
  UNIQUE ("prescriptionId");

-- Create indexes
CREATE INDEX IF NOT EXISTS "dispensing_records_tenantId_dispensedAt_idx" ON "dispensing_records"("tenantId", "dispensedAt");
CREATE INDEX IF NOT EXISTS "dispensing_records_tenantId_pharmacistId_idx" ON "dispensing_records"("tenantId", "pharmacistId");

-- Add foreign key constraints
ALTER TABLE "dispensing_records"
  ADD CONSTRAINT "dispensing_records_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dispensing_records"
  ADD CONSTRAINT "dispensing_records_prescriptionId_fkey"
  FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dispensing_records"
  ADD CONSTRAINT "dispensing_records_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "medication_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dispensing_records"
  ADD CONSTRAINT "dispensing_records_pharmacistId_fkey"
  FOREIGN KEY ("pharmacistId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- STEP 5: Create DrugInteraction Table
-- ============================================

CREATE TABLE IF NOT EXISTS "drug_interactions" (
    "id" TEXT NOT NULL,
    "drug1" TEXT NOT NULL,
    "drug2" TEXT NOT NULL,
    "severity" "InteractionSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "clinicalEffect" TEXT,
    "management" TEXT,
    "source" TEXT,
    "lastVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drug_interactions_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
ALTER TABLE "drug_interactions"
  ADD CONSTRAINT "drug_interactions_drug1_drug2_key"
  UNIQUE ("drug1", "drug2");

-- Create indexes
CREATE INDEX IF NOT EXISTS "drug_interactions_drug1_idx" ON "drug_interactions"("drug1");
CREATE INDEX IF NOT EXISTS "drug_interactions_drug2_idx" ON "drug_interactions"("drug2");

-- ============================================
-- STEP 6: Create StockAlert Table
-- ============================================

CREATE TABLE IF NOT EXISTS "stock_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "batchId" TEXT,
    "alertType" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "threshold" INTEGER,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "stock_alerts_tenantId_status_alertType_idx" ON "stock_alerts"("tenantId", "status", "alertType");
CREATE INDEX IF NOT EXISTS "stock_alerts_tenantId_createdAt_idx" ON "stock_alerts"("tenantId", "createdAt");

-- Add foreign key constraints
ALTER TABLE "stock_alerts"
  ADD CONSTRAINT "stock_alerts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_alerts"
  ADD CONSTRAINT "stock_alerts_medicationId_fkey"
  FOREIGN KEY ("medicationId") REFERENCES "medications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_alerts"
  ADD CONSTRAINT "stock_alerts_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "medication_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- STEP 7: Update Prescriptions Table
-- ============================================

-- Add index on prescriptions for pharmacy queue queries
CREATE INDEX IF NOT EXISTS "prescriptions_tenantId_status_createdAt_idx" ON "prescriptions"("tenantId", "status", "createdAt");

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify tables were created
SELECT
  'medication_batches' as table_name,
  COUNT(*) as exists
FROM information_schema.tables
WHERE table_name = 'medication_batches'
UNION ALL
SELECT
  'dispensing_records',
  COUNT(*)
FROM information_schema.tables
WHERE table_name = 'dispensing_records'
UNION ALL
SELECT
  'drug_interactions',
  COUNT(*)
FROM information_schema.tables
WHERE table_name = 'drug_interactions'
UNION ALL
SELECT
  'stock_alerts',
  COUNT(*)
FROM information_schema.tables
WHERE table_name = 'stock_alerts';
