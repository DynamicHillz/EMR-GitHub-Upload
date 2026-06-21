-- Add fraud prevention and audit trail fields to payments table

-- Proof of payment
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "receiptPhotoUrl" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "proofDocumentUrl" TEXT;

-- Verification & Approval
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "verificationNotes" TEXT;

-- Enhanced audit trail
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "locationData" JSONB;

-- Reconciliation tracking
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reconciledAt" TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reconciledById" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "bankStatementRef" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reconciliationNotes" TEXT;

-- Flags for suspicious activity
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "flaggedForReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "flagReason" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "flaggedAt" TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "flaggedById" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;

-- Create indexes for fraud prevention queries
CREATE INDEX IF NOT EXISTS idx_payments_flagged_review ON payments("tenantId", "flaggedForReview") WHERE "flaggedForReview" = true;
CREATE INDEX IF NOT EXISTS idx_payments_requires_approval ON payments("tenantId", "requiresApproval") WHERE "requiresApproval" = true;
CREATE INDEX IF NOT EXISTS idx_payments_unreconciled ON payments("tenantId", "reconciledAt") WHERE "reconciledAt" IS NULL;

-- Create PaymentAuditAction enum
DO $$ BEGIN
    CREATE TYPE "PaymentAuditAction" AS ENUM (
        'CREATED',
        'UPDATED',
        'APPROVED',
        'REJECTED',
        'FLAGGED',
        'UNFLAGGED',
        'REVIEWED',
        'RECONCILED',
        'RECEIPT_UPLOADED',
        'VOIDED',
        'REFUND_INITIATED',
        'NOTES_ADDED',
        'ACCESSED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create payment_audit_logs table
CREATE TABLE IF NOT EXISTS payment_audit_logs (
    id TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    action "PaymentAuditAction" NOT NULL,

    -- Details of the action
    "previousValues" JSONB,
    "newValues" JSONB,
    "changesSummary" TEXT,

    -- Context
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "locationData" JSONB,

    -- Additional metadata
    metadata JSONB,
    notes TEXT,

    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_payment_audit_tenant FOREIGN KEY ("tenantId") REFERENCES tenants(id),
    CONSTRAINT fk_payment_audit_payment FOREIGN KEY ("paymentId") REFERENCES payments(id),
    CONSTRAINT fk_payment_audit_user FOREIGN KEY ("userId") REFERENCES users(id)
);

-- Create indexes for payment_audit_logs
CREATE INDEX IF NOT EXISTS idx_payment_audit_tenant_payment ON payment_audit_logs("tenantId", "paymentId");
CREATE INDEX IF NOT EXISTS idx_payment_audit_tenant_user ON payment_audit_logs("tenantId", "userId");
CREATE INDEX IF NOT EXISTS idx_payment_audit_tenant_action ON payment_audit_logs("tenantId", action);
CREATE INDEX IF NOT EXISTS idx_payment_audit_tenant_created ON payment_audit_logs("tenantId", "createdAt" DESC);

-- Create fraud_prevention_settings table
CREATE TABLE IF NOT EXISTS fraud_prevention_settings (
    id TEXT PRIMARY KEY,
    "tenantId" TEXT UNIQUE NOT NULL,

    -- Approval thresholds
    "cashApprovalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "bankTransferApprovalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 100000,
    "mobileMoneyApprovalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 75000,

    -- Mandatory fields for manual payments
    "requireReceiptPhotoForCash" BOOLEAN NOT NULL DEFAULT true,
    "requireReferenceForBankTransfer" BOOLEAN NOT NULL DEFAULT true,
    "requireReferenceForMobileMoney" BOOLEAN NOT NULL DEFAULT true,

    -- Duplicate detection settings
    "duplicateDetectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "duplicateTimeWindowMinutes" INT NOT NULL DEFAULT 30,
    "duplicateAmountTolerancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Backdating restrictions
    "allowBackdating" BOOLEAN NOT NULL DEFAULT false,
    "maxBackdatingDays" INT NOT NULL DEFAULT 0,

    -- Daily limits per user
    "enableDailyLimits" BOOLEAN NOT NULL DEFAULT false,
    "dailyCashLimitPerUser" DOUBLE PRECISION,
    "dailyTotalLimitPerUser" DOUBLE PRECISION,

    -- Auto-flagging rules
    "autoFlagLargeAmounts" BOOLEAN NOT NULL DEFAULT true,
    "autoFlagAmountThreshold" DOUBLE PRECISION NOT NULL DEFAULT 200000,
    "autoFlagMultiplePaymentsSameInvoice" BOOLEAN NOT NULL DEFAULT true,
    "autoFlagRoundAmounts" BOOLEAN NOT NULL DEFAULT false,
    "autoFlagOffHoursPayments" BOOLEAN NOT NULL DEFAULT false,

    -- Reconciliation requirements
    "requireDailyReconciliation" BOOLEAN NOT NULL DEFAULT true,
    "reconciliationWindowDays" INT NOT NULL DEFAULT 7,

    -- Business hours for off-hours detection
    "businessHoursStart" TEXT DEFAULT '08:00',
    "businessHoursEnd" TEXT DEFAULT '18:00',

    -- Notifications
    "notifyAdminOnFlaggedPayment" BOOLEAN NOT NULL DEFAULT true,
    "notifyAdminOnLargePayment" BOOLEAN NOT NULL DEFAULT true,

    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT fk_fraud_settings_tenant FOREIGN KEY ("tenantId") REFERENCES tenants(id)
);

-- Insert default fraud prevention settings for existing tenants
INSERT INTO fraud_prevention_settings (id, "tenantId")
SELECT gen_random_uuid()::text, id FROM tenants
ON CONFLICT ("tenantId") DO NOTHING;

COMMENT ON TABLE payment_audit_logs IS 'Comprehensive audit trail for all payment operations - fraud prevention';
COMMENT ON TABLE fraud_prevention_settings IS 'Per-tenant configuration for fraud detection and prevention';
COMMENT ON COLUMN payments."flaggedForReview" IS 'Payment flagged for manual review due to suspicious activity';
COMMENT ON COLUMN payments."requiresApproval" IS 'Payment requires supervisor approval before processing';
COMMENT ON COLUMN payments."reconciledAt" IS 'When payment was matched against bank statement';
