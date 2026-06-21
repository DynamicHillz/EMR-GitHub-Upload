-- ============================================
-- Billing & Payments Module - Database Schema
-- ============================================
-- Version: 1.0
-- Date: 2025-11-17
-- Description: Creates all tables, enums, and indexes for the billing module
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- Payment Method Enum
CREATE TYPE "PaymentMethod" AS ENUM (
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'MOBILE_MONEY',
  'INSURANCE'
);

-- Payment Process Status Enum
CREATE TYPE "PaymentProcessStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED'
);

-- Refund Status Enum
CREATE TYPE "RefundStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED'
);

-- Service Category Enum
CREATE TYPE "ServiceCategory" AS ENUM (
  'CONSULTATION',
  'LAB_TEST',
  'MEDICATION',
  'PROCEDURE',
  'IMAGING',
  'OTHER'
);

-- Payment Gateway Enum
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

-- ============================================
-- TABLES
-- ============================================

-- ============================================
-- Service Catalog Table
-- ============================================
CREATE TABLE "ServiceCatalog" (
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

-- Indexes for ServiceCatalog
CREATE INDEX "ServiceCatalog_tenantId_idx" ON "ServiceCatalog"("tenantId");
CREATE INDEX "ServiceCatalog_category_idx" ON "ServiceCatalog"("category");

-- ============================================
-- Payment Table
-- ============================================
CREATE TABLE "Payment" (
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

-- Indexes for Payment
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_patientId_idx" ON "Payment"("patientId");
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- ============================================
-- Refund Table
-- ============================================
CREATE TABLE "Refund" (
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

-- Indexes for Refund
CREATE INDEX "Refund_tenantId_idx" ON "Refund"("tenantId");
CREATE INDEX "Refund_invoiceId_idx" ON "Refund"("invoiceId");
CREATE INDEX "Refund_patientId_idx" ON "Refund"("patientId");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

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
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment to insert sample service catalog items
/*
INSERT INTO "ServiceCatalog" ("tenantId", "serviceCode", "serviceName", "description", "category", "basePrice", "taxRate")
VALUES
  ('your-tenant-id', 'CONSULT-001', 'General Consultation', 'General medical consultation', 'CONSULTATION', 5000, 7.5),
  ('your-tenant-id', 'LAB-001', 'Blood Test', 'Complete blood count test', 'LAB_TEST', 3000, 7.5),
  ('your-tenant-id', 'XRAY-001', 'Chest X-Ray', 'Chest X-Ray imaging', 'IMAGING', 8000, 7.5),
  ('your-tenant-id', 'MED-001', 'Paracetamol', 'Pain relief medication', 'MEDICATION', 500, 7.5);
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if tables were created
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('ServiceCatalog', 'Payment', 'Refund');

-- Check if enums were created
-- SELECT typname FROM pg_type WHERE typname IN ('PaymentMethod', 'PaymentProcessStatus', 'RefundStatus', 'ServiceCategory', 'PaymentGateway');

-- Check indexes
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('ServiceCatalog', 'Payment', 'Refund');

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================

-- Uncomment to drop all billing tables and enums
/*
DROP VIEW IF EXISTS "OutstandingInvoicesView";
DROP TRIGGER IF EXISTS update_ServiceCatalog_updated_at ON "ServiceCatalog";
DROP TRIGGER IF EXISTS update_Payment_updated_at ON "Payment";
DROP TRIGGER IF EXISTS update_Refund_updated_at ON "Refund";
DROP TABLE IF EXISTS "Refund" CASCADE;
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "ServiceCatalog" CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TYPE IF EXISTS "PaymentGateway";
DROP TYPE IF EXISTS "ServiceCategory";
DROP TYPE IF EXISTS "RefundStatus";
DROP TYPE IF EXISTS "PaymentProcessStatus";
DROP TYPE IF EXISTS "PaymentMethod";
*/

-- ============================================
-- END OF SCRIPT
-- ============================================

-- Script execution successful!
-- Next steps:
-- 1. Run this script in your Supabase SQL editor
-- 2. Run 'npx prisma generate' to update Prisma client
-- 3. Restart your backend server
-- 4. Test the billing API endpoints
