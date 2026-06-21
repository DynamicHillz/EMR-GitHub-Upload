-- ============================================
-- COMPLETE EMR DATABASE SCHEMA
-- ============================================
-- Version: 1.0
-- Date: 2025-11-17
-- Description: Complete database schema including all base tables and billing module
-- ============================================

-- ============================================
-- STEP 1: CREATE ALL ENUMS
-- ============================================

-- User Roles
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECHNICIAN', 'ACCOUNTANT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Gender
DO $$ BEGIN
    CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Marital Status
DO $$ BEGIN
    CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Consultation Status
DO $$ BEGIN
    CREATE TYPE "ConsultationStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Appointment Status
DO $$ BEGIN
    CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Prescription Status
DO $$ BEGIN
    CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'DISPENSED', 'PARTIALLY_DISPENSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Invoice Status
DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Payment Status
DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Billing Module Enums
DO $$ BEGIN
    CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'INSURANCE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentProcessStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "ServiceCategory" AS ENUM ('CONSULTATION', 'LAB_TEST', 'MEDICATION', 'PROCEDURE', 'IMAGING', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentGateway" AS ENUM ('FLUTTERWAVE', 'PAYSTACK', 'MONIEPOINT', 'STRIPE', 'INTERSWITCH', 'REMITA', 'PAYPAL', 'SQUARE', 'RAZORPAY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================
-- STEP 2: CREATE BASE TABLES
-- ============================================

-- Tenant Table
CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "slug" TEXT UNIQUE NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "logo" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- User Table
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "role" "UserRole" NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_email_tenantId_key" UNIQUE ("email", "tenantId"),
  CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Patient Table
CREATE TABLE IF NOT EXISTS "Patient" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "patientNumber" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "middleName" TEXT,
  "dateOfBirth" TIMESTAMP(3) NOT NULL,
  "gender" "Gender" NOT NULL,
  "email" TEXT,
  "phone" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT DEFAULT 'Nigeria',
  "occupation" TEXT,
  "maritalStatus" "MaritalStatus",
  "bloodGroup" TEXT,
  "allergies" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "emergencyContactRelationship" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Patient_patientNumber_tenantId_key" UNIQUE ("patientNumber", "tenantId"),
  CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Consultation Table
CREATE TABLE IF NOT EXISTS "Consultation" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "consultationDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "chiefComplaint" TEXT NOT NULL,
  "historyOfPresentingComplaint" TEXT,
  "diagnosis" TEXT,
  "treatment" TEXT,
  "notes" TEXT,
  "status" "ConsultationStatus" DEFAULT 'IN_PROGRESS',
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Consultation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Consultation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Consultation_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Invoice Table
CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL UNIQUE,
  "invoiceDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tax" DOUBLE PRECISION DEFAULT 0,
  "discount" DOUBLE PRECISION DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAmount" DOUBLE PRECISION DEFAULT 0,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "InvoiceStatus" DEFAULT 'DRAFT',
  "paymentStatus" "PaymentStatus" DEFAULT 'UNPAID',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Invoice Line Items Table
CREATE TABLE IF NOT EXISTS "InvoiceLineItem" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "tax" DOUBLE PRECISION DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- STEP 3: CREATE BILLING MODULE TABLES
-- ============================================

-- Service Catalog Table
CREATE TABLE IF NOT EXISTS "ServiceCatalog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "serviceCode" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "description" TEXT,
  "category" "ServiceCategory" NOT NULL,
  "basePrice" DOUBLE PRECISION NOT NULL,
  "taxRate" DOUBLE PRECISION DEFAULT 0,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceCatalog_tenantId_serviceCode_key" UNIQUE ("tenantId", "serviceCode"),
  CONSTRAINT "ServiceCatalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Payment Table
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "processedById" TEXT NOT NULL,
  "paymentNumber" TEXT NOT NULL UNIQUE,
  "paymentDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "referenceNumber" TEXT,
  "transactionId" TEXT,
  "cardLast4" TEXT,
  "cardBrand" TEXT,
  "mobileProvider" TEXT,
  "mobileNumber" TEXT,
  "gatewayProvider" TEXT,
  "gatewayRef" TEXT,
  "gatewayData" JSONB,
  "gatewayStatus" TEXT,
  "status" "PaymentProcessStatus" DEFAULT 'COMPLETED',
  "receiptUrl" TEXT,
  "receiptPrinted" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Refund Table
CREATE TABLE IF NOT EXISTS "Refund" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentId" TEXT,
  "patientId" TEXT NOT NULL,
  "refundNumber" TEXT NOT NULL UNIQUE,
  "amount" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "refundMethod" "PaymentMethod" NOT NULL,
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
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Refund_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Refund_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================
-- STEP 4: CREATE INDEXES
-- ============================================

-- User Indexes
CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- Patient Indexes
CREATE INDEX IF NOT EXISTS "Patient_tenantId_idx" ON "Patient"("tenantId");
CREATE INDEX IF NOT EXISTS "Patient_patientNumber_idx" ON "Patient"("patientNumber");

-- Consultation Indexes
CREATE INDEX IF NOT EXISTS "Consultation_tenantId_idx" ON "Consultation"("tenantId");
CREATE INDEX IF NOT EXISTS "Consultation_patientId_idx" ON "Consultation"("patientId");
CREATE INDEX IF NOT EXISTS "Consultation_doctorId_idx" ON "Consultation"("doctorId");

-- Invoice Indexes
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_idx" ON "Invoice"("tenantId");
CREATE INDEX IF NOT EXISTS "Invoice_patientId_idx" ON "Invoice"("patientId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");

-- ServiceCatalog Indexes
CREATE INDEX IF NOT EXISTS "ServiceCatalog_tenantId_idx" ON "ServiceCatalog"("tenantId");
CREATE INDEX IF NOT EXISTS "ServiceCatalog_category_idx" ON "ServiceCatalog"("category");

-- Payment Indexes
CREATE INDEX IF NOT EXISTS "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX IF NOT EXISTS "Payment_patientId_idx" ON "Payment"("patientId");
CREATE INDEX IF NOT EXISTS "Payment_paymentDate_idx" ON "Payment"("paymentDate");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");

-- Refund Indexes
CREATE INDEX IF NOT EXISTS "Refund_tenantId_idx" ON "Refund"("tenantId");
CREATE INDEX IF NOT EXISTS "Refund_invoiceId_idx" ON "Refund"("invoiceId");
CREATE INDEX IF NOT EXISTS "Refund_patientId_idx" ON "Refund"("patientId");
CREATE INDEX IF NOT EXISTS "Refund_status_idx" ON "Refund"("status");

-- ============================================
-- STEP 5: CREATE TRIGGERS
-- ============================================

-- Function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop all existing triggers
DROP TRIGGER IF EXISTS update_Tenant_updated_at ON "Tenant";
DROP TRIGGER IF EXISTS update_User_updated_at ON "User";
DROP TRIGGER IF EXISTS update_Patient_updated_at ON "Patient";
DROP TRIGGER IF EXISTS update_Consultation_updated_at ON "Consultation";
DROP TRIGGER IF EXISTS update_Invoice_updated_at ON "Invoice";
DROP TRIGGER IF EXISTS update_ServiceCatalog_updated_at ON "ServiceCatalog";
DROP TRIGGER IF EXISTS update_Payment_updated_at ON "Payment";
DROP TRIGGER IF EXISTS update_Refund_updated_at ON "Refund";

-- Create triggers
CREATE TRIGGER update_Tenant_updated_at BEFORE UPDATE ON "Tenant" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_User_updated_at BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Patient_updated_at BEFORE UPDATE ON "Patient" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Consultation_updated_at BEFORE UPDATE ON "Consultation" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Invoice_updated_at BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ServiceCatalog_updated_at BEFORE UPDATE ON "ServiceCatalog" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Payment_updated_at BEFORE UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Refund_updated_at BEFORE UPDATE ON "Refund" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 6: CREATE VIEWS
-- ============================================

-- Outstanding Invoices View with Aging
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
-- STEP 7: VERIFICATION
-- ============================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('Tenant', 'User', 'Patient', 'Consultation', 'Invoice', 'InvoiceLineItem', 'ServiceCatalog', 'Payment', 'Refund');

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database Schema Setup Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables created: %/9', table_count;
    RAISE NOTICE '✓ Base tables: Tenant, User, Patient, Consultation, Invoice, InvoiceLineItem';
    RAISE NOTICE '✓ Billing tables: ServiceCatalog, Payment, Refund';
    RAISE NOTICE '========================================';
END
$$;

-- ============================================
-- END OF SCRIPT
-- ============================================
