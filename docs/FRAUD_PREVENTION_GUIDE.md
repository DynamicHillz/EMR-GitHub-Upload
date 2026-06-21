# Fraud Prevention System - Complete Guide

## Overview

The fraud prevention system provides comprehensive measures to prevent and detect fraudulent payment recording activities. It addresses the risk of staff recording payments that were never actually received.

## Key Features

### 1. **Enhanced Audit Trail**
Every payment is tracked with detailed information:
- **Who**: User ID, name, and role
- **When**: Precise timestamp
- **Where**: IP address, device ID, browser/device information
- **What Changed**: Before and after values for all modifications

### 2. **Receipt & Proof Requirements**
- **Receipt Photos**: Staff must upload photos of physical receipts for cash payments
- **Proof Documents**: Bank slips, mobile money confirmations, etc.
- **Reference Numbers**: Mandatory for bank transfers and mobile money

### 3. **Approval Workflow**
- **Automatic Triggers**: Payments above configurable thresholds require supervisor approval
- **Default Thresholds**:
  - Cash: ₦50,000
  - Bank Transfer: ₦100,000
  - Mobile Money: ₦75,000
- **Approval Process**: Payment is created but flagged as "requiresApproval" until supervisor reviews and approves

### 4. **Duplicate Detection**
- **Time Window**: System checks for similar payments within 30 minutes (configurable)
- **Amount Matching**: Exact or tolerance-based matching
- **Auto-Flagging**: Duplicate payments are automatically flagged for review

### 5. **Automatic Fraud Detection**
Payments are automatically flagged for review when they meet suspicious criteria:
- **Large Amounts**: Exceeds ₦200,000 (configurable)
- **Multiple Payments Same Invoice**: Multiple payments recorded against same invoice in short time
- **Round Amounts**: Suspiciously round amounts like ₦100,000, ₦500,000 (optional)
- **Off-Hours Payments**: Payments recorded outside business hours (optional)
- **Backdated Payments**: Attempts to backdate payments beyond allowed days

### 6. **Daily Reconciliation**
- **Bank Statement Matching**: Ability to match payments with bank deposits
- **Reconciliation Window**: Payments must be reconciled within 7 days (configurable)
- **Unreconciled Reports**: Easy identification of payments not yet matched with bank statements

### 7. **User Daily Limits**
- **Per-User Cash Limits**: Maximum cash that can be recorded per day per user
- **Total Daily Limits**: Maximum total payments per user per day
- **Auto-Block**: System prevents recording beyond limits

### 8. **Payment Audit Logs**
Every action on a payment is logged:
- Payment created
- Payment updated/modified
- Payment approved/rejected
- Payment flagged/unflagged
- Payment reviewed
- Payment reconciled
- Receipt uploaded
- Payment accessed/viewed

## Database Schema

### New Payment Fields

```sql
-- Proof of payment
receiptPhotoUrl      - URL to uploaded receipt photo
proofDocumentUrl     - URL to additional proof documents

-- Approval workflow
requiresApproval     - Boolean: requires supervisor approval
approvedById         - ID of supervisor who approved
approvedAt           - Timestamp of approval
verificationNotes    - Supervisor's notes during approval

-- Audit trail
ipAddress            - IP address where payment was recorded
userAgent            - Browser/device information
deviceId             - Unique device identifier
locationData         - GPS coordinates (if available)

-- Reconciliation
reconciledAt         - When matched with bank statement
reconciledById       - Who reconciled it
bankStatementRef     - Reference from bank statement
reconciliationNotes  - Notes during reconciliation

-- Fraud flags
flaggedForReview     - Boolean: flagged for review
flagReason           - Why it was flagged
flaggedAt            - When it was flagged
flaggedById          - Who flagged it
reviewedAt           - When review was completed
reviewedById         - Who reviewed it
reviewNotes          - Review notes
```

### New Tables

#### `payment_audit_logs`
Stores every action performed on payments:
- `action`: CREATED, UPDATED, APPROVED, FLAGGED, RECONCILED, etc.
- `previousValues`: State before the action (JSON)
- `newValues`: State after the action (JSON)
- `ipAddress`, `userAgent`, `deviceId`, `locationData`

#### `fraud_prevention_settings`
Per-tenant configuration:
- Approval thresholds for each payment method
- Mandatory field requirements
- Duplicate detection settings
- Backdating restrictions
- Daily limits per user
- Auto-flagging rules
- Reconciliation requirements
- Business hours

## Configuration

### Accessing Settings

Fraud prevention settings are managed per tenant. Default settings are created automatically for all existing tenants.

### Configuring Thresholds

```typescript
// Update approval thresholds
await prisma.fraudPreventionSettings.update({
  where: { tenantId: 'clinic-001' },
  data: {
    cashApprovalThreshold: 75000,           // Require approval for cash > ₦75,000
    bankTransferApprovalThreshold: 150000,  // Require approval for bank transfer > ₦150,000
    autoFlagAmountThreshold: 300000,        // Auto-flag amounts > ₦300,000
  }
});
```

### Enabling/Disabling Features

```typescript
// Enable/disable specific features
await prisma.fraudPreventionSettings.update({
  where: { tenantId: 'clinic-001' },
  data: {
    requireReceiptPhotoForCash: true,      // Make receipt photos mandatory
    duplicateDetectionEnabled: true,        // Enable duplicate detection
    autoFlagRoundAmounts: true,            // Flag suspiciously round amounts
    autoFlagOffHoursPayments: true,        // Flag payments outside business hours
    requireDailyReconciliation: true,       // Require daily reconciliation
  }
});
```

## Usage Workflows

### 1. Recording a Payment (Staff)

**Normal Flow:**
1. Staff records payment with required details
2. System captures IP address, device info, timestamp
3. If payment is below approval threshold:
   - Payment is immediately completed
   - Audit log created: "CREATED"
4. If payment exceeds threshold:
   - Payment created with `requiresApproval = true`
   - Supervisor notified
   - Payment shows as "Pending Approval"

**With Receipt Upload:**
1. Staff selects payment method (Cash)
2. System requires receipt photo
3. Staff uploads photo of physical receipt
4. Photo URL stored in `receiptPhotoUrl`
5. Audit log created: "RECEIPT_UPLOADED"

### 2. Approving a Payment (Supervisor)

1. Supervisor views pending approvals dashboard
2. Reviews payment details:
   - Amount, payment method, who recorded it
   - Receipt photo/proof documents
   - IP address, device info
   - Time recorded
3. Supervisor approves or rejects:
   - **Approve**: Sets `approvedById`, `approvedAt`, optional notes
   - **Reject**: Payment is marked rejected with reason
4. Audit log created: "APPROVED" or "REJECTED"

### 3. Flagging Suspicious Payments

**Automatic Flagging:**
- System automatically flags based on rules
- Payment gets `flaggedForReview = true`
- `flagReason` set (e.g., "Large amount: ₦250,000")
- Audit log created: "FLAGGED"
- Admin notified if configured

**Manual Flagging:**
1. Supervisor notices suspicious payment
2. Clicks "Flag for Review"
3. Provides reason
4. Payment requires review before processing

### 4. Reviewing Flagged Payments

1. Supervisor/Admin views flagged payments dashboard
2. Investigates:
   - Checks receipt photos
   - Verifies with patient
   - Checks bank statements
   - Reviews audit trail
3. Decides:
   - **Clear**: Removes flag, adds review notes
   - **Escalate**: Escalates to management
   - **Void**: Voids the payment if fraudulent
4. Audit log created: "REVIEWED"

### 5. Daily Reconciliation

1. Cashier/Finance staff opens reconciliation dashboard
2. Downloads list of unreconciled payments
3. Matches against bank statement:
   - Cash payments: Verify cash drawer count
   - Bank transfers: Match with bank statement entries
   - Mobile money: Check mobile money statement
4. For each match:
   - Enter bank statement reference
   - Click "Reconcile"
   - System marks `reconciledAt`, `reconciledById`
   - Audit log created: "RECONCILED"
5. Unmatched payments remain flagged for investigation

## Reports & Audits

### Key Reports

1. **Unreconciled Payments Report**
   - All payments not yet matched with bank statements
   - Grouped by payment method
   - Filtered by date range

2. **Flagged Payments Report**
   - All payments flagged for review
   - Reason for flagging
   - Status (under review, cleared, escalated)

3. **Pending Approvals Report**
   - Payments awaiting supervisor approval
   - Sorted by amount (largest first)

4. **User Activity Report**
   - Payments recorded per user
   - Daily totals per user
   - Identify unusual patterns

5. **Payment Audit Trail**
   - Complete history of actions on a payment
   - Who did what, when
   - Before/after values for all changes

### Example Queries

**Find all unreconciled payments over 7 days old:**
```sql
SELECT * FROM payments
WHERE "reconciledAt" IS NULL
AND "paymentDate" < NOW() - INTERVAL '7 days'
AND "tenantId" = 'clinic-001';
```

**Find all flagged payments:**
```sql
SELECT * FROM payments
WHERE "flaggedForReview" = true
AND "reviewedAt" IS NULL
AND "tenantId" = 'clinic-001';
```

**Get audit trail for a specific payment:**
```sql
SELECT * FROM payment_audit_logs
WHERE "paymentId" = 'payment-123'
ORDER BY "createdAt" DESC;
```

## Best Practices

### For Clinic Owners/Managers

1. **Configure Appropriate Thresholds**
   - Set approval thresholds based on your clinic's typical payment sizes
   - Lower thresholds = more oversight, but more supervisor burden

2. **Enable Mandatory Receipt Photos**
   - Require receipt photos for cash payments
   - Creates physical evidence trail

3. **Daily Reconciliation is Critical**
   - Reconcile payments daily, not weekly
   - Makes it harder to hide fraudulent payments over time

4. **Review Flagged Payments Promptly**
   - Don't let flagged payments pile up
   - Investigate quickly while details are fresh

5. **Periodic Audits**
   - Randomly audit approved payments
   - Check that receipts match amounts
   - Verify with patients occasionally

6. **Monitor User Patterns**
   - Look for users with unusually high payment volumes
   - Check for patterns (e.g., always recording round amounts)

### For Staff

1. **Always Upload Receipts**
   - Take clear photos of physical receipts
   - Include entire receipt in photo

2. **Enter Accurate Details**
   - Double-check amounts
   - Enter correct payment method
   - Add reference numbers for bank/mobile money

3. **Never Record Unverified Payments**
   - Only record after physically receiving payment
   - Never pre-record expected payments

4. **Report System Issues**
   - If you encounter errors, report immediately
   - Don't try to work around system controls

## Security Considerations

1. **Receipt Photo Storage**
   - Photos should be stored securely (encrypted)
   - Access controlled (only authorized users)
   - Retention policy (7 years for compliance)

2. **Audit Log Immutability**
   - Audit logs cannot be deleted or modified
   - Provides tamper-proof trail

3. **Role-Based Access**
   - Only supervisors can approve payments
   - Only admins can modify fraud prevention settings
   - Only finance staff can reconcile

4. **Data Privacy**
   - IP addresses and device IDs are personal data
   - Comply with NDPR/GDPR requirements
   - Inform staff that their actions are monitored

## API Integration

### Recording a Payment with Fraud Prevention

```typescript
POST /api/billing/payments
{
  "invoiceId": "inv-123",
  "amount": 150000,
  "paymentMethod": "CASH",
  "paymentDate": "2026-02-12T10:30:00Z",
  "notes": "Payment received for consultation",

  // Fraud prevention fields
  "receiptPhotoUrl": "https://storage/receipts/rec-456.jpg",
  "proofDocumentUrl": null,

  // Captured automatically by backend middleware
  // ipAddress: "192.168.1.100" (from req.ip)
  // userAgent: "Mozilla/5.0..." (from req.headers)
  // deviceId: "device-abc-123" (from client)
}
```

### Approving a Payment

```typescript
POST /api/billing/payments/:id/approve
{
  "approvedById": "user-789",
  "verificationNotes": "Verified receipt photo matches amount. Patient confirmed payment."
}
```

### Reconciling a Payment

```typescript
POST /api/billing/payments/:id/reconcile
{
  "reconciledById": "user-456",
  "bankStatementRef": "TXN-20260212-001",
  "reconciliationNotes": "Matched with bank deposit on 2026-02-12"
}
```

### Flagging a Payment

```typescript
POST /api/billing/payments/:id/flag
{
  "flaggedById": "user-supervisor",
  "flagReason": "Unusually large cash payment. Verify with patient."
}
```

## Troubleshooting

### Payment Stuck in "Pending Approval"
**Cause**: Payment exceeds approval threshold
**Solution**: Supervisor must approve via approval dashboard

### Receipt Photo Upload Failing
**Cause**: File too large or invalid format
**Solution**:
- Compress image before upload
- Use JPG or PNG format
- Max size: 5MB

### Duplicate Payment Alert
**Cause**: Similar payment recorded recently
**Solution**:
- Check if it's genuinely a duplicate
- If legitimate, supervisor can override after review

### Cannot Backdate Payment
**Cause**: Backdating disabled or exceeds max days
**Solution**:
- Admin must enable backdating if needed
- Or increase max backdating days in settings

## Compliance & Legal

### Audit Requirements
- Audit logs retained for 7 years
- Complies with Nigerian healthcare regulations
- Supports NDPR (Nigeria Data Protection Regulation)

### Evidence in Disputes
- Comprehensive audit trail serves as evidence
- Receipt photos provide proof of payment
- IP/device info helps identify responsible party

### Data Subject Rights (NDPR/GDPR)
- Staff can request their audit data
- Data retention policy must be documented
- Inform staff about monitoring in employment contracts

## Future Enhancements

Planned features:
1. **AI-Powered Fraud Detection**: Machine learning to detect unusual patterns
2. **Real-Time Bank Integration**: Automatic reconciliation with bank APIs
3. **Biometric Verification**: Fingerprint/face scan for large payments
4. **SMS Notifications**: Alert patients when payments are recorded
5. **Blockchain Audit Trail**: Immutable, distributed audit logs

## Support

For questions or issues with fraud prevention features:
- Email: support@ssmcemr.com
- Documentation: See [CLAUDE.md](../CLAUDE.md)
- Report Issues: [GitHub Issues](https://github.com/your-repo/issues)
