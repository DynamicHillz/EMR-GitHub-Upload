# Billing & Payments Module - Implementation Plan

## Overview
This document outlines the complete implementation plan for the Billing & Payments (BILL) module of the St. Stephen EMR system. The module will handle automatic invoice generation, multiple payment methods, receipt generation, outstanding balance tracking, partial payments, refunds, and Flutterwave payment gateway integration.

---

## Requirements Summary

### REQ-BILL-1: Automatic Invoice Generation
System must automatically generate itemized invoices from completed services (consultation, lab tests, medications)

### REQ-BILL-2: Multiple Payment Methods
System must support multiple payment methods (cash, card, bank transfer, mobile money)

### REQ-BILL-3: Payment Recording & Receipts
System must record payments with reference number and generate printable receipts

### REQ-BILL-4: Outstanding Balance Tracking
System must track outstanding balances and display patients with unpaid invoices

### REQ-BILL-5: Partial Payments & Refunds
System must support partial payments and refunds with admin approval workflow

### REQ-BILL-6: Configurable Pricing
System must apply configurable pricing from service catalog per clinic

### REQ-BILL-7: Flutterwave Integration
System must integrate with Flutterwave payment gateway for card payments

---

## Database Schema Analysis

### Existing Schema (Already in place)
```prisma
model Invoice {
  id        String   @id @default(uuid())
  tenantId  String
  patientId String
  issuedById String

  // Invoice Details
  invoiceNumber String
  invoiceDate   DateTime @default(now())
  dueDate       DateTime?

  // Line Items (JSON)
  lineItems     String  // JSON array of services

  // Amounts
  subtotal      Float
  taxAmount     Float @default(0)
  discount      Float @default(0)
  totalAmount   Float
  paidAmount    Float @default(0)
  balance       Float

  // Payment
  paymentStatus PaymentStatus @default(UNPAID)
  paymentMethod String?
  paymentDate   DateTime?
  paymentReference String?

  // Status
  status        InvoiceStatus @default(DRAFT)

  // Notes
  notes         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  tenant   Tenant  @relation(fields: [tenantId], references: [id])
  patient  Patient @relation(fields: [patientId], references: [id])
  issuedBy User    @relation(fields: [issuedById], references: [id])
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PAID
  PARTIALLY_PAID
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID
  REFUNDED
}
```

### Additional Schema Needed

#### 1. Payment Model (NEW)
```prisma
model Payment {
  id              String   @id @default(uuid())
  tenantId        String
  invoiceId       String
  patientId       String
  processedById   String

  // Payment Details
  paymentNumber   String    // Format: PAY-YYYYMMDD-XXXX
  paymentDate     DateTime  @default(now())
  amount          Float
  paymentMethod   PaymentMethod

  // Payment Reference
  referenceNumber String?   // Bank ref, card ref, etc.
  transactionId   String?   // Flutterwave transaction ID

  // Card Payment Details (if applicable)
  cardLast4       String?
  cardBrand       String?   // Visa, Mastercard, etc.

  // Mobile Money Details (if applicable)
  mobileProvider  String?   // MTN, Airtel, etc.
  mobileNumber    String?

  // Status
  status          PaymentStatus @default(COMPLETED)

  // Flutterwave Integration
  flutterwaveRef  String?
  flutterwaveData Json?     // Store full Flutterwave response

  // Receipt
  receiptUrl      String?
  receiptPrinted  Boolean @default(false)

  // Notes
  notes           String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  invoice         Invoice  @relation(fields: [invoiceId], references: [id])
  patient         Patient  @relation(fields: [patientId], references: [id])
  processedBy     User     @relation(fields: [processedById], references: [id])

  @@unique([tenantId, paymentNumber])
  @@index([tenantId, invoiceId])
  @@index([tenantId, patientId])
  @@index([tenantId, paymentDate])
}

enum PaymentMethod {
  CASH
  CARD
  BANK_TRANSFER
  MOBILE_MONEY
  INSURANCE
}
```

#### 2. Refund Model (NEW)
```prisma
model Refund {
  id              String   @id @default(uuid())
  tenantId        String
  invoiceId       String
  paymentId       String?
  patientId       String

  // Refund Details
  refundNumber    String    // Format: REF-YYYYMMDD-XXXX
  refundDate      DateTime  @default(now())
  amount          Float
  reason          String

  // Approval Workflow
  requestedById   String
  requestedAt     DateTime  @default(now())
  approvedById    String?
  approvedAt      DateTime?
  rejectedById    String?
  rejectedAt      DateTime?
  rejectionReason String?

  status          RefundStatus @default(PENDING)

  // Refund Method
  refundMethod    PaymentMethod
  referenceNumber String?

  // Notes
  notes           String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  invoice         Invoice  @relation(fields: [invoiceId], references: [id])
  payment         Payment? @relation(fields: [paymentId], references: [id])
  patient         Patient  @relation(fields: [patientId], references: [id])
  requestedBy     User     @relation("RefundRequester", fields: [requestedById], references: [id])
  approvedBy      User?    @relation("RefundApprover", fields: [approvedById], references: [id])
  rejectedBy      User?    @relation("RefundRejecter", fields: [rejectedById], references: [id])

  @@unique([tenantId, refundNumber])
  @@index([tenantId, status])
  @@index([tenantId, invoiceId])
}

enum RefundStatus {
  PENDING
  APPROVED
  REJECTED
  COMPLETED
  CANCELLED
}
```

#### 3. Service Catalog Model (NEW)
```prisma
model ServiceCatalog {
  id              String   @id @default(uuid())
  tenantId        String

  // Service Details
  serviceCode     String
  serviceName     String
  description     String?
  category        ServiceCategory

  // Pricing
  basePrice       Float
  taxRate         Float @default(0)    // Percentage (e.g., 7.5 for 7.5%)

  // Status
  isActive        Boolean @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, serviceCode])
  @@index([tenantId, category])
}

enum ServiceCategory {
  CONSULTATION
  LAB_TEST
  MEDICATION
  PROCEDURE
  IMAGING
  OTHER
}
```

---

## Implementation Phases

### Phase 1: Database Schema Updates
**Timeline: 1 day**

#### Tasks:
1. Add Payment, Refund, and ServiceCatalog models to schema.prisma
2. Update Invoice model to add relations to Payment and Refund
3. Run Prisma migration
4. Seed initial service catalog with default services

**Files to Create/Modify:**
- `prisma/schema.prisma` - Add new models
- `prisma/seeds/service-catalog.seed.ts` - Seed default services

---

### Phase 2: Backend - Service Catalog (REQ-BILL-6)
**Timeline: 2 days**

#### Use Cases:
1. **Get Service Catalog** - Retrieve all active services for a tenant
2. **Add Service** - Add new service to catalog
3. **Update Service** - Update service details and pricing
4. **Delete/Deactivate Service** - Deactivate service

#### Files to Create:
```
src/backend/
├── application/
│   ├── use-cases/
│   │   └── billing/
│   │       ├── get-service-catalog.use-case.ts
│   │       ├── add-service.use-case.ts
│   │       ├── update-service.use-case.ts
│   │       └── delete-service.use-case.ts
├── presentation/
│   ├── controllers/
│   │   └── billing.controller.ts (NEW)
│   └── routes/
│       └── billing.routes.ts (NEW)
```

#### API Endpoints:
```
GET    /api/billing/services              - Get service catalog
POST   /api/billing/services              - Add new service
PUT    /api/billing/services/:id          - Update service
DELETE /api/billing/services/:id          - Delete service
```

---

### Phase 3: Backend - Invoice Generation (REQ-BILL-1)
**Timeline: 3 days**

#### Use Cases:
1. **Auto-Generate Invoice** - Generate invoice from consultation/lab/pharmacy services
2. **Get Invoices** - List all invoices with filters
3. **Get Invoice Details** - Get single invoice with full details
4. **Update Invoice** - Modify draft invoices
5. **Cancel Invoice** - Cancel invoice

#### Files to Create:
```
src/backend/
└── application/
    └── use-cases/
        └── billing/
            ├── generate-invoice.use-case.ts
            ├── get-invoices.use-case.ts
            ├── get-invoice-details.use-case.ts
            ├── update-invoice.use-case.ts
            └── cancel-invoice.use-case.ts
```

#### API Endpoints:
```
POST   /api/billing/invoices/generate     - Auto-generate invoice
GET    /api/billing/invoices               - Get invoices (with filters)
GET    /api/billing/invoices/:id           - Get invoice details
PUT    /api/billing/invoices/:id           - Update invoice
DELETE /api/billing/invoices/:id           - Cancel invoice
```

#### Invoice Generation Logic:
1. Retrieve completed services:
   - Consultations (finalized)
   - Lab tests (completed/reviewed)
   - Dispensed medications
2. Match services to service catalog for pricing
3. Calculate subtotal, tax, discounts
4. Generate unique invoice number
5. Create invoice with DRAFT status
6. Return invoice for review

---

### Phase 4: Backend - Payment Processing (REQ-BILL-2, REQ-BILL-3)
**Timeline: 3 days**

#### Use Cases:
1. **Record Payment** - Record cash/bank transfer/mobile money payment
2. **Process Card Payment** - Initiate Flutterwave payment
3. **Verify Payment** - Verify Flutterwave payment callback
4. **Get Payment History** - Get all payments for patient/invoice
5. **Generate Receipt** - Generate printable receipt

#### Files to Create:
```
src/backend/
├── application/
│   ├── use-cases/
│   │   └── billing/
│   │       ├── record-payment.use-case.ts
│   │       ├── initiate-card-payment.use-case.ts
│   │       ├── verify-payment.use-case.ts
│   │       ├── get-payment-history.use-case.ts
│   │       └── generate-receipt.use-case.ts
│   └── services/
│       └── flutterwave.service.ts (NEW)
└── infrastructure/
    └── integrations/
        └── flutterwave/
            ├── flutterwave.client.ts
            └── flutterwave.types.ts
```

#### API Endpoints:
```
POST   /api/billing/payments               - Record payment
POST   /api/billing/payments/card/initiate - Initiate card payment
POST   /api/billing/payments/card/verify   - Verify payment (webhook)
GET    /api/billing/payments               - Get payment history
GET    /api/billing/receipts/:paymentId    - Generate receipt PDF
```

#### Payment Flow:
1. **Cash/Transfer/Mobile Money:**
   - Cashier records payment details
   - System updates invoice paidAmount and balance
   - Generate payment number
   - Update payment status
   - Generate receipt

2. **Card Payment (Flutterwave):**
   - Frontend calls initiate endpoint
   - Backend creates Flutterwave payment link
   - Return payment link to frontend
   - User completes payment on Flutterwave
   - Flutterwave sends webhook to verify endpoint
   - Backend verifies and records payment
   - Update invoice status

---

### Phase 5: Backend - Outstanding Balances (REQ-BILL-4)
**Timeline: 1 day**

#### Use Cases:
1. **Get Outstanding Invoices** - List all unpaid/partially paid invoices
2. **Get Patient Balance** - Get total outstanding balance for patient
3. **Get Aging Report** - Get invoices by age (30, 60, 90+ days)

#### Files to Create:
```
src/backend/
└── application/
    └── use-cases/
        └── billing/
            ├── get-outstanding-invoices.use-case.ts
            ├── get-patient-balance.use-case.ts
            └── get-aging-report.use-case.ts
```

#### API Endpoints:
```
GET    /api/billing/outstanding            - Get outstanding invoices
GET    /api/billing/outstanding/:patientId - Get patient balance
GET    /api/billing/reports/aging          - Get aging report
```

---

### Phase 6: Backend - Refunds (REQ-BILL-5)
**Timeline: 2 days**

#### Use Cases:
1. **Request Refund** - Cashier requests refund
2. **Approve Refund** - Admin approves refund request
3. **Reject Refund** - Admin rejects refund request
4. **Process Refund** - Complete refund and update records
5. **Get Refund Requests** - List pending refund requests

#### Files to Create:
```
src/backend/
└── application/
    └── use-cases/
        └── billing/
            ├── request-refund.use-case.ts
            ├── approve-refund.use-case.ts
            ├── reject-refund.use-case.ts
            ├── process-refund.use-case.ts
            └── get-refund-requests.use-case.ts
```

#### API Endpoints:
```
POST   /api/billing/refunds                - Request refund
POST   /api/billing/refunds/:id/approve    - Approve refund (Admin only)
POST   /api/billing/refunds/:id/reject     - Reject refund (Admin only)
POST   /api/billing/refunds/:id/process    - Process refund
GET    /api/billing/refunds                - Get refund requests
```

---

### Phase 7: Frontend - Service Catalog Management
**Timeline: 2 days**

#### Components to Create:
```
src/frontend/
├── pages/
│   └── billing/
│       └── ServiceCatalogPage.tsx
└── components/
    └── billing/
        ├── ServiceCatalogTable.tsx
        ├── AddServiceModal.tsx
        └── EditServiceModal.tsx
```

#### Features:
- View all services in table
- Search/filter by category
- Add new service
- Edit service pricing
- Activate/deactivate services
- Display active status

---

### Phase 8: Frontend - Invoice Management
**Timeline: 3 days**

#### Components to Create:
```
src/frontend/
├── pages/
│   └── billing/
│       ├── InvoicesPage.tsx
│       └── InvoiceDetailsPage.tsx
└── components/
    └── billing/
        ├── InvoiceList.tsx
        ├── InvoiceCard.tsx
        ├── GenerateInvoiceModal.tsx
        ├── InvoiceLineItems.tsx
        └── InvoicePreview.tsx
```

#### Features:
- **Invoice List:**
  - View all invoices
  - Filter by status, patient, date range
  - Search by invoice number or patient name
  - Status badges (Draft, Issued, Paid, etc.)

- **Generate Invoice:**
  - Select patient
  - Auto-fetch unbilled services
  - Manual service selection
  - Add/remove line items
  - Apply discounts
  - Preview before issuing

- **Invoice Details:**
  - Full invoice display
  - Line item breakdown
  - Payment history
  - Print/download PDF

---

### Phase 9: Frontend - Payment Processing
**Timeline: 4 days**

#### Components to Create:
```
src/frontend/
├── pages/
│   └── billing/
│       ├── PaymentsPage.tsx
│       └── MakePaymentPage.tsx
└── components/
    └── billing/
        ├── PaymentModal.tsx
        ├── PaymentMethodSelector.tsx
        ├── CardPaymentForm.tsx (Flutterwave)
        ├── CashPaymentForm.tsx
        ├── BankTransferForm.tsx
        ├── MobileMoneyForm.tsx
        ├── PaymentHistory.tsx
        └── ReceiptViewer.tsx
```

#### Features:
- **Make Payment:**
  - Select invoice
  - Display balance due
  - Select payment method
  - Method-specific forms:
    - **Cash:** Amount, received date
    - **Card:** Integrate Flutterwave inline payment
    - **Bank Transfer:** Reference number, bank name, date
    - **Mobile Money:** Provider, phone number, reference
  - Support partial payments
  - Generate receipt immediately

- **Payment History:**
  - View all payments
  - Filter by date, method, patient
  - Search by reference number
  - View/print receipts

- **Receipt:**
  - Patient details
  - Invoice details
  - Payment details
  - Balance remaining
  - Clinic branding
  - Print-friendly format

---

### Phase 10: Frontend - Outstanding Balances
**Timeline: 2 days**

#### Components to Create:
```
src/frontend/
├── pages/
│   └── billing/
│       └── OutstandingBalancesPage.tsx
└── components/
    └── billing/
        ├── OutstandingInvoicesTable.tsx
        ├── PatientBalanceCard.tsx
        └── AgingReportChart.tsx
```

#### Features:
- List patients with outstanding balances
- Sort by amount, age, patient name
- Quick payment action
- Aging analysis (0-30, 31-60, 61-90, 90+ days)
- Total outstanding amount
- Export to CSV

---

### Phase 11: Frontend - Refund Management
**Timeline: 2 days**

#### Components to Create:
```
src/frontend/
├── pages/
│   └── billing/
│       └── RefundsPage.tsx
└── components/
    └── billing/
        ├── RequestRefundModal.tsx
        ├── RefundRequestsList.tsx
        ├── RefundApprovalModal.tsx
        └── RefundDetails.tsx
```

#### Features:
- **Cashier:**
  - Request refund for invoice/payment
  - Provide reason
  - View pending requests

- **Admin:**
  - View all refund requests
  - Approve/reject with notes
  - Process approved refunds
  - Audit trail

---

### Phase 12: Integration & Testing
**Timeline: 3 days**

#### Tasks:
1. **Flutterwave Integration Testing:**
   - Test card payments in sandbox mode
   - Test webhook verification
   - Handle payment failures
   - Test refunds

2. **End-to-End Testing:**
   - Generate invoice from consultation
   - Make full payment (all methods)
   - Make partial payment
   - Complete partial payment
   - Request and approve refund
   - Generate and print receipt

3. **Role-Based Access Control:**
   - Cashier: Make payments, request refunds, view invoices
   - Admin: Approve refunds, manage service catalog
   - Doctor: View patient invoices only

4. **Multi-tenancy Testing:**
   - Test data isolation
   - Test tenant-specific pricing
   - Test invoice numbering per tenant

---

## File Structure Summary

```
src/
├── backend/
│   ├── application/
│   │   ├── use-cases/
│   │   │   └── billing/
│   │   │       ├── generate-invoice.use-case.ts
│   │   │       ├── get-invoices.use-case.ts
│   │   │       ├── get-invoice-details.use-case.ts
│   │   │       ├── update-invoice.use-case.ts
│   │   │       ├── cancel-invoice.use-case.ts
│   │   │       ├── record-payment.use-case.ts
│   │   │       ├── initiate-card-payment.use-case.ts
│   │   │       ├── verify-payment.use-case.ts
│   │   │       ├── get-payment-history.use-case.ts
│   │   │       ├── generate-receipt.use-case.ts
│   │   │       ├── get-outstanding-invoices.use-case.ts
│   │   │       ├── get-patient-balance.use-case.ts
│   │   │       ├── get-aging-report.use-case.ts
│   │   │       ├── request-refund.use-case.ts
│   │   │       ├── approve-refund.use-case.ts
│   │   │       ├── reject-refund.use-case.ts
│   │   │       ├── process-refund.use-case.ts
│   │   │       ├── get-refund-requests.use-case.ts
│   │   │       ├── get-service-catalog.use-case.ts
│   │   │       ├── add-service.use-case.ts
│   │   │       ├── update-service.use-case.ts
│   │   │       └── delete-service.use-case.ts
│   │   └── services/
│   │       └── flutterwave.service.ts
│   ├── infrastructure/
│   │   └── integrations/
│   │       └── flutterwave/
│   │           ├── flutterwave.client.ts
│   │           └── flutterwave.types.ts
│   └── presentation/
│       ├── controllers/
│       │   └── billing.controller.ts
│       └── routes/
│           └── billing.routes.ts
├── frontend/
│   ├── pages/
│   │   └── billing/
│   │       ├── InvoicesPage.tsx
│   │       ├── InvoiceDetailsPage.tsx
│   │       ├── PaymentsPage.tsx
│   │       ├── MakePaymentPage.tsx
│   │       ├── OutstandingBalancesPage.tsx
│   │       ├── RefundsPage.tsx
│   │       └── ServiceCatalogPage.tsx
│   └── components/
│       └── billing/
│           ├── InvoiceList.tsx
│           ├── InvoiceCard.tsx
│           ├── GenerateInvoiceModal.tsx
│           ├── InvoiceLineItems.tsx
│           ├── InvoicePreview.tsx
│           ├── PaymentModal.tsx
│           ├── PaymentMethodSelector.tsx
│           ├── CardPaymentForm.tsx
│           ├── CashPaymentForm.tsx
│           ├── BankTransferForm.tsx
│           ├── MobileMoneyForm.tsx
│           ├── PaymentHistory.tsx
│           ├── ReceiptViewer.tsx
│           ├── OutstandingInvoicesTable.tsx
│           ├── PatientBalanceCard.tsx
│           ├── AgingReportChart.tsx
│           ├── RequestRefundModal.tsx
│           ├── RefundRequestsList.tsx
│           ├── RefundApprovalModal.tsx
│           ├── RefundDetails.tsx
│           ├── ServiceCatalogTable.tsx
│           ├── AddServiceModal.tsx
│           └── EditServiceModal.tsx
```

---

## API Endpoints Summary

### Service Catalog
```
GET    /api/billing/services              - Get service catalog
POST   /api/billing/services              - Add new service
PUT    /api/billing/services/:id          - Update service
DELETE /api/billing/services/:id          - Delete service
```

### Invoices
```
POST   /api/billing/invoices/generate     - Auto-generate invoice
GET    /api/billing/invoices               - Get invoices (with filters)
GET    /api/billing/invoices/:id           - Get invoice details
PUT    /api/billing/invoices/:id           - Update invoice
DELETE /api/billing/invoices/:id           - Cancel invoice
```

### Payments
```
POST   /api/billing/payments               - Record payment
POST   /api/billing/payments/card/initiate - Initiate card payment
POST   /api/billing/payments/card/verify   - Verify payment (webhook)
GET    /api/billing/payments               - Get payment history
GET    /api/billing/receipts/:paymentId    - Generate receipt PDF
```

### Outstanding Balances
```
GET    /api/billing/outstanding            - Get outstanding invoices
GET    /api/billing/outstanding/:patientId - Get patient balance
GET    /api/billing/reports/aging          - Get aging report
```

### Refunds
```
POST   /api/billing/refunds                - Request refund
POST   /api/billing/refunds/:id/approve    - Approve refund (Admin only)
POST   /api/billing/refunds/:id/reject     - Reject refund (Admin only)
POST   /api/billing/refunds/:id/process    - Process refund
GET    /api/billing/refunds                - Get refund requests
```

---

## Flutterwave Integration Guide

### 1. Setup
```bash
npm install flutterwave-node-v3
```

### 2. Environment Variables
```env
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxx
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK-xxxxx
FLUTTERWAVE_WEBHOOK_SECRET=xxxxx
```

### 3. Payment Flow
1. **Initiate Payment:**
   ```typescript
   const payload = {
     tx_ref: `INV-${invoiceNumber}`,
     amount: totalAmount,
     currency: 'NGN',
     redirect_url: `${frontendUrl}/billing/payment/verify`,
     customer: {
       email: patientEmail,
       name: patientName,
       phonenumber: patientPhone
     },
     customizations: {
       title: 'St. Stephen EMR',
       description: `Payment for Invoice ${invoiceNumber}`,
       logo: clinicLogoUrl
     }
   };
   ```

2. **Verify Payment:**
   ```typescript
   const response = await flw.Transaction.verify({ id: transactionId });
   if (response.data.status === 'successful' &&
       response.data.amount >= expectedAmount &&
       response.data.currency === 'NGN') {
     // Record payment
   }
   ```

3. **Webhook Verification:**
   ```typescript
   const hash = req.headers['verif-hash'];
   if (hash !== process.env.FLUTTERWAVE_WEBHOOK_SECRET) {
     return res.status(401).send();
   }
   ```

---

## Currency Formatting

All currency displays must use Nigerian Naira (₦):

```typescript
const formatCurrency = (amount: number): string => {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};
```

---

## Testing Checklist

### Invoice Generation
- [ ] Auto-generate invoice from consultation
- [ ] Auto-generate invoice from lab tests
- [ ] Auto-generate invoice from pharmacy dispensing
- [ ] Manual invoice creation
- [ ] Apply discounts
- [ ] Calculate tax correctly
- [ ] Generate unique invoice numbers

### Payment Processing
- [ ] Record cash payment
- [ ] Record bank transfer payment
- [ ] Record mobile money payment
- [ ] Process card payment via Flutterwave
- [ ] Verify Flutterwave webhook
- [ ] Handle payment failures
- [ ] Support partial payments
- [ ] Update invoice status correctly

### Receipts
- [ ] Generate receipt after payment
- [ ] Print receipt
- [ ] Download receipt as PDF
- [ ] Email receipt (future)

### Outstanding Balances
- [ ] Display patients with outstanding balances
- [ ] Calculate aging correctly
- [ ] Sort and filter functionality

### Refunds
- [ ] Request refund as Cashier
- [ ] Approve refund as Admin
- [ ] Reject refund as Admin
- [ ] Process refund
- [ ] Update invoice and payment records

### Multi-tenancy
- [ ] Data isolation between tenants
- [ ] Tenant-specific pricing
- [ ] Unique invoice numbering per tenant

---

## Timeline Summary

| Phase | Description | Duration |
|-------|-------------|----------|
| 1 | Database Schema Updates | 1 day |
| 2 | Backend - Service Catalog | 2 days |
| 3 | Backend - Invoice Generation | 3 days |
| 4 | Backend - Payment Processing | 3 days |
| 5 | Backend - Outstanding Balances | 1 day |
| 6 | Backend - Refunds | 2 days |
| 7 | Frontend - Service Catalog | 2 days |
| 8 | Frontend - Invoice Management | 3 days |
| 9 | Frontend - Payment Processing | 4 days |
| 10 | Frontend - Outstanding Balances | 2 days |
| 11 | Frontend - Refund Management | 2 days |
| 12 | Integration & Testing | 3 days |
| **Total** | | **28 days** |

---

## Success Criteria

✅ **REQ-BILL-1:** Invoices are automatically generated from completed services with itemized breakdown

✅ **REQ-BILL-2:** All payment methods (cash, card, bank transfer, mobile money) are supported

✅ **REQ-BILL-3:** Payments are recorded with unique reference numbers and printable receipts are generated

✅ **REQ-BILL-4:** Outstanding balances are tracked and displayed with aging analysis

✅ **REQ-BILL-5:** Partial payments are supported and refunds require admin approval

✅ **REQ-BILL-6:** Service catalog allows configurable pricing per clinic tenant

✅ **REQ-BILL-7:** Flutterwave payment gateway is integrated for card payments with webhook verification

---

## Next Steps

1. Review and approve this implementation plan
2. Set up Flutterwave account and obtain API keys
3. Begin Phase 1: Database Schema Updates
4. Proceed with backend implementation (Phases 2-6)
5. Develop frontend interfaces (Phases 7-11)
6. Conduct comprehensive testing (Phase 12)
7. Deploy to staging environment
8. User acceptance testing
9. Production deployment

---

## Notes

- All monetary values use Nigerian Naira (₦)
- Invoice numbers follow format: INV-YYYYMMDD-XXXX
- Payment numbers follow format: PAY-YYYYMMDD-XXXX
- Refund numbers follow format: REF-YYYYMMDD-XXXX
- Role-based access control enforced on all endpoints
- All operations are multi-tenant aware
- Audit logging for all billing operations
- Receipt generation uses PDF library (e.g., pdfmake or react-pdf)
