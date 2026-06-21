# Fraud Prevention Setup - Quick Start

## ✅ Installation Complete

The fraud prevention system has been successfully installed on your database. All existing tenants now have default fraud prevention settings.

## What Was Added

### Database Changes
1. **27 new fields** added to `payments` table for fraud prevention
2. **`payment_audit_logs`** table created - stores every action on payments
3. **`fraud_prevention_settings`** table created - per-tenant configuration
4. **Indexes** created for fast queries on flagged/pending payments

### Default Settings (All Tenants)

```
Approval Thresholds:
  ✓ Cash: ₦50,000
  ✓ Bank Transfer: ₦100,000
  ✓ Mobile Money: ₦75,000

Mandatory Fields:
  ✓ Receipt photo required for cash payments
  ✓ Reference number required for bank transfers
  ✓ Reference number required for mobile money

Detection Features:
  ✓ Duplicate detection: Enabled (30-minute window)
  ✓ Auto-flag large amounts: Enabled (>₦200,000)
  ✓ Auto-flag multiple payments same invoice: Enabled
  ✓ Round amount detection: Disabled
  ✓ Off-hours detection: Disabled

Reconciliation:
  ✓ Daily reconciliation required: Enabled
  ✓ Reconciliation window: 7 days

Business Hours:
  ✓ Start: 08:00
  ✓ End: 18:00
```

## How It Works

### For Regular Staff (Recording Payments)

1. **Recording Cash Payment:**
   - Enter payment details as usual
   - **NEW**: System now captures IP address and device info automatically
   - **NEW**: If cash payment, upload receipt photo (required)
   - **NEW**: If amount > ₦50,000, payment goes to "Pending Approval"

2. **Recording Bank Transfer:**
   - Enter payment details
   - **NEW**: Must enter bank reference number (required)
   - **NEW**: Can upload bank slip as proof
   - **NEW**: If amount > ₦100,000, requires supervisor approval

3. **Recording Mobile Money:**
   - Enter payment details
   - **NEW**: Must enter transaction ID (required)
   - **NEW**: If amount > ₦75,000, requires supervisor approval

### For Supervisors

1. **Approving Large Payments:**
   - View "Pending Approvals" dashboard
   - Review payment details and uploaded receipts
   - Approve or reject with notes

2. **Reviewing Flagged Payments:**
   - View "Flagged for Review" dashboard
   - Investigate suspicious payments
   - Clear flag after verification or escalate

3. **Manual Flagging:**
   - Can flag any payment for review
   - Provide reason
   - Payment requires investigation before processing

### For Finance/Cashier

1. **Daily Reconciliation:**
   - View "Unreconciled Payments" report
   - Match with bank statements
   - Mark each payment as reconciled with bank reference
   - Investigate unmatched payments

## API Changes

### Recording Payment - New Optional Fields

```json
{
  "invoiceId": "inv-123",
  "amount": 150000,
  "paymentMethod": "CASH",

  // NEW: Fraud prevention fields (optional)
  "receiptPhotoUrl": "https://storage/receipt-photo.jpg",
  "proofDocumentUrl": "https://storage/bank-slip.pdf",
  "notes": "Payment received"
}

// System automatically captures:
// - ipAddress (from request)
// - userAgent (from request headers)
// - deviceId (from client if provided)
```

Response includes new fields:
```json
{
  "id": "pay-123",
  "amount": 150000,
  "status": "COMPLETED",

  // NEW: Fraud prevention status
  "requiresApproval": false,  // true if needs supervisor approval
  "flaggedForReview": false,  // true if flagged as suspicious
  "approvedById": null,
  "approvedAt": null,
  "reconciledAt": null,
  "ipAddress": "192.168.1.100",
  "receiptPhotoUrl": "https://..."
}
```

### New API Endpoints

```typescript
// Approve a payment (supervisors only)
POST /api/billing/payments/:id/approve
Body: { verificationNotes: "Receipt verified" }

// Flag a payment for review
POST /api/billing/payments/:id/flag
Body: { flagReason: "Unusually large cash payment" }

// Unflag a payment (clear the flag)
POST /api/billing/payments/:id/unflag
Body: { reviewNotes: "Verified with patient, legitimate" }

// Reconcile a payment
POST /api/billing/payments/:id/reconcile
Body: {
  "bankStatementRef": "TXN-20260212-001",
  "reconciliationNotes": "Matched with bank deposit"
}

// Get payments requiring approval
GET /api/billing/payments/pending-approval?tenantId=clinic-001

// Get flagged payments
GET /api/billing/payments/flagged?tenantId=clinic-001

// Get unreconciled payments
GET /api/billing/payments/unreconciled?tenantId=clinic-001

// Get payment audit trail
GET /api/billing/payments/:id/audit-logs

// Get/update fraud prevention settings
GET /api/billing/fraud-settings?tenantId=clinic-001
PUT /api/billing/fraud-settings
Body: { cashApprovalThreshold: 75000, ... }
```

## Customization

### Adjusting Thresholds

To change approval thresholds for your tenant:

```sql
-- Via SQL
UPDATE fraud_prevention_settings
SET "cashApprovalThreshold" = 75000,
    "bankTransferApprovalThreshold" = 150000
WHERE "tenantId" = 'your-tenant-id';

-- Or via Prisma in backend
await prisma.fraudPreventionSettings.update({
  where: { tenantId: 'your-tenant-id' },
  data: {
    cashApprovalThreshold: 75000,
    bankTransferApprovalThreshold: 150000
  }
});
```

### Enabling/Disabling Features

```sql
UPDATE fraud_prevention_settings
SET "requireReceiptPhotoForCash" = true,      -- Make receipt photos mandatory
    "duplicateDetectionEnabled" = true,        -- Enable duplicate detection
    "autoFlagRoundAmounts" = true,            -- Flag round amounts
    "autoFlagOffHoursPayments" = true,        -- Flag off-hours payments
    "allowBackdating" = false,                -- Prevent backdating
    "maxBackdatingDays" = 0                   -- Max days for backdating
WHERE "tenantId" = 'your-tenant-id';
```

## Viewing Current Settings

```sql
-- See current fraud prevention settings
SELECT * FROM fraud_prevention_settings
WHERE "tenantId" = 'your-tenant-id';
```

## Testing the System

### 1. Test Small Payment (No Approval Required)
```bash
# Record a payment for ₦5,000 (below threshold)
POST /api/billing/payments
{ "amount": 5000, "paymentMethod": "CASH" }

# Should complete immediately without approval
# Check response: requiresApproval = false
```

### 2. Test Large Payment (Approval Required)
```bash
# Record a payment for ₦100,000 (above threshold)
POST /api/billing/payments
{ "amount": 100000, "paymentMethod": "CASH" }

# Should be pending approval
# Check response: requiresApproval = true
```

### 3. Test Duplicate Detection
```bash
# Record a payment
POST /api/billing/payments
{ "invoiceId": "inv-123", "amount": 25000 }

# Try recording same payment again within 30 minutes
POST /api/billing/payments
{ "invoiceId": "inv-123", "amount": 25000 }

# Should be flagged as possible duplicate
# Check response: flaggedForReview = true
```

### 4. Test Audit Logging
```bash
# Record a payment
POST /api/billing/payments -> returns payment ID

# Check audit log
GET /api/billing/payments/{id}/audit-logs

# Should show "CREATED" action with IP, device info
```

## Monitoring & Reports

### Key Metrics to Monitor

1. **Pending Approvals Count**
   - How many payments awaiting approval
   - Alert if > 10 payments pending

2. **Flagged Payments Count**
   - How many payments flagged for review
   - Investigate promptly

3. **Unreconciled Payments**
   - Payments not matched with bank statements
   - Should be close to zero after daily reconciliation

4. **Approval Rate**
   - % of payments that required approval
   - Adjust thresholds if too high/low

5. **Flag Rate**
   - % of payments flagged by system
   - Fine-tune rules if too many false positives

## Migration Notes

### For Existing Payments

- All existing payments in the database continue to work normally
- New fraud prevention fields are NULL for old payments
- Only new payments will have fraud prevention data
- No impact on existing payment workflows

### Backward Compatibility

- All existing API endpoints work unchanged
- New fields are optional in requests
- New fields are always returned in responses (with null values for old data)
- Frontend can be updated gradually to support new features

## Next Steps

1. **Update Frontend:**
   - Add receipt photo upload component
   - Create pending approvals dashboard for supervisors
   - Create flagged payments review screen
   - Add reconciliation interface

2. **Configure Per Tenant:**
   - Adjust thresholds based on clinic size
   - Enable/disable features as needed
   - Set business hours correctly

3. **Train Staff:**
   - Explain new receipt requirements
   - Show supervisors approval workflow
   - Train finance staff on reconciliation

4. **Monitor & Adjust:**
   - Review flagged payments
   - Check false positive rate
   - Adjust thresholds and rules

## Support

For help with fraud prevention features:
- **Full Guide**: See [FRAUD_PREVENTION_GUIDE.md](FRAUD_PREVENTION_GUIDE.md)
- **Architecture**: See [CLAUDE.md](../CLAUDE.md)
- **Issues**: Report bugs or request features

## Summary

✅ **Fraud Prevention System Active**
✅ **Default Settings Applied to All Tenants**
✅ **Backend Ready** - All new fields and tables created
⏳ **Frontend Pending** - UI components need to be built
⏳ **API Endpoints Pending** - Need to implement approve/flag/reconcile endpoints
