# Billing & Payments API - Quick Start Guide

**Base URL**: `http://localhost:3000/api/billing`
**Authentication**: All endpoints require JWT Bearer token

---

## 📋 Table of Contents

1. [Service Catalog](#service-catalog)
2. [Invoice Management](#invoice-management)
3. [Payment Processing](#payment-processing)
4. [Gateway Payments](#gateway-payments)
5. [Outstanding Balances](#outstanding-balances)
6. [Refund Management](#refund-management)
7. [Common Error Codes](#common-error-codes)

---

## 🛠️ Service Catalog

### Get All Services
```http
GET /api/billing/services
Authorization: Bearer <token>

Query Parameters:
  - category: CONSULTATION | LAB_TEST | MEDICATION | PROCEDURE | IMAGING | OTHER
  - activeOnly: true | false (default: true)

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "serviceCode": "CONSULT-001",
      "serviceName": "General Consultation",
      "category": "CONSULTATION",
      "basePrice": 5000,
      "taxRate": 7.5,
      "isActive": true
    }
  ]
}
```

### Add Service
```http
POST /api/billing/services
Authorization: Bearer <token>
Content-Type: application/json

{
  "serviceCode": "CONSULT-001",
  "serviceName": "General Consultation",
  "description": "General medical consultation",
  "category": "CONSULTATION",
  "basePrice": 5000,
  "taxRate": 7.5
}

Response:
{
  "success": true,
  "message": "Service added successfully",
  "data": { ... }
}
```

### Update Service
```http
PUT /api/billing/services/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "serviceName": "Updated Consultation",
  "basePrice": 6000,
  "taxRate": 7.5
}
```

### Delete Service (Deactivate)
```http
DELETE /api/billing/services/:id
Authorization: Bearer <token>
```

---

## 📄 Invoice Management

### Generate Invoice
```http
POST /api/billing/invoices/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "patient-uuid",
  "consultationIds": ["consult-uuid"],
  "labTestIds": ["lab-uuid"],
  "prescriptionIds": ["prescription-uuid"],
  "additionalItems": [
    {
      "description": "X-Ray Scan",
      "quantity": 1,
      "unitPrice": 5000,
      "taxRate": 7.5
    }
  ],
  "discount": 500,
  "notes": "Initial consultation and tests"
}

Response:
{
  "success": true,
  "message": "Invoice generated successfully",
  "data": {
    "id": "invoice-uuid",
    "invoiceNumber": "INV-20251117-0001",
    "patientId": "patient-uuid",
    "subtotal": 15000,
    "tax": 1125,
    "discount": 500,
    "totalAmount": 15625,
    "paidAmount": 0,
    "balance": 15625,
    "status": "ISSUED",
    "lineItems": [...]
  }
}
```

### Get Invoices (with filtering)
```http
GET /api/billing/invoices
Authorization: Bearer <token>

Query Parameters:
  - patientId: Filter by patient
  - status: DRAFT | ISSUED | PAID | PARTIALLY_PAID | CANCELLED
  - startDate: YYYY-MM-DD
  - endDate: YYYY-MM-DD
  - limit: Number (default: 20)
  - offset: Number (default: 0)

Response:
{
  "success": true,
  "data": [...],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### Get Invoice Details
```http
GET /api/billing/invoices/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "invoiceNumber": "INV-20251117-0001",
    "patient": { ... },
    "lineItems": [
      {
        "description": "General Consultation",
        "quantity": 1,
        "unitPrice": 5000,
        "tax": 375,
        "total": 5375
      }
    ],
    "subtotal": 15000,
    "tax": 1125,
    "discount": 500,
    "totalAmount": 15625,
    "paidAmount": 5000,
    "balance": 10625,
    "status": "PARTIALLY_PAID"
  }
}
```

### Update Invoice
```http
PUT /api/billing/invoices/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "discount": 1000,
  "notes": "Discount applied"
}

Note: Only DRAFT and ISSUED invoices can be updated
```

### Cancel Invoice
```http
DELETE /api/billing/invoices/:id
Authorization: Bearer <token>

Note: Only unpaid invoices can be cancelled
```

---

## 💳 Payment Processing

### Record Payment (Cash/Card/Bank/Mobile)
```http
POST /api/billing/payments
Authorization: Bearer <token>
Content-Type: application/json

// Cash Payment
{
  "invoiceId": "invoice-uuid",
  "amount": 5000,
  "paymentMethod": "CASH",
  "referenceNumber": "CASH-001",
  "notes": "Cash payment received"
}

// Card Payment
{
  "invoiceId": "invoice-uuid",
  "amount": 5000,
  "paymentMethod": "CARD",
  "cardLast4": "1234",
  "cardBrand": "Visa",
  "referenceNumber": "POS-TXN-123",
  "notes": "Card payment via POS"
}

// Bank Transfer
{
  "invoiceId": "invoice-uuid",
  "amount": 5000,
  "paymentMethod": "BANK_TRANSFER",
  "referenceNumber": "TRF-123456",
  "transactionId": "BANK-TXN-789",
  "notes": "Bank transfer confirmed"
}

// Mobile Money
{
  "invoiceId": "invoice-uuid",
  "amount": 5000,
  "paymentMethod": "MOBILE_MONEY",
  "mobileProvider": "MTN",
  "mobileNumber": "0801234567",
  "referenceNumber": "MM-123456",
  "notes": "Mobile money payment"
}

Response:
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "payment": {
      "id": "payment-uuid",
      "paymentNumber": "PAY-20251117-0001",
      "amount": 5000,
      "paymentMethod": "CASH",
      "status": "COMPLETED"
    },
    "invoice": {
      "invoiceNumber": "INV-20251117-0001",
      "totalAmount": 15625,
      "paidAmount": 5000,
      "balance": 10625,
      "paymentStatus": "PARTIALLY_PAID"
    }
  }
}
```

### Get Payment History
```http
GET /api/billing/payments
Authorization: Bearer <token>

Query Parameters:
  - invoiceId: Filter by invoice
  - patientId: Filter by patient
  - paymentMethod: CASH | CARD | BANK_TRANSFER | MOBILE_MONEY | INSURANCE
  - startDate: YYYY-MM-DD
  - endDate: YYYY-MM-DD
  - limit: Number (default: 20)
  - offset: Number (default: 0)

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "paymentNumber": "PAY-20251117-0001",
      "amount": 5000,
      "paymentMethod": "CASH",
      "paymentDate": "2025-11-17T10:30:00Z",
      "invoice": { ... },
      "patient": { ... }
    }
  ],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

---

## 🌐 Gateway Payments

### Initiate Gateway Payment
```http
POST /api/billing/gateway-payments/initiate
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoiceId": "invoice-uuid",
  "amount": 15625,
  "gateway": "FLUTTERWAVE",  // or PAYSTACK, MONIEPOINT
  "customerEmail": "patient@example.com",
  "customerName": "John Doe",
  "customerPhone": "08012345678",
  "callbackUrl": "https://yourapp.com/api/billing/gateway-payments/callback",
  "redirectUrl": "https://yourapp.com/payment/success"
}

Response:
{
  "success": true,
  "message": "Payment initiated successfully",
  "data": {
    "payment": {
      "id": "payment-uuid",
      "paymentNumber": "PAY-20251117-0002",
      "amount": 15625,
      "status": "PENDING",
      "gatewayProvider": "FLUTTERWAVE",
      "gatewayRef": "FLW-REF-123456"
    },
    "paymentUrl": "https://checkout.flutterwave.com/xxxxxxxx",
    "reference": "PAY-20251117-0002",
    "gatewayRef": "FLW-REF-123456"
  }
}

Action: Redirect user to paymentUrl to complete payment
```

### Verify Gateway Payment
```http
POST /api/billing/gateway-payments/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentReference": "PAY-20251117-0002"
}

Response (Success):
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "payment": {
      "id": "payment-uuid",
      "paymentNumber": "PAY-20251117-0002",
      "amount": 15625,
      "status": "COMPLETED",
      "paymentDate": "2025-11-17T10:45:00Z",
      "gatewayProvider": "FLUTTERWAVE",
      "gatewayRef": "FLW-REF-123456",
      "cardLast4": "1234",
      "cardBrand": "Visa"
    },
    "invoice": {
      "invoiceNumber": "INV-20251117-0001",
      "totalAmount": 15625,
      "paidAmount": 15625,
      "balance": 0,
      "paymentStatus": "PAID"
    },
    "alreadyProcessed": false
  }
}

Response (Already Processed):
{
  "success": true,
  "message": "Payment already processed",
  "data": {
    "alreadyProcessed": true,
    "payment": { ... },
    "invoice": { ... }
  }
}

Response (Failed):
{
  "success": false,
  "message": "Payment verification failed"
}
```

---

## 📊 Outstanding Balances

### Get All Outstanding Invoices
```http
GET /api/billing/outstanding
Authorization: Bearer <token>

Query Parameters:
  - patientId: Filter by patient (optional)
  - limit: Number (default: 20)
  - offset: Number (default: 0)

Response:
{
  "success": true,
  "data": {
    "outstanding": [
      {
        "id": "uuid",
        "invoiceNumber": "INV-20251117-0001",
        "patient": {
          "id": "uuid",
          "firstName": "John",
          "lastName": "Doe"
        },
        "totalAmount": 15625,
        "paidAmount": 5000,
        "balance": 10625,
        "invoiceDate": "2025-11-17",
        "daysOverdue": 5,
        "agingBucket": "1_30"  // current, 1_30, 31_60, 61_90, 90_plus
      }
    ],
    "summary": {
      "totalOutstanding": 50000,
      "totalInvoices": 10
    },
    "aging": {
      "current": 10000,      // 0 days overdue
      "days1_30": 15000,     // 1-30 days overdue
      "days31_60": 12000,    // 31-60 days overdue
      "days61_90": 8000,     // 61-90 days overdue
      "days90Plus": 5000     // 90+ days overdue
    }
  },
  "total": 10,
  "limit": 20,
  "offset": 0
}
```

### Get Patient Balance
```http
GET /api/billing/outstanding/:patientId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "patientId": "patient-uuid",
    "patient": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "totalOutstanding": 20625,
    "invoiceCount": 3,
    "invoices": [...]
  }
}
```

---

## 💰 Refund Management

### Request Refund
```http
POST /api/billing/refunds
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoiceId": "invoice-uuid",
  "paymentId": "payment-uuid",  // optional
  "amount": 2000,
  "reason": "Service not rendered",
  "refundMethod": "CASH",
  "notes": "Customer requested refund"
}

Response:
{
  "success": true,
  "message": "Refund request created successfully",
  "data": {
    "id": "refund-uuid",
    "refundNumber": "REF-20251117-0001",
    "amount": 2000,
    "status": "PENDING",
    "reason": "Service not rendered",
    "requestedAt": "2025-11-17T11:00:00Z",
    "requestedBy": {
      "id": "user-uuid",
      "firstName": "Jane",
      "lastName": "Smith"
    }
  }
}
```

### Get Refund Requests
```http
GET /api/billing/refunds
Authorization: Bearer <token>

Query Parameters:
  - status: PENDING | APPROVED | REJECTED | COMPLETED | CANCELLED
  - invoiceId: Filter by invoice
  - patientId: Filter by patient
  - limit: Number (default: 20)
  - offset: Number (default: 0)

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "refundNumber": "REF-20251117-0001",
      "amount": 2000,
      "status": "PENDING",
      "reason": "Service not rendered",
      "patient": { ... },
      "invoice": { ... },
      "requestedBy": { ... }
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

### Approve Refund (Admin Only)
```http
POST /api/billing/refunds/:id/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "notes": "Refund approved by manager"
}

Response:
{
  "success": true,
  "message": "Refund approved successfully",
  "data": {
    "id": "refund-uuid",
    "refundNumber": "REF-20251117-0001",
    "status": "APPROVED",
    "approvedAt": "2025-11-17T11:15:00Z",
    "approvedBy": { ... }
  }
}
```

### Reject Refund (Admin Only)
```http
POST /api/billing/refunds/:id/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "rejectionReason": "Service was fully rendered",
  "notes": "No grounds for refund"
}

Response:
{
  "success": true,
  "message": "Refund rejected successfully",
  "data": {
    "id": "refund-uuid",
    "refundNumber": "REF-20251117-0001",
    "status": "REJECTED",
    "rejectionReason": "Service was fully rendered",
    "rejectedAt": "2025-11-17T11:20:00Z",
    "rejectedBy": { ... }
  }
}
```

### Process Refund
```http
POST /api/billing/refunds/:id/process
Authorization: Bearer <token>
Content-Type: application/json

{
  "referenceNumber": "REF-CASH-001"
}

Response:
{
  "success": true,
  "message": "Refund processed successfully",
  "data": {
    "refund": {
      "id": "refund-uuid",
      "refundNumber": "REF-20251117-0001",
      "status": "COMPLETED",
      "amount": 2000,
      "refundDate": "2025-11-17T11:30:00Z",
      "referenceNumber": "REF-CASH-001"
    },
    "invoice": {
      "invoiceNumber": "INV-20251117-0001",
      "paidAmount": 3000,  // reduced by refund amount
      "balance": 12625,    // increased by refund amount
      "paymentStatus": "PARTIALLY_PAID"
    }
  }
}

Note: Only APPROVED refunds can be processed
```

---

## ⚠️ Common Error Codes

### 400 Bad Request
```json
{
  "success": false,
  "message": "Payment amount exceeds invoice balance"
}
```

**Common Causes:**
- Invalid input data
- Payment amount > invoice balance
- Cannot update/cancel paid invoice
- Cannot process unapproved refund

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized: No tenant ID found"
}
```

**Causes:**
- Missing or invalid JWT token
- Expired token

### 404 Not Found
```json
{
  "success": false,
  "message": "Invoice not found"
}
```

**Causes:**
- Resource doesn't exist
- Resource belongs to different tenant

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to record payment",
  "error": "Database connection error"
}
```

**Causes:**
- Database errors
- Payment gateway errors
- Unexpected server errors

---

## 🔐 Authentication

All endpoints require a JWT Bearer token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The token must contain:
- `userId` - User ID
- `tenantId` - Tenant ID for multi-tenancy

---

## 💡 Best Practices

### 1. Invoice Generation
- Always include all completed services before generating invoice
- Use `additionalItems` for one-off charges not in service catalog
- Set appropriate discount if applicable

### 2. Payment Recording
- Verify invoice balance before recording payment
- Always provide reference numbers for traceability
- Use appropriate payment method (CASH, CARD, etc.)

### 3. Gateway Payments
- Set proper callback and redirect URLs
- Always verify payment after gateway redirect
- Handle both success and failure scenarios

### 4. Refund Workflow
- Follow the three-step process: Request → Approve → Process
- Admins must review before approval/rejection
- Provide clear refund reasons

### 5. Outstanding Balances
- Regularly check aging analysis
- Follow up on overdue invoices
- Use patient balance endpoint for specific patient queries

---

## 🧪 Testing with cURL

### Generate Invoice
```bash
curl -X POST http://localhost:3000/api/billing/invoices/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-uuid",
    "consultationIds": ["consult-uuid"],
    "discount": 0
  }'
```

### Record Cash Payment
```bash
curl -X POST http://localhost:3000/api/billing/payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "invoice-uuid",
    "amount": 5000,
    "paymentMethod": "CASH",
    "referenceNumber": "CASH-001"
  }'
```

### Initiate Flutterwave Payment
```bash
curl -X POST http://localhost:3000/api/billing/gateway-payments/initiate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "invoice-uuid",
    "amount": 15625,
    "gateway": "FLUTTERWAVE",
    "customerEmail": "patient@example.com",
    "customerName": "John Doe"
  }'
```

---

## 📱 Frontend Integration

### Payment Flow Example

```javascript
// 1. Generate Invoice
const invoice = await fetch('/api/billing/invoices/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    patientId: 'patient-uuid',
    consultationIds: ['consult-uuid']
  })
});

// 2. Initiate Gateway Payment
const payment = await fetch('/api/billing/gateway-payments/initiate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    invoiceId: invoice.data.id,
    amount: invoice.data.totalAmount,
    gateway: 'PAYSTACK',
    customerEmail: patient.email,
    customerName: `${patient.firstName} ${patient.lastName}`
  })
});

// 3. Redirect to payment URL
window.location.href = payment.data.paymentUrl;

// 4. After redirect back, verify payment
const verification = await fetch('/api/billing/gateway-payments/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentReference: payment.data.reference
  })
});

if (verification.data.payment.status === 'COMPLETED') {
  // Show success message
  console.log('Payment successful!');
} else {
  // Show error message
  console.log('Payment failed');
}
```

---

## 📚 Additional Resources

- **Full Documentation**: See `BILLING_MODULE_FINAL_SUMMARY.md`
- **Gateway Architecture**: See `PAYMENT_GATEWAY_ARCHITECTURE.md`
- **Implementation Details**: See `BILLING_BACKEND_IMPLEMENTATION_COMPLETE.md`

---

**Last Updated**: 2025-11-17
**API Version**: 1.0
**Status**: Production Ready ✅
