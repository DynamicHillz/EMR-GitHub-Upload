-- ============================================
-- Billing & Payments Module - Database Schema (SAFE VERSION)
-- ============================================
-- Version: 1.0.1
-- Date: 2025-11-17
-- Description: Creates billing tables with dependency checks
-- ============================================

-- ============================================
-- PREREQUISITE CHECK
-- ============================================

-- Check if required tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Tenant') THEN
        RAISE EXCEPTION 'Table "Tenant" does not exist. Please run the main schema setup first.';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Patient') THEN
        RAISE EXCEPTION 'Table "Patient" does not exist. Please run the main schema setup first.';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
        RAISE EXCEPTION 'Table "User" does not exist. Please run the main schema setup first.';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Invoice') THEN
        RAISE EXCEPTION 'Table "Invoice" does not exist. Please run the main schema setup first.';
    END IF;

    RAISE NOTICE 'All prerequisite tables found. Proceeding with billing schema setup...';
END
$$;

-- ============================================
-- ENUMS
-- ============================================

-- Payment Method Enum
DO $$ BEGIN
    CREATE TYPE "PaymentMethod" AS ENUM (
      'CASH',
      'CARD',
      'BANK_TRANSFER',
      'MOBILE_MONEY',
      'INSURANCE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment Process Status Enum
DO $$ BEGIN
    CREATE TYPE "PaymentProcessStatus" AS ENUM (
      'PENDING',
      'COMPLETED',
      'FAILED',
      'REFUNDED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Refund Status Enum
DO $$ BEGIN
    CREATE TYPE "RefundStatus" AS ENUM (
      'PENDING',
      'APPROVED',
      'REJECTED',
      'COMPLETED',
      'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Service Category Enum
DO $$ BEGIN
    CREATE TYPE "ServiceCategory" AS ENUM (
      'CONSULTATION',
      'LAB_TEST',
      'MEDICATION',
      'PROCEDURE',
      'IMAGING',
      'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment Gateway Enum
DO $$ BEGIN
    CREATE TYPE "PaymentGateway" AS ENUM (
      'FLUTTERWAVE',
      'PAYSTACK',
      'MONIEPOINT',
      'STRIPE',
      'INTERSWITCH',
      'REMITA',
      'PAYPAL',
      'SQUARE',
      'RAZORPAY'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLES
-- ============================================

-- ============================================
-- Service Catalog Table
-- ============================================
CREATE TABLE IF NOT EXISTS "ServiceCatalog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,

  -- Service Details
  "serviceCode" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "description" TEXT,
  "category" "ServiceCategory" NOT NULL,
  "basePrice" DOUBLE PRECISION NOT NULL,
  "taxRate" DOUBLE PRECISION DEFAULT 0,
  "isActive" BOOLEAN DEFAULT true,

  -- Timestamps
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT "ServiceCatalog_tenantId_serviceCode_key" UNIQUE ("tenantId", "serviceCode"),
  CONSTRAINT "ServiceCatalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================
-- Payment Table
-- ============================================
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "processedById" TEXT NOT NULL,

  -- Payment Details
  "paymentNumber" TEXT NOT NULL UNIQUE,
  "paymentDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,

  -- References
  "referenceNumber" TEXT,
  "transactionId" TEXT,

  -- Card Details
  "cardLast4" TEXT,
  "cardBrand" TEXT,

  -- Mobile Money
  "mobileProvider" TEXT,
  "mobileNumber" TEXT,

  -- Gateway Integration
  "gatewayProvider" TEXT,
  "gatewayRef" TEXT,
  "gatewayData" JSONB,
  "gatewayStatus" TEXT,

  -- Status
  "status" "PaymentProcessStatus" DEFAULT 'COMPLETED',

  -- Receipt
  "receiptUrl" TEXT,
  "receiptPrinted" BOOLEAN DEFAULT false,

  -- Timestamps
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================
-- Refund Table
-- ============================================
CREATE TABLE IF NOT EXISTS "Refund" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentId" TEXT,
  "patientId" TEXT NOT NULL,

  -- Refund Details
  "refundNumber" TEXT NOT NULL UNIQUE,
  "amount" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "refundMethod" "PaymentMethod" NOT NULL,

  -- Workflow
  "status" "RefundStatus" DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedById" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "refundDate" TIMESTAMP(3),
  "referenceNumber" TEXT,
  "notes" TEXT,

  -- Timestamps
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Refund_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Refund_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================
-- INDEXES
-- ============================================

-- Indexes for ServiceCatalog
CREATE INDEX IF NOT EXISTS "ServiceCatalog_tenantId_idx" ON "ServiceCatalog"("tenantId");
CREATE INDEX IF NOT EXISTS "ServiceCatalog_category_idx" ON "ServiceCatalog"("category");

-- Indexes for Payment
CREATE INDEX IF NOT EXISTS "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX IF NOT EXISTS "Payment_patientId_idx" ON "Payment"("patientId");
CREATE INDEX IF NOT EXISTS "Payment_paymentDate_idx" ON "Payment"("paymentDate");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");

-- Indexes for Refund
CREATE INDEX IF NOT EXISTS "Refund_tenantId_idx" ON "Refund"("tenantId");
CREATE INDEX IF NOT EXISTS "Refund_invoiceId_idx" ON "Refund"("invoiceId");
CREATE INDEX IF NOT EXISTS "Refund_patientId_idx" ON "Refund"("patientId");
CREATE INDEX IF NOT EXISTS "Refund_status_idx" ON "Refund"("status");

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_ServiceCatalog_updated_at ON "ServiceCatalog";
DROP TRIGGER IF EXISTS update_Payment_updated_at ON "Payment";
DROP TRIGGER IF EXISTS update_Refund_updated_at ON "Refund";

-- Trigger for ServiceCatalog
CREATE TRIGGER update_ServiceCatalog_updated_at
  BEFORE UPDATE ON "ServiceCatalog"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for Payment
CREATE TRIGGER update_Payment_updated_at
  BEFORE UPDATE ON "Payment"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for Refund
CREATE TRIGGER update_Refund_updated_at
  BEFORE UPDATE ON "Refund"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS (Optional - for reporting)
-- ============================================

-- View for Outstanding Invoices with Aging
CREATE OR REPLACE VIEW "OutstandingInvoicesView" AS
SELECT
  i."id" AS "invoiceId",
  i."invoiceNumber",
  i."tenantId",
  i."patientId",
  p."firstName" || ' ' || p."lastName" AS "patientName",
  i."totalAmount",
  i."paidAmount",
  i."balance",
  i."invoiceDate",
  i."dueDate",
  i."status",
  i."paymentStatus",
  CURRENT_DATE - i."dueDate"::date AS "daysOverdue",
  CASE
    WHEN CURRENT_DATE <= i."dueDate"::date THEN 'current'
    WHEN CURRENT_DATE - i."dueDate"::date BETWEEN 1 AND 30 THEN '1_30'
    WHEN CURRENT_DATE - i."dueDate"::date BETWEEN 31 AND 60 THEN '31_60'
    WHEN CURRENT_DATE - i."dueDate"::date BETWEEN 61 AND 90 THEN '61_90'
    ELSE '90_plus'
  END AS "agingBucket"
FROM "Invoice" i
INNER JOIN "Patient" p ON i."patientId" = p."id"
WHERE i."balance" > 0
  AND i."status" != 'CANCELLED';

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE "ServiceCatalog" IS 'Service catalog with configurable pricing for medical services';
COMMENT ON TABLE "Payment" IS 'Payment records with support for multiple payment methods and gateways';
COMMENT ON TABLE "Refund" IS 'Refund requests with three-step approval workflow';

COMMENT ON COLUMN "Payment"."gatewayProvider" IS 'Payment gateway provider (FLUTTERWAVE, PAYSTACK, MONIEPOINT, etc.)';
COMMENT ON COLUMN "Payment"."gatewayRef" IS 'Gateway transaction reference for payment verification';
COMMENT ON COLUMN "Payment"."gatewayData" IS 'Full gateway response data stored as JSON';

COMMENT ON COLUMN "Refund"."status" IS 'Refund workflow status: PENDING → APPROVED/REJECTED → COMPLETED';

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify tables were created
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('ServiceCatalog', 'Payment', 'Refund');

    IF table_count = 3 THEN
        RAISE NOTICE '✓ All 3 billing tables created successfully';
    ELSE
        RAISE WARNING 'Only % of 3 tables were created', table_count;
    END IF;
END
$$;

-- ============================================
-- END OF SCRIPT
-- ============================================

-- Script execution successful!
-- Next steps:
-- 1. Run 'npx prisma generate' to update Prisma client
-- 2. Restart your backend server
-- 3. Test the billing API endpoints
