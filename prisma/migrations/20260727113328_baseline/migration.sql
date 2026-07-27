-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "TriageCategory" AS ENUM ('RESUSCITATION', 'EMERGENT', 'URGENT', 'SEMI_URGENT', 'NON_URGENT', 'EMERGENCY', 'PRIORITY', 'QUEUE', 'DEAD');

-- CreateEnum
CREATE TYPE "InsuranceProviderType" AS ENUM ('NHIA', 'HMO', 'PRIVATE');

-- CreateEnum
CREATE TYPE "InsurancePlanType" AS ENUM ('STANDARD', 'COMPREHENSIVE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'DENIED', 'PARTIALLY_APPROVED', 'APPEALED');

-- CreateEnum
CREATE TYPE "ExemptionCriteriaType" AS ENUM ('AGE', 'CONDITION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Genotype" AS ENUM ('AA', 'AS', 'SS', 'AC', 'SC', 'CC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'OTHER');

-- CreateEnum
CREATE TYPE "PatientType" AS ENUM ('PRIVATE', 'HMO');

-- CreateEnum
CREATE TYPE "DiagnosisCertainty" AS ENUM ('CONFIRMED', 'PROVISIONAL', 'DIFFERENTIAL', 'RULED_OUT');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECH', 'PHARMACIST', 'CASHIER', 'RECEPTIONIST');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DECEASED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'DISPENSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TestUrgency" AS ENUM ('ROUTINE', 'URGENT', 'STAT');

-- CreateEnum
CREATE TYPE "LabTestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MedicationStatus" AS ENUM ('ACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK', 'EXPIRED', 'RECALLED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RECALLED', 'DEPLETED');

-- CreateEnum
CREATE TYPE "InteractionSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'WARNING', 'CRITICAL', 'CONTRAINDICATED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'NEAR_EXPIRY', 'EXPIRED', 'REORDER_POINT', 'EXPIRY_WARNING', 'DRUG_INTERACTION', 'ALLERGY_WARNING', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'FINALIZED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED', 'LOCKED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'INSURANCE');

-- CreateEnum
CREATE TYPE "PaymentProcessStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentAuditAction" AS ENUM ('CREATED', 'UPDATED', 'APPROVED', 'REJECTED', 'FLAGGED', 'UNFLAGGED', 'REVIEWED', 'RECONCILED', 'RECEIPT_UPLOADED', 'VOIDED', 'REFUND_INITIATED', 'NOTES_ADDED', 'ACCESSED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('FLUTTERWAVE', 'PAYSTACK', 'MONIEPOINT', 'STRIPE', 'INTERSWITCH', 'REMITA', 'PAYPAL', 'SQUARE', 'RAZORPAY');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('CONSULTATION', 'LAB_TEST', 'MEDICATION', 'PROCEDURE', 'IMAGING', 'ACCOMMODATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "SyncConflictStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "AdministrationRoute" AS ENUM ('ORAL', 'INTRAVENOUS', 'INTRAMUSCULAR', 'SUBCUTANEOUS', 'TOPICAL', 'RECTAL', 'SUBLINGUAL', 'INHALATION', 'OPHTHALMIC', 'OTIC', 'NASAL', 'VAGINAL', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('UNBILLED', 'BILLED');

-- CreateEnum
CREATE TYPE "FluidType" AS ENUM ('INTAKE', 'OUTPUT');

-- CreateEnum
CREATE TYPE "LaborStatus" AS ENUM ('IN_LABOR', 'DELIVERED', 'TRANSFERRED', 'DISCONTINUED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "clinicName" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "licenseNumber" TEXT,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'BASIC',
    "subscriptionStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriptionEnd" TIMESTAMP(3),
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "secondaryColor" TEXT NOT NULL DEFAULT '#10b981',
    "accentColor" TEXT NOT NULL DEFAULT '#f59e0b',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "currencySymbol" TEXT NOT NULL DEFAULT '$',
    "taxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultTaxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxName" TEXT NOT NULL DEFAULT 'VAT',
    "taxId" TEXT,
    "defaultMarkupPercent" DECIMAL(65,30) NOT NULL DEFAULT 40,
    "acceptCash" BOOLEAN NOT NULL DEFAULT true,
    "acceptCard" BOOLEAN NOT NULL DEFAULT true,
    "acceptMobileMoney" BOOLEAN NOT NULL DEFAULT true,
    "acceptBankTransfer" BOOLEAN NOT NULL DEFAULT true,
    "acceptInsurance" BOOLEAN NOT NULL DEFAULT false,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "invoiceStartNumber" INTEGER NOT NULL DEFAULT 1000,
    "invoiceFooterText" TEXT,
    "termsAndConditions" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "swiftCode" TEXT,
    "mobileMoneyProvider" TEXT,
    "mobileMoneyNumber" TEXT,
    "mobileMoneyName" TEXT,
    "paystackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paystackPublicKey" TEXT,
    "paystackSecretKey" TEXT,
    "flutterwaveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "flutterwavePublicKey" TEXT,
    "flutterwaveSecretKey" TEXT,
    "moniepointEnabled" BOOLEAN NOT NULL DEFAULT false,
    "moniepointApiKey" TEXT,
    "moniepointContractCode" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLogin" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "requirePasswordChange" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3),
    "passwordHistory" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletionReason" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "lga" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "nationality" TEXT,
    "occupation" TEXT,
    "maritalStatus" "MaritalStatus",
    "bloodGroup" "BloodGroup",
    "genotype" "Genotype",
    "allergies" TEXT[],
    "chronicConditions" TEXT[],
    "pastSurgicalHistory" TEXT,
    "emergencyContact" JSONB,
    "patientType" "PatientType" NOT NULL DEFAULT 'PRIVATE',
    "hmoProvider" TEXT,
    "hmoNumber" TEXT,
    "nhisNumber" TEXT,
    "photoUrl" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "consentVersion" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "appointmentTime" TEXT NOT NULL,
    "appointmentType" TEXT NOT NULL,
    "reason" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "checkedInAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "reminderSent24h" BOOLEAN NOT NULL DEFAULT false,
    "reminderSent2h" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "bloodPressure" TEXT,
    "systolicBP" INTEGER,
    "diastolicBP" INTEGER,
    "heartRate" INTEGER,
    "temperature" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "spO2" INTEGER,
    "bmi" DOUBLE PRECISION,
    "icd10Codes" TEXT,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'UNBILLED',
    "finalizedAt" TIMESTAMP(3),
    "consultationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationId" TEXT,
    "doctorId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OUTPATIENT',
    "medicationId" TEXT,
    "medicationName" TEXT NOT NULL,
    "route" "AdministrationRoute" NOT NULL DEFAULT 'ORAL',
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "instructions" TEXT,
    "quantity" INTEGER,
    "quantityUnit" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "refillsAllowed" INTEGER NOT NULL DEFAULT 0,
    "refillCount" INTEGER NOT NULL DEFAULT 0,
    "originalPrescriptionId" TEXT,
    "isControlledSubstance" BOOLEAN NOT NULL DEFAULT false,
    "scheduleClass" TEXT,
    "dispensedAt" TIMESTAMP(3),
    "dispensedBy" TEXT,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'PENDING',
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'UNBILLED',
    "allergyWarning" BOOLEAN NOT NULL DEFAULT false,
    "interactionWarning" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "admissionId" TEXT,
    "ancVisitId" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_tests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "loincCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_parameters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "refRangeMale" TEXT,
    "refRangeFemale" TEXT,
    "refRangeNotes" TEXT,
    "needsClinicalReview" BOOLEAN NOT NULL DEFAULT false,
    "loincCode" TEXT,
    "deltaCheckPercentage" DOUBLE PRECISION,

    CONSTRAINT "lab_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_reference_ranges" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "minAgeDays" INTEGER,
    "maxAgeDays" INTEGER,
    "gender" TEXT,
    "minNumeric" DOUBLE PRECISION,
    "maxNumeric" DOUBLE PRECISION,
    "textRange" TEXT,

    CONSTRAINT "lab_reference_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_parameters" (
    "testId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "lab_test_parameters_pkey" PRIMARY KEY ("testId","parameterId")
);

-- CreateTable
CREATE TABLE "imaging_tests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "imaging_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imaging_results" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "imagingTestId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "images" TEXT[],
    "reportedBy" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imaging_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationId" TEXT,
    "admissionId" TEXT,
    "orderedById" TEXT NOT NULL,
    "orderNumber" TEXT,
    "urgency" "TestUrgency" NOT NULL DEFAULT 'ROUTINE',
    "clinicalNotes" TEXT,
    "status" "LabTestStatus" NOT NULL DEFAULT 'PENDING',
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'UNBILLED',
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "accessionNumber" TEXT,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "specimenType" TEXT,
    "specimenQuality" TEXT,
    "collectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "status" "LabTestStatus" NOT NULL DEFAULT 'PENDING',
    "reportUrl" TEXT,
    "reportGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "lab_test_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_result_values" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '3ffae4f7-d90b-4d2a-b67e-0f98d35fde70',
    "testRecordId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "jsonValue" JSONB,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "flagType" TEXT,
    "hasDeltaAlert" BOOLEAN NOT NULL DEFAULT false,
    "deltaAlertNotes" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_result_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "brandName" TEXT,
    "activeIngredient" TEXT,
    "category" TEXT,
    "dosageForm" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "drugClass" TEXT,
    "rxcui" TEXT,
    "stockLevel" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 10,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "isControlledSubstance" BOOLEAN NOT NULL DEFAULT false,
    "scheduleClass" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletionReason" TEXT,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "supplier" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "status" "BatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletionReason" TEXT,

    CONSTRAINT "medication_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispensing_records" (
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
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletionReason" TEXT,

    CONSTRAINT "dispensing_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drug_interactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "drug1" TEXT NOT NULL,
    "drug2" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "clinicalEffect" TEXT,
    "management" TEXT,
    "source" TEXT,
    "lastVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drug_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "batchId" TEXT,
    "alertType" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "consumables" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "description" TEXT,
    "stockLevel" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 10,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumableId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "supplier" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "status" "BatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumable_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_usage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumableId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "admissionId" TEXT,
    "consultationId" TEXT,
    "quantityUsed" INTEGER NOT NULL,
    "notes" TEXT,
    "flowRateLpm" DOUBLE PRECISION,
    "deliveryMethod" TEXT,
    "spO2Before" INTEGER,
    "spO2After" INTEGER,
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'UNBILLED',
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumable_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" "PaymentMethod",
    "paymentDate" TIMESTAMP(3),
    "paymentReference" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "insuranceCoverage" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "patientOutOfPocket" DECIMAL(12,2) NOT NULL,
    "consultationId" TEXT,
    "prescriptionId" TEXT,
    "labOrderId" TEXT,
    "admissionId" TEXT,
    "consumableUsageId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_providers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InsuranceProviderType" NOT NULL,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_insurance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "groupNumber" TEXT,
    "planType" "InsurancePlanType" NOT NULL DEFAULT 'STANDARD',
    "copayPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_insurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_claims" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "amountClaimed" DECIMAL(12,2) NOT NULL,
    "amountApproved" DECIMAL(12,2),
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "adjudicatedAt" TIMESTAMP(3),
    "denialReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exemption_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteriaType" "ExemptionCriteriaType" NOT NULL,
    "criteriaValue" TEXT NOT NULL,
    "discountPercentage" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exemption_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "processedById" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "referenceNumber" TEXT,
    "transactionId" TEXT,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "mobileProvider" TEXT,
    "mobileNumber" TEXT,
    "status" "PaymentProcessStatus" NOT NULL DEFAULT 'COMPLETED',
    "gatewayProvider" TEXT,
    "gatewayRef" TEXT,
    "gatewayData" JSONB,
    "gatewayStatus" TEXT,
    "receiptUrl" TEXT,
    "receiptPrinted" BOOLEAN NOT NULL DEFAULT false,
    "receiptPhotoUrl" TEXT,
    "proofDocumentUrl" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "locationData" JSONB,
    "reconciledAt" TIMESTAMP(3),
    "reconciledById" TEXT,
    "bankStatementRef" TEXT,
    "reconciliationNotes" TEXT,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "flaggedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletionReason" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "patientId" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "refundMethod" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "PaymentAuditAction" NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB,
    "changesSummary" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "locationData" JSONB,
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_prevention_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cashApprovalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "bankTransferApprovalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 100000,
    "mobileMoneyApprovalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 75000,
    "refundAutoApproveThreshold" DOUBLE PRECISION,
    "requireReceiptPhotoForCash" BOOLEAN NOT NULL DEFAULT true,
    "requireReferenceForBankTransfer" BOOLEAN NOT NULL DEFAULT true,
    "requireReferenceForMobileMoney" BOOLEAN NOT NULL DEFAULT true,
    "duplicateDetectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "duplicateTimeWindowMinutes" INTEGER NOT NULL DEFAULT 30,
    "duplicateAmountTolerancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowBackdating" BOOLEAN NOT NULL DEFAULT false,
    "maxBackdatingDays" INTEGER NOT NULL DEFAULT 0,
    "enableDailyLimits" BOOLEAN NOT NULL DEFAULT false,
    "dailyCashLimitPerUser" DOUBLE PRECISION,
    "dailyTotalLimitPerUser" DOUBLE PRECISION,
    "autoFlagLargeAmounts" BOOLEAN NOT NULL DEFAULT true,
    "autoFlagAmountThreshold" DOUBLE PRECISION NOT NULL DEFAULT 200000,
    "autoFlagMultiplePaymentsSameInvoice" BOOLEAN NOT NULL DEFAULT true,
    "autoFlagRoundAmounts" BOOLEAN NOT NULL DEFAULT false,
    "autoFlagOffHoursPayments" BOOLEAN NOT NULL DEFAULT false,
    "requireDailyReconciliation" BOOLEAN NOT NULL DEFAULT true,
    "reconciliationWindowDays" INTEGER NOT NULL DEFAULT 7,
    "businessHoursStart" TEXT DEFAULT '08:00',
    "businessHoursEnd" TEXT DEFAULT '18:00',
    "notifyAdminOnFlaggedPayment" BOOLEAN NOT NULL DEFAULT true,
    "notifyAdminOnLargePayment" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_prevention_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "description" TEXT,
    "category" "ServiceCategory" NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_devices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "pendingChanges" INTEGER NOT NULL DEFAULT 0,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_queue" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" "SyncOperation" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "payload" TEXT NOT NULL,
    "checksum" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "conflictDetected" BOOLEAN NOT NULL DEFAULT false,
    "conflictResolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "syncQueueId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "localPayload" JSONB NOT NULL,
    "serverPayload" JSONB NOT NULL,
    "localVersion" INTEGER NOT NULL,
    "serverVersion" INTEGER NOT NULL,
    "status" "SyncConflictStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValues" TEXT,
    "newValues" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" "ServiceCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "dailyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "bedNumber" TEXT NOT NULL,
    "type" TEXT,
    "isolationReady" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "admittedById" TEXT NOT NULL,
    "admissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargeDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ADMITTED',
    "billingStatus" TEXT NOT NULL DEFAULT 'UNBILLED',
    "admissionType" TEXT NOT NULL DEFAULT 'MEDICAL',
    "showOperationNote" BOOLEAN NOT NULL DEFAULT false,
    "showPartograph" BOOLEAN NOT NULL DEFAULT false,
    "isolationRequired" BOOLEAN NOT NULL DEFAULT false,
    "infectionRisk" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_rounds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "conductedById" TEXT NOT NULL,
    "roundDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL,
    "vitals" JSONB,
    "plan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "ward_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_administrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "prescriptionId" TEXT,
    "administeredById" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "route" TEXT,
    "administeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "omissionReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_administrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_charts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperature" DOUBLE PRECISION,
    "systolicBP" INTEGER,
    "diastolicBP" INTEGER,
    "heartRate" INTEGER,
    "respiratoryRate" INTEGER,
    "spO2" INTEGER,
    "painScore" INTEGER,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "headCircumference" DOUBLE PRECISION,
    "muac" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "vital_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fluid_charts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "FluidType" NOT NULL,
    "route" TEXT NOT NULL,
    "fluidName" TEXT,
    "volumeMl" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "fluid_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfusion_charts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "transfusedById" TEXT NOT NULL,
    "bloodGroup" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "preVitals" JSONB,
    "duringVitals" JSONB,
    "postVitals" JSONB,
    "reaction" BOOLEAN NOT NULL DEFAULT false,
    "reactionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "transfusion_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_sugar_charts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloodGlucose" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'mg/dL',
    "measurementContext" TEXT,
    "insulinGiven" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "blood_sugar_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_diagnoses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isAdmission" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discharge_summaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "finalNotes" TEXT NOT NULL,
    "followUpPlan" TEXT,
    "ttoMedications" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "discharge_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_transfer_history" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "fromBedId" TEXT NOT NULL,
    "toBedId" TEXT NOT NULL,
    "transferredById" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,

    CONSTRAINT "bed_transfer_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "surgicalProcedure" TEXT NOT NULL,
    "indication" TEXT,
    "surgeons" TEXT NOT NULL,
    "assistants" TEXT,
    "anaesthetics" TEXT,
    "anaesthetist" TEXT,
    "anaesthesis" TEXT,
    "incision" TEXT,
    "findings" TEXT,
    "procedure" TEXT,
    "plan" TEXT,
    "others" TEXT,
    "operationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "operation_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosis_catalog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'ICD-11',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnosis_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_diagnoses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "certainty" "DiagnosisCertainty" NOT NULL DEFAULT 'PROVISIONAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "triage_assessments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "chiefComplaint" TEXT NOT NULL,
    "category" "TriageCategory" NOT NULL,
    "triageNurseId" TEXT NOT NULL,
    "triageTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "systolicBP" INTEGER,
    "diastolicBP" INTEGER,
    "heartRate" INTEGER,
    "temperature" DOUBLE PRECISION,
    "respiratoryRate" INTEGER,
    "spO2" INTEGER,
    "weight" DOUBLE PRECISION,
    "painScore" INTEGER,
    "glucoseLevel" DOUBLE PRECISION,
    "consciousnessLevel" TEXT,
    "muac" DOUBLE PRECISION,
    "isDehydrated" BOOLEAN,
    "dispositionNotes" TEXT,
    "seenByDoctorAt" TIMESTAMP(3),
    "waitingTimeMinutes" INTEGER,
    "retriagedAt" TIMESTAMP(3),
    "retriagedById" TEXT,
    "previousCategory" "TriageCategory",
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "triage_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_allergies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "allergen" TEXT NOT NULL,
    "reactionType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "onsetDate" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "patient_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "next_of_kin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "altPhone" TEXT,
    "address" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "next_of_kin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anc_pregnancies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "gravidity" INTEGER NOT NULL,
    "parity" INTEGER NOT NULL,
    "lmp" TIMESTAMP(3),
    "edd" TIMESTAMP(3),
    "bloodGroup" "BloodGroup",
    "husbandBloodGroup" TEXT,
    "livingChildren" INTEGER NOT NULL DEFAULT 0,
    "abortionsMiscarriages" INTEGER NOT NULL DEFAULT 0,
    "historyOfCSection" BOOLEAN NOT NULL DEFAULT false,
    "historyOfPPH" BOOLEAN NOT NULL DEFAULT false,
    "historyOfPreEclampsia" BOOLEAN NOT NULL DEFAULT false,
    "historyOfStillbirth" BOOLEAN NOT NULL DEFAULT false,
    "preExistingDiabetes" BOOLEAN NOT NULL DEFAULT false,
    "preExistingHypertension" BOOLEAN NOT NULL DEFAULT false,
    "cardiacDisease" BOOLEAN NOT NULL DEFAULT false,
    "multipleGestation" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deliveryDate" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anc_pregnancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anc_visits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pregnancyId" TEXT NOT NULL,
    "consultationId" TEXT,
    "recordedById" TEXT NOT NULL,
    "gestationalAgeWeeks" INTEGER,
    "weight" DOUBLE PRECISION,
    "systolicBP" INTEGER,
    "diastolicBP" INTEGER,
    "fundalHeight" DOUBLE PRECISION,
    "fetalHeartRate" INTEGER,
    "presentation" TEXT,
    "urineProtein" TEXT,
    "ironFolicAcidProvided" BOOLEAN NOT NULL DEFAULT false,
    "calciumProvided" BOOLEAN NOT NULL DEFAULT false,
    "itnProvided" BOOLEAN NOT NULL DEFAULT false,
    "iptpDose" INTEGER,
    "ttDosesToDate" INTEGER,
    "ttDoseGivenToday" BOOLEAN NOT NULL DEFAULT false,
    "syphilisTestResult" TEXT,
    "hivTestResult" TEXT,
    "hepBTestResult" TEXT,
    "malariaRdtResult" TEXT,
    "ultrasoundDone" BOOLEAN NOT NULL DEFAULT false,
    "counselingDone" BOOLEAN NOT NULL DEFAULT false,
    "counseledOnDangerSigns" BOOLEAN NOT NULL DEFAULT false,
    "birthPreparednessPlanDiscussed" BOOLEAN NOT NULL DEFAULT false,
    "intimatePartnerViolenceScreening" BOOLEAN NOT NULL DEFAULT false,
    "dewormingProvided" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "others" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anc_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "pregnancyId" TEXT,
    "startedById" TEXT NOT NULL,
    "laborOnsetAt" TIMESTAMP(3) NOT NULL,
    "onsetType" TEXT,
    "activePhaseOnsetAt" TIMESTAMP(3),
    "romAt" TIMESTAMP(3),
    "romType" TEXT,
    "liquorAtRom" TEXT,
    "status" "LaborStatus" NOT NULL DEFAULT 'IN_LABOR',
    "deliveredAt" TIMESTAMP(3),
    "deliveredById" TEXT,
    "modeOfDelivery" TEXT,
    "perineumStatus" TEXT,
    "estimatedBloodLossMl" INTEGER,
    "babyOutcome" TEXT,
    "babySex" "Gender",
    "babyBirthWeightGrams" INTEGER,
    "apgarScore1Min" INTEGER,
    "apgarScore5Min" INTEGER,
    "resuscitationRequired" BOOLEAN NOT NULL DEFAULT false,
    "deliveryNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "labor_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partograph_observations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "laborRecordId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cervicalDilation" INTEGER,
    "fetalHeartRate" INTEGER,
    "descentOfHead" TEXT,
    "liquor" TEXT,
    "moulding" TEXT,
    "contractionsFrequencyPer10Min" INTEGER,
    "contractionsDurationSeconds" INTEGER,
    "maternalPulse" INTEGER,
    "maternalSystolicBP" INTEGER,
    "maternalDiastolicBP" INTEGER,
    "maternalTemperature" DOUBLE PRECISION,
    "urineProtein" TEXT,
    "urineAcetone" TEXT,
    "urineVolumeMl" INTEGER,
    "oxytocinDose" TEXT,
    "drugsGiven" TEXT,
    "ivFluids" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "partograph_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "immunization_schedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "diseaseTarget" TEXT NOT NULL,
    "targetAgeWeeks" INTEGER NOT NULL,
    "route" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "immunization_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_immunizations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "administeredById" TEXT NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchNumber" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "notes" TEXT,
    "hasAdverseReaction" BOOLEAN NOT NULL DEFAULT false,
    "reactionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_immunizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "patients_tenantId_lastName_firstName_idx" ON "patients"("tenantId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "patients_tenantId_status_idx" ON "patients"("tenantId", "status");

-- CreateIndex
CREATE INDEX "patients_firstName_idx" ON "patients" USING GIN ("firstName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "patients_lastName_idx" ON "patients" USING GIN ("lastName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "patients_patientId_idx" ON "patients" USING GIN ("patientId" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients" USING GIN ("phone" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "patients_tenantId_patientId_key" ON "patients"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_tenantId_phone_key" ON "patients"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "appointments_tenantId_appointmentDate_doctorId_idx" ON "appointments"("tenantId", "appointmentDate", "doctorId");

-- CreateIndex
CREATE INDEX "consultations_tenantId_patientId_idx" ON "consultations"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "consultations_tenantId_consultationDate_idx" ON "consultations"("tenantId", "consultationDate");

-- CreateIndex
CREATE INDEX "prescriptions_tenantId_patientId_idx" ON "prescriptions"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "prescriptions_tenantId_status_idx" ON "prescriptions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "prescriptions_tenantId_status_createdAt_idx" ON "prescriptions"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "lab_orders_orderNumber_key" ON "lab_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "lab_orders_tenantId_patientId_idx" ON "lab_orders"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "lab_orders_tenantId_status_idx" ON "lab_orders"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_records_accessionNumber_key" ON "lab_test_records"("accessionNumber");

-- CreateIndex
CREATE INDEX "lab_test_records_tenantId_orderId_idx" ON "lab_test_records"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "lab_test_records_tenantId_status_idx" ON "lab_test_records"("tenantId", "status");

-- CreateIndex
CREATE INDEX "lab_result_values_tenantId_idx" ON "lab_result_values"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_result_values_testRecordId_parameterId_key" ON "lab_result_values"("testRecordId", "parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_tenantId_name_key" ON "inventory_categories"("tenantId", "name");

-- CreateIndex
CREATE INDEX "medications_tenantId_name_idx" ON "medications"("tenantId", "name");

-- CreateIndex
CREATE INDEX "medications_tenantId_activeIngredient_idx" ON "medications"("tenantId", "activeIngredient");

-- CreateIndex
CREATE INDEX "medications_tenantId_drugClass_idx" ON "medications"("tenantId", "drugClass");

-- CreateIndex
CREATE INDEX "medication_batches_tenantId_expiryDate_idx" ON "medication_batches"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "medication_batches_tenantId_medicationId_status_idx" ON "medication_batches"("tenantId", "medicationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "medication_batches_tenantId_medicationId_batchNumber_key" ON "medication_batches"("tenantId", "medicationId", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "dispensing_records_prescriptionId_key" ON "dispensing_records"("prescriptionId");

-- CreateIndex
CREATE INDEX "dispensing_records_tenantId_dispensedAt_idx" ON "dispensing_records"("tenantId", "dispensedAt");

-- CreateIndex
CREATE INDEX "dispensing_records_tenantId_pharmacistId_idx" ON "dispensing_records"("tenantId", "pharmacistId");

-- CreateIndex
CREATE INDEX "drug_interactions_drug1_idx" ON "drug_interactions"("drug1");

-- CreateIndex
CREATE INDEX "drug_interactions_drug2_idx" ON "drug_interactions"("drug2");

-- CreateIndex
CREATE INDEX "drug_interactions_tenantId_idx" ON "drug_interactions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "drug_interactions_drug1_drug2_key" ON "drug_interactions"("drug1", "drug2");

-- CreateIndex
CREATE INDEX "stock_alerts_tenantId_status_alertType_idx" ON "stock_alerts"("tenantId", "status", "alertType");

-- CreateIndex
CREATE INDEX "stock_alerts_tenantId_createdAt_idx" ON "stock_alerts"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "consumables_tenantId_name_idx" ON "consumables"("tenantId", "name");

-- CreateIndex
CREATE INDEX "consumable_batches_tenantId_expiryDate_idx" ON "consumable_batches"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "consumable_batches_tenantId_consumableId_status_idx" ON "consumable_batches"("tenantId", "consumableId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consumable_batches_tenantId_consumableId_batchNumber_key" ON "consumable_batches"("tenantId", "consumableId", "batchNumber");

-- CreateIndex
CREATE INDEX "consumable_usage_tenantId_patientId_idx" ON "consumable_usage"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "consumable_usage_tenantId_billingStatus_idx" ON "consumable_usage"("tenantId", "billingStatus");

-- CreateIndex
CREATE INDEX "invoices_tenantId_patientId_idx" ON "invoices"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "invoices_tenantId_status_idx" ON "invoices"("tenantId", "status");

-- CreateIndex
CREATE INDEX "invoices_tenantId_paymentStatus_idx" ON "invoices"("tenantId", "paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenantId_invoiceNumber_key" ON "invoices"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_audit_logs_tenantId_invoiceId_idx" ON "invoice_audit_logs"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "invoice_audit_logs_tenantId_createdAt_idx" ON "invoice_audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "insurance_providers_tenantId_type_idx" ON "insurance_providers"("tenantId", "type");

-- CreateIndex
CREATE INDEX "patient_insurance_patientId_providerId_idx" ON "patient_insurance"("patientId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_claims_invoiceId_key" ON "insurance_claims"("invoiceId");

-- CreateIndex
CREATE INDEX "insurance_claims_tenantId_status_idx" ON "insurance_claims"("tenantId", "status");

-- CreateIndex
CREATE INDEX "exemption_policies_tenantId_isActive_idx" ON "exemption_policies"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "payments_tenantId_invoiceId_idx" ON "payments"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "payments_tenantId_patientId_idx" ON "payments"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "payments_tenantId_paymentDate_idx" ON "payments"("tenantId", "paymentDate");

-- CreateIndex
CREATE INDEX "payments_tenantId_flaggedForReview_idx" ON "payments"("tenantId", "flaggedForReview");

-- CreateIndex
CREATE INDEX "payments_tenantId_requiresApproval_idx" ON "payments"("tenantId", "requiresApproval");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenantId_paymentNumber_key" ON "payments"("tenantId", "paymentNumber");

-- CreateIndex
CREATE INDEX "refunds_tenantId_status_idx" ON "refunds"("tenantId", "status");

-- CreateIndex
CREATE INDEX "refunds_tenantId_invoiceId_idx" ON "refunds"("tenantId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_tenantId_refundNumber_key" ON "refunds"("tenantId", "refundNumber");

-- CreateIndex
CREATE INDEX "payment_audit_logs_tenantId_paymentId_idx" ON "payment_audit_logs"("tenantId", "paymentId");

-- CreateIndex
CREATE INDEX "payment_audit_logs_tenantId_userId_idx" ON "payment_audit_logs"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "payment_audit_logs_tenantId_action_idx" ON "payment_audit_logs"("tenantId", "action");

-- CreateIndex
CREATE INDEX "payment_audit_logs_tenantId_createdAt_idx" ON "payment_audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "fraud_prevention_settings_tenantId_key" ON "fraud_prevention_settings"("tenantId");

-- CreateIndex
CREATE INDEX "service_catalog_tenantId_category_idx" ON "service_catalog"("tenantId", "category");

-- CreateIndex
CREATE INDEX "service_catalog_tenantId_isActive_idx" ON "service_catalog"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_tenantId_serviceCode_key" ON "service_catalog"("tenantId", "serviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "sync_devices_deviceToken_key" ON "sync_devices"("deviceToken");

-- CreateIndex
CREATE UNIQUE INDEX "sync_devices_tenantId_deviceId_key" ON "sync_devices"("tenantId", "deviceId");

-- CreateIndex
CREATE INDEX "sync_queue_deviceId_status_idx" ON "sync_queue"("deviceId", "status");

-- CreateIndex
CREATE INDEX "sync_queue_priority_createdAt_idx" ON "sync_queue"("priority", "createdAt");

-- CreateIndex
CREATE INDEX "sync_conflicts_tenantId_status_idx" ON "sync_conflicts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "sync_conflicts_tenantId_entityType_entityId_idx" ON "sync_conflicts"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_timestamp_idx" ON "audit_logs"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entityType_entityId_idx" ON "audit_logs"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "wards_tenantId_type_idx" ON "wards"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "beds_wardId_bedNumber_key" ON "beds"("wardId", "bedNumber");

-- CreateIndex
CREATE INDEX "admissions_tenantId_patientId_idx" ON "admissions"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "admissions_tenantId_status_idx" ON "admissions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ward_rounds_tenantId_admissionId_idx" ON "ward_rounds"("tenantId", "admissionId");

-- CreateIndex
CREATE INDEX "medication_administrations_tenantId_admissionId_idx" ON "medication_administrations"("tenantId", "admissionId");

-- CreateIndex
CREATE INDEX "vital_charts_tenantId_admissionId_idx" ON "vital_charts"("tenantId", "admissionId");

-- CreateIndex
CREATE INDEX "vital_charts_tenantId_recordedAt_idx" ON "vital_charts"("tenantId", "recordedAt");

-- CreateIndex
CREATE INDEX "fluid_charts_tenantId_admissionId_idx" ON "fluid_charts"("tenantId", "admissionId");

-- CreateIndex
CREATE INDEX "fluid_charts_tenantId_recordedAt_idx" ON "fluid_charts"("tenantId", "recordedAt");

-- CreateIndex
CREATE INDEX "transfusion_charts_tenantId_admissionId_idx" ON "transfusion_charts"("tenantId", "admissionId");

-- CreateIndex
CREATE INDEX "blood_sugar_charts_tenantId_admissionId_idx" ON "blood_sugar_charts"("tenantId", "admissionId");

-- CreateIndex
CREATE INDEX "blood_sugar_charts_tenantId_recordedAt_idx" ON "blood_sugar_charts"("tenantId", "recordedAt");

-- CreateIndex
CREATE INDEX "admission_diagnoses_tenantId_admissionId_idx" ON "admission_diagnoses"("tenantId", "admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "discharge_summaries_admissionId_key" ON "discharge_summaries"("admissionId");

-- CreateIndex
CREATE INDEX "discharge_summaries_tenantId_idx" ON "discharge_summaries"("tenantId");

-- CreateIndex
CREATE INDEX "bed_transfer_history_tenantId_admissionId_idx" ON "bed_transfer_history"("tenantId", "admissionId");

-- CreateIndex
CREATE INDEX "operation_notes_tenantId_admissionId_idx" ON "operation_notes"("tenantId", "admissionId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_userId_isRead_idx" ON "notifications"("tenantId", "userId", "isRead");

-- CreateIndex
CREATE INDEX "diagnosis_catalog_name_idx" ON "diagnosis_catalog"("name");

-- CreateIndex
CREATE INDEX "diagnosis_catalog_code_idx" ON "diagnosis_catalog"("code");

-- CreateIndex
CREATE UNIQUE INDEX "diagnosis_catalog_tenantId_code_key" ON "diagnosis_catalog"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_diagnoses_consultationId_diagnosisId_key" ON "consultation_diagnoses"("consultationId", "diagnosisId");

-- CreateIndex
CREATE INDEX "triage_assessments_tenantId_createdAt_idx" ON "triage_assessments"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "triage_assessments_tenantId_category_idx" ON "triage_assessments"("tenantId", "category");

-- CreateIndex
CREATE INDEX "patient_allergies_tenantId_patientId_idx" ON "patient_allergies"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "next_of_kin_tenantId_patientId_idx" ON "next_of_kin"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "next_of_kin_tenantId_patientId_priority_key" ON "next_of_kin"("tenantId", "patientId", "priority");

-- CreateIndex
CREATE INDEX "anc_pregnancies_tenantId_patientId_idx" ON "anc_pregnancies"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "anc_pregnancies_tenantId_isActive_idx" ON "anc_pregnancies"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "anc_visits_consultationId_key" ON "anc_visits"("consultationId");

-- CreateIndex
CREATE INDEX "anc_visits_tenantId_pregnancyId_idx" ON "anc_visits"("tenantId", "pregnancyId");

-- CreateIndex
CREATE UNIQUE INDEX "labor_records_admissionId_key" ON "labor_records"("admissionId");

-- CreateIndex
CREATE INDEX "labor_records_tenantId_status_idx" ON "labor_records"("tenantId", "status");

-- CreateIndex
CREATE INDEX "labor_records_tenantId_patientId_idx" ON "labor_records"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "partograph_observations_tenantId_laborRecordId_idx" ON "partograph_observations"("tenantId", "laborRecordId");

-- CreateIndex
CREATE INDEX "partograph_observations_tenantId_recordedAt_idx" ON "partograph_observations"("tenantId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "immunization_schedule_tenantId_vaccineName_key" ON "immunization_schedule"("tenantId", "vaccineName");

-- CreateIndex
CREATE INDEX "patient_immunizations_tenantId_patientId_idx" ON "patient_immunizations"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_immunizations_patientId_scheduleId_key" ON "patient_immunizations"("patientId", "scheduleId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "medications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_ancVisitId_fkey" FOREIGN KEY ("ancVisitId") REFERENCES "anc_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_parameters" ADD CONSTRAINT "lab_parameters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_reference_ranges" ADD CONSTRAINT "lab_reference_ranges_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "lab_parameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_parameters" ADD CONSTRAINT "lab_test_parameters_testId_fkey" FOREIGN KEY ("testId") REFERENCES "lab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_parameters" ADD CONSTRAINT "lab_test_parameters_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "lab_parameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_tests" ADD CONSTRAINT "imaging_tests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_results" ADD CONSTRAINT "imaging_results_imagingTestId_fkey" FOREIGN KEY ("imagingTestId") REFERENCES "imaging_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_results" ADD CONSTRAINT "imaging_results_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_results" ADD CONSTRAINT "imaging_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_results" ADD CONSTRAINT "imaging_results_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_records" ADD CONSTRAINT "lab_test_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_records" ADD CONSTRAINT "lab_test_records_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_records" ADD CONSTRAINT "lab_test_records_testId_fkey" FOREIGN KEY ("testId") REFERENCES "lab_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_records" ADD CONSTRAINT "lab_test_records_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_values" ADD CONSTRAINT "lab_result_values_testRecordId_fkey" FOREIGN KEY ("testRecordId") REFERENCES "lab_test_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_values" ADD CONSTRAINT "lab_result_values_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "lab_parameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_values" ADD CONSTRAINT "lab_result_values_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_batches" ADD CONSTRAINT "medication_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_batches" ADD CONSTRAINT "medication_batches_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "medications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispensing_records" ADD CONSTRAINT "dispensing_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispensing_records" ADD CONSTRAINT "dispensing_records_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispensing_records" ADD CONSTRAINT "dispensing_records_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "medication_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispensing_records" ADD CONSTRAINT "dispensing_records_pharmacistId_fkey" FOREIGN KEY ("pharmacistId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_interactions" ADD CONSTRAINT "drug_interactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "medications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "medication_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_batches" ADD CONSTRAINT "consumable_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_batches" ADD CONSTRAINT "consumable_batches_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "consumables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage" ADD CONSTRAINT "consumable_usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage" ADD CONSTRAINT "consumable_usage_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "consumables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage" ADD CONSTRAINT "consumable_usage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "consumable_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage" ADD CONSTRAINT "consumable_usage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage" ADD CONSTRAINT "consumable_usage_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage" ADD CONSTRAINT "consumable_usage_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage" ADD CONSTRAINT "consumable_usage_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_consumableUsageId_fkey" FOREIGN KEY ("consumableUsageId") REFERENCES "consumable_usage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_audit_logs" ADD CONSTRAINT "invoice_audit_logs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_providers" ADD CONSTRAINT "insurance_providers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurance" ADD CONSTRAINT "patient_insurance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurance" ADD CONSTRAINT "patient_insurance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurance" ADD CONSTRAINT "patient_insurance_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "insurance_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurance_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exemption_policies" ADD CONSTRAINT "exemption_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_audit_logs" ADD CONSTRAINT "payment_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_audit_logs" ADD CONSTRAINT "payment_audit_logs_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_audit_logs" ADD CONSTRAINT "payment_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_prevention_settings" ADD CONSTRAINT "fraud_prevention_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_devices" ADD CONSTRAINT "sync_devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "sync_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "sync_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_syncQueueId_fkey" FOREIGN KEY ("syncQueueId") REFERENCES "sync_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_admittedById_fkey" FOREIGN KEY ("admittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_rounds" ADD CONSTRAINT "ward_rounds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_rounds" ADD CONSTRAINT "ward_rounds_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_rounds" ADD CONSTRAINT "ward_rounds_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_charts" ADD CONSTRAINT "vital_charts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_charts" ADD CONSTRAINT "vital_charts_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_charts" ADD CONSTRAINT "vital_charts_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fluid_charts" ADD CONSTRAINT "fluid_charts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fluid_charts" ADD CONSTRAINT "fluid_charts_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fluid_charts" ADD CONSTRAINT "fluid_charts_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfusion_charts" ADD CONSTRAINT "transfusion_charts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfusion_charts" ADD CONSTRAINT "transfusion_charts_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfusion_charts" ADD CONSTRAINT "transfusion_charts_transfusedById_fkey" FOREIGN KEY ("transfusedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_sugar_charts" ADD CONSTRAINT "blood_sugar_charts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_sugar_charts" ADD CONSTRAINT "blood_sugar_charts_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_sugar_charts" ADD CONSTRAINT "blood_sugar_charts_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_diagnoses" ADD CONSTRAINT "admission_diagnoses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_diagnoses" ADD CONSTRAINT "admission_diagnoses_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_diagnoses" ADD CONSTRAINT "admission_diagnoses_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "diagnosis_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfer_history" ADD CONSTRAINT "bed_transfer_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfer_history" ADD CONSTRAINT "bed_transfer_history_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfer_history" ADD CONSTRAINT "bed_transfer_history_fromBedId_fkey" FOREIGN KEY ("fromBedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfer_history" ADD CONSTRAINT "bed_transfer_history_toBedId_fkey" FOREIGN KEY ("toBedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfer_history" ADD CONSTRAINT "bed_transfer_history_transferredById_fkey" FOREIGN KEY ("transferredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_notes" ADD CONSTRAINT "operation_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_notes" ADD CONSTRAINT "operation_notes_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_notes" ADD CONSTRAINT "operation_notes_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_catalog" ADD CONSTRAINT "diagnosis_catalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_diagnoses" ADD CONSTRAINT "consultation_diagnoses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_diagnoses" ADD CONSTRAINT "consultation_diagnoses_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_diagnoses" ADD CONSTRAINT "consultation_diagnoses_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "diagnosis_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triage_assessments" ADD CONSTRAINT "triage_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triage_assessments" ADD CONSTRAINT "triage_assessments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triage_assessments" ADD CONSTRAINT "triage_assessments_triageNurseId_fkey" FOREIGN KEY ("triageNurseId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_allergies" ADD CONSTRAINT "patient_allergies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_allergies" ADD CONSTRAINT "patient_allergies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "next_of_kin" ADD CONSTRAINT "next_of_kin_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "next_of_kin" ADD CONSTRAINT "next_of_kin_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anc_pregnancies" ADD CONSTRAINT "anc_pregnancies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anc_pregnancies" ADD CONSTRAINT "anc_pregnancies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anc_visits" ADD CONSTRAINT "anc_visits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anc_visits" ADD CONSTRAINT "anc_visits_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "anc_pregnancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anc_visits" ADD CONSTRAINT "anc_visits_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anc_visits" ADD CONSTRAINT "anc_visits_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_records" ADD CONSTRAINT "labor_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_records" ADD CONSTRAINT "labor_records_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_records" ADD CONSTRAINT "labor_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_records" ADD CONSTRAINT "labor_records_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "anc_pregnancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_records" ADD CONSTRAINT "labor_records_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_records" ADD CONSTRAINT "labor_records_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partograph_observations" ADD CONSTRAINT "partograph_observations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partograph_observations" ADD CONSTRAINT "partograph_observations_laborRecordId_fkey" FOREIGN KEY ("laborRecordId") REFERENCES "labor_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partograph_observations" ADD CONSTRAINT "partograph_observations_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunization_schedule" ADD CONSTRAINT "immunization_schedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_immunizations" ADD CONSTRAINT "patient_immunizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_immunizations" ADD CONSTRAINT "patient_immunizations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_immunizations" ADD CONSTRAINT "patient_immunizations_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "immunization_schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_immunizations" ADD CONSTRAINT "patient_immunizations_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

