# Testing Fraud Prevention - Live Examples

## ✅ What's Now Active

The fraud prevention system is now **LIVE** and enforcing rules on every payment recording.

### Real-Time Enforcement

When staff record payments, the system automatically:
1. **Validates mandatory fields** based on payment method
2. **Checks approval thresholds** and blocks or flags large amounts
3. **Detects duplicates** within configurable time window
4. **Enforces backdating restrictions**
5. **Checks daily user limits**
6. **Auto-flags suspicious patterns**
7. **Captures audit trail** (IP, device, user agent)
8. **Creates audit logs** for every action

## Test Scenarios

### Scenario 1: Normal Cash Payment (Below Threshold)

```bash
POST /api/billing/payments
{
  "invoiceId": "inv-123",
  "amount": 25000,
  "paymentMethod": "CASH",
  "receiptPhotoUrl": "https://storage.example.com/receipt-001.jpg"
}
```

**Expected Result:**
- ✅ Payment accepted immediately
- ✅ No approval required (amount < ₦50,000)
- ✅ Audit log created with IP address
- ✅ Response: `"Payment recorded successfully"`

---

### Scenario 2: Large Cash Payment (Requires Approval)

```bash
POST /api/billing/payments
{
  "invoiceId": "inv-123",
  "amount": 100000,
  "paymentMethod": "CASH",
  "receiptPhotoUrl": "https://storage.example.com/receipt-002.jpg"
}
```

**Expected Result:**
- ⚠️ Payment created with `requiresApproval = true`
- ⚠️ Payment status shows "Pending Approval"
- ⚠️ Supervisor notified
- ⚠️ Response: `"Payment recorded and pending supervisor approval"`
- ⚠️ `fraudPrevention.requiresApproval: true`
- ⚠️ `fraudPrevention.flagReason: "Large amount requires supervisor approval (₦100,000)"`

---

### Scenario 3: Cash Without Receipt Photo (Validation Error)

```bash
POST /api/billing/payments
{
  "invoiceId": "inv-123",
  "amount": 15000,
  "paymentMethod": "CASH"
  // Missing receiptPhotoUrl
}
```

**Expected Result:**
- ❌ Payment BLOCKED
- ❌ HTTP 500 (validation error)
- ❌ Error message: `"Fraud prevention validation failed: Receipt photo is mandatory for cash payments"`

---

### Scenario 4: Bank Transfer Without Reference (Validation Error)

```bash
POST /api/billing/payments
{
  "invoiceId": "inv-123",
  "amount": 50000,
  "paymentMethod": "BANK_TRANSFER"
  // Missing referenceNumber
}
```

**Expected Result:**
- ❌ Payment BLOCKED
- ❌ Error: `"Bank reference number is mandatory for bank transfers"`

---

### Scenario 5: Duplicate Payment Detection

```bash
# First payment
POST /api/billing/payments
{
  "invoiceId": "inv-123",
  "amount": 25000,
  "paymentMethod": "CASH",
  "receiptPhotoUrl": "receipt.jpg"
}

# Try recording again within 30 minutes
POST /api/billing/payments
{
  "invoiceId": "inv-123",
  "amount": 25000,
  "paymentMethod": "CASH",
  "receiptPhotoUrl": "receipt2.jpg"
}
```

**Expected Result:**
- ⚠️ Second payment flagged with `flaggedForReview = true`
- ⚠️ `flagReason: "Possible duplicate - similar payment recorded 1 time(s) in last 30 minutes"`
- ⚠️ Payment still created but requires review
- ⚠️ Response warns: `"Payment recorded but flagged for review"`

---

### Scenario 6: Unusually Large Amount (Auto-Flagged)

```bash
POST /api/billing/payments
{
  "invoiceId": "inv-123",
  "amount": 500000,
  "paymentMethod": "CASH",
  "receiptPhotoUrl": "receipt.jpg"
}
```

**Expected Result:**
- ⚠️ Payment created but flagged
- ⚠️ `flaggedForReview = true`
- ⚠️ `requiresApproval = true` (also exceeds approval threshold)
- ⚠️ `flagReason: "Large amount requires supervisor approval (₦500,000); Unusually large amount - exceeds ₦200,000"`
- ⚠️ Admin notified

---

### Scenario 7: Backdated Payment (Blocked)

```bash
POST /api/billing/payments
{
  "invoiceId": "inv-123",
  "amount": 15000,
  "paymentMethod": "CASH",
  "paymentDate": "2026-02-01",  // 11 days ago
  "receiptPhotoUrl": "receipt.jpg"
}
```

**Expected Result:**
- ❌ Payment BLOCKED (backdating not allowed by default)
- ❌ Error: `"Backdating payments is not allowed"`

---

### Scenario 8: Suspiciously Round Amount (Optional Flag)

If `autoFlagRoundAmounts` is enabled:

```bash
POST /api/billing/payments
{
  "invoiceId": "inv-123",
  "amount": 100000,  // Exactly 100k
  "paymentMethod": "CASH",
  "receiptPhotoUrl": "receipt.jpg"
}
```

**Expected Result:**
- ⚠️ Flagged: `"Suspiciously round amount - verify legitimacy"`
- ⚠️ Plus: `"Large amount requires supervisor approval"`

---

## Response Format

### Successful Payment (No Issues)

```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "payment": {
      "id": "pay-xyz",
      "amount": 25000,
      "status": "COMPLETED",
      "requiresApproval": false,
      "flaggedForReview": false,
      "ipAddress": "192.168.1.100",
      "receiptPhotoUrl": "https://...",
      // ... other payment fields
    },
    "invoice": { /* updated invoice */ },
    "fraudPrevention": {
      "requiresApproval": false,
      "flaggedForReview": false,
      "flagReason": null
    }
  }
}
```

### Payment Requiring Approval

```json
{
  "success": true,
  "message": "Payment recorded and pending supervisor approval",
  "data": {
    "payment": {
      "id": "pay-xyz",
      "amount": 100000,
      "requiresApproval": true,
      "approvedById": null,
      "approvedAt": null,
      // ...
    },
    "fraudPrevention": {
      "requiresApproval": true,
      "flaggedForReview": false,
      "flagReason": "Large amount requires supervisor approval (₦100,000)"
    }
  }
}
```

### Payment Flagged for Review

```json
{
  "success": true,
  "message": "Payment recorded but flagged for review",
  "data": {
    "payment": {
      "id": "pay-xyz",
      "flaggedForReview": true,
      "flagReason": "Possible duplicate payment detected",
      // ...
    },
    "fraudPrevention": {
      "requiresApproval": false,
      "flaggedForReview": true,
      "flagReason": "Possible duplicate - similar payment recorded 1 time(s) in last 30 minutes"
    }
  },
  "warnings": [
    "Payment flagged: Possible duplicate - similar payment recorded 1 time(s) in last 30 minutes"
  ]
}
```

### Validation Error (Blocked)

```json
{
  "success": false,
  "message": "Fraud prevention validation failed:\n- Receipt photo is mandatory for cash payments",
  "error": "Fraud prevention validation failed:\n- Receipt photo is mandatory for cash payments"
}
```

## Audit Trail

Every payment creates an audit log entry:

```sql
SELECT * FROM payment_audit_logs WHERE "paymentId" = 'pay-xyz';
```

Returns:
```
id              | tenantId    | paymentId | userId   | action  | ipAddress      | changesSummary
----------------|-------------|-----------|----------|---------|----------------|------------------
audit-abc-123   | clinic-001  | pay-xyz   | user-789 | CREATED | 192.168.1.100  | Payment of ₦25,000 recorded via CASH
```

## Current Default Settings

```sql
SELECT * FROM fraud_prevention_settings WHERE "tenantId" = 'clinic-001';
```

Key settings:
- `cashApprovalThreshold`: 50000
- `bankTransferApprovalThreshold`: 100000
- `mobileMoneyApprovalThreshold`: 75000
- `requireReceiptPhotoForCash`: true
- `requireReferenceForBankTransfer`: true
- `duplicateDetectionEnabled`: true
- `duplicateTimeWindowMinutes`: 30
- `autoFlagLargeAmounts`: true
- `autoFlagAmountThreshold`: 200000
- `allowBackdating`: false

## Testing Checklist

- [ ] Record normal cash payment with receipt photo → Should succeed
- [ ] Record cash payment without receipt photo → Should fail
- [ ] Record large cash payment (>₦50k) → Should require approval
- [ ] Record bank transfer without reference → Should fail
- [ ] Record same payment twice within 30 min → Should flag second
- [ ] Record unusually large payment (>₦200k) → Should flag
- [ ] Try backdating payment → Should fail
- [ ] Check payment audit log → Should show all actions with IP

## Customization for Testing

Temporarily adjust settings:

```sql
-- Reduce threshold for testing
UPDATE fraud_prevention_settings
SET "cashApprovalThreshold" = 10000  -- Now requires approval for >₦10k
WHERE "tenantId" = 'clinic-001';

-- Allow backdating for testing
UPDATE fraud_prevention_settings
SET "allowBackdating" = true, "maxBackdatingDays" = 7
WHERE "tenantId" = 'clinic-001';

-- Enable all auto-flagging for testing
UPDATE fraud_prevention_settings
SET "autoFlagRoundAmounts" = true,
    "autoFlagOffHoursPayments" = true
WHERE "tenantId" = 'clinic-001';
```

## Verifying It Works

1. **Check Payment Has Fraud Fields:**
```sql
SELECT "requiresApproval", "flaggedForReview", "ipAddress", "receiptPhotoUrl"
FROM payments WHERE id = 'pay-xyz';
```

2. **Check Audit Log Exists:**
```sql
SELECT COUNT(*) FROM payment_audit_logs WHERE "paymentId" = 'pay-xyz';
-- Should be at least 1 (CREATED action)
```

3. **Test Frontend:**
- Try recording cash payment without receipt → See error
- Try recording large payment → See "pending approval" message
- View payment details → See IP address and device info

## Summary

✅ **All validation is now active and enforced**
✅ **Mandatory fields checked on every payment**
✅ **Large amounts require approval**
✅ **Duplicates are detected and flagged**
✅ **Complete audit trail captured**
✅ **IP addresses and device info recorded**
✅ **Backdating blocked by default**

The system is now protecting against fraudulent payment recording!
