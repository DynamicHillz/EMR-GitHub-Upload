# Payment Gateway Architecture - Multi-Provider Support

**Module**: Billing & Payments
**Feature**: REQ-BILL-7 - Payment Gateway Integration
**Status**: ✅ Flexible Architecture Implemented

---

## Overview

The St. Stephen EMR billing system uses a **flexible, provider-agnostic architecture** that supports multiple payment gateways. This allows the system to integrate with various payment processors without being locked into a single provider.

## Supported Payment Gateways

### Currently Implemented
- ✅ **Flutterwave** - African payment processor
- ✅ **Paystack** - Nigerian/African payment processor

### Ready for Implementation
- ⏳ **Stripe** - Global payment processor
- ⏳ **Interswitch** - Nigerian payment processor
- ⏳ **Remita** - Nigerian payment processor
- ⏳ **PayPal** - Global payment processor
- ⏳ **Square** - US payment processor
- ⏳ **Razorpay** - Indian payment processor

---

## Architecture

### 1. Common Interface (`IPaymentGateway`)

All payment gateways implement a common interface that provides:

```typescript
interface IPaymentGateway {
  // Gateway identifier
  readonly name: string;

  // Core operations
  initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResponse>;
  verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse>;
  refundPayment(request: RefundPaymentRequest): Promise<RefundPaymentResponse>;

  // Webhook support
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookEvent(payload: any): WebhookEvent;
}
```

### 2. Gateway Factory Pattern

The `PaymentGatewayFactory` manages gateway instances:

```typescript
const gateway = PaymentGatewayFactory.getGateway('FLUTTERWAVE', config);
const result = await gateway.initiatePayment(request);
```

**Benefits:**
- Single point for gateway creation
- Automatic instance caching
- Environment-based configuration
- Easy to switch providers

### 3. Database Schema

The `Payment` model stores gateway-agnostic data:

```prisma
model Payment {
  // Standard payment fields
  paymentNumber   String
  amount          Float
  paymentMethod   PaymentMethod
  status          PaymentProcessStatus

  // Gateway fields (flexible for any provider)
  gatewayProvider String?   // FLUTTERWAVE, PAYSTACK, STRIPE, etc.
  gatewayRef      String?   // Provider's transaction reference
  gatewayData     Json?     // Full provider response
  gatewayStatus   String?   // Provider-specific status
}
```

---

## Gateway Implementations

### Flutterwave Integration

**File**: `src/backend/infrastructure/payment-gateways/flutterwave.gateway.ts`

**Features:**
- Standard & Inline payment flow
- Card, bank transfer, USSD, mobile money
- Transaction verification
- Refund processing
- Webhook verification (HMAC SHA256)

**Environment Variables:**
```env
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxx
FLUTTERWAVE_WEBHOOK_SECRET=xxxxx
```

**API Endpoints:**
- Initiate: `POST https://api.flutterwave.com/v3/payments`
- Verify: `GET https://api.flutterwave.com/v3/transactions/verify_by_reference`
- Refund: `POST https://api.flutterwave.com/v3/refunds`

### Paystack Integration

**File**: `src/backend/infrastructure/payment-gateways/paystack.gateway.ts`

**Features:**
- Standard & Popup payment flow
- Card, bank transfer, USSD, mobile money, QR
- Transaction verification
- Refund processing
- Webhook verification (HMAC SHA512)

**Environment Variables:**
```env
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_WEBHOOK_SECRET=xxxxx
```

**API Endpoints:**
- Initiate: `POST https://api.paystack.co/transaction/initialize`
- Verify: `GET https://api.paystack.co/transaction/verify/:reference`
- Refund: `POST https://api.paystack.co/refund`

**Key Difference from Flutterwave:**
- Amounts in kobo (smallest currency unit) - multiply by 100
- Uses SHA512 for webhook verification (vs SHA256)
- Different response structure

---

## Use Cases

### 1. Initiate Gateway Payment

**File**: `src/backend/application/use-cases/billing/initiate-gateway-payment.use-case.ts`

**Purpose**: Start a payment transaction via any gateway

**Flow:**
1. Validate invoice and amount
2. Generate unique payment reference
3. Get configured gateway instance
4. Initiate payment with gateway
5. Create PENDING payment record
6. Return payment URL to frontend

**Example:**
```typescript
const result = await initiateGatewayPaymentUseCase.execute({
  invoiceId: 'invoice-uuid',
  amount: 10000,
  gateway: 'PAYSTACK', // or 'FLUTTERWAVE', 'STRIPE', etc.
  customerEmail: 'patient@example.com',
  customerName: 'John Doe',
  callbackUrl: 'https://emr.example.com/payment/callback'
}, tenantId);

// Returns: { paymentUrl, reference, gatewayRef }
// Redirect user to paymentUrl
```

### 2. Verify Gateway Payment

**File**: `src/backend/application/use-cases/billing/verify-gateway-payment.use-case.ts`

**Purpose**: Verify payment status and update invoice

**Flow:**
1. Find PENDING payment by reference
2. Get gateway instance
3. Verify payment with gateway
4. Update payment status (COMPLETED/FAILED)
5. Update invoice if successful
6. Return verification result

**Example:**
```typescript
const result = await verifyGatewayPaymentUseCase.execute(
  'PAY-20251117-0001',
  tenantId
);

if (!result.alreadyProcessed) {
  // Payment just verified
  console.log('Payment verified:', result.payment.status);
  console.log('Invoice updated:', result.invoice.paymentStatus);
}
```

---

## Payment Flow

### Standard Payment Flow

```
1. User clicks "Pay Online"
   ↓
2. Frontend calls: POST /api/billing/payments/gateway/initiate
   {
     invoiceId: "...",
     amount: 10000,
     gateway: "PAYSTACK"
   }
   ↓
3. Backend creates PENDING payment & returns URL
   ↓
4. Frontend redirects user to payment URL
   ↓
5. User completes payment on gateway site
   ↓
6. Gateway redirects to callback URL with reference
   ↓
7. Frontend calls: GET /api/billing/payments/gateway/verify/:reference
   ↓
8. Backend verifies with gateway & updates payment
   ↓
9. Frontend shows success/failure message
```

### Webhook Flow (Alternative/Backup)

```
1. User completes payment
   ↓
2. Gateway sends webhook to: POST /api/billing/payments/gateway/webhook/:gateway
   ↓
3. Backend verifies webhook signature
   ↓
4. Backend extracts payment reference
   ↓
5. Backend verifies payment
   ↓
6. Backend updates payment & invoice
```

---

## API Endpoints

### Initiate Gateway Payment
```
POST /api/billing/payments/gateway/initiate
Authorization: Bearer <jwt-token>

Request:
{
  "invoiceId": "invoice-uuid",
  "amount": 10000,
  "gateway": "FLUTTERWAVE",  // or PAYSTACK, STRIPE, etc.
  "customerEmail": "patient@example.com",
  "customerName": "John Doe",
  "callbackUrl": "https://emr.example.com/payment/callback"
}

Response:
{
  "success": true,
  "data": {
    "paymentUrl": "https://checkout.flutterwave.com/...",
    "reference": "PAY-20251117-0001",
    "gatewayRef": "1234567890"
  }
}
```

### Verify Gateway Payment
```
GET /api/billing/payments/gateway/verify/:reference
Authorization: Bearer <jwt-token>

Response:
{
  "success": true,
  "data": {
    "payment": { ... },
    "invoice": { ... },
    "alreadyProcessed": false
  }
}
```

### Webhook Handler
```
POST /api/billing/payments/gateway/webhook/:gateway
X-Paystack-Signature: <signature>  // or X-Flutterwave-Signature

Request: (Gateway-specific payload)

Response:
{
  "success": true
}
```

---

## Adding a New Gateway

To add support for a new payment gateway (e.g., Stripe):

### Step 1: Create Gateway Implementation

Create `src/backend/infrastructure/payment-gateways/stripe.gateway.ts`:

```typescript
import { IPaymentGateway, /* ... */ } from './payment-gateway.interface';

export class StripeGateway implements IPaymentGateway {
  readonly name = 'STRIPE';

  async initiatePayment(request) {
    // Stripe-specific implementation
  }

  async verifyPayment(request) {
    // Stripe-specific implementation
  }

  async refundPayment(request) {
    // Stripe-specific implementation
  }

  verifyWebhookSignature(payload, signature) {
    // Stripe-specific webhook verification
  }

  parseWebhookEvent(payload) {
    // Parse Stripe webhook event
  }
}
```

### Step 2: Register in Factory

Update `payment-gateway.factory.ts`:

```typescript
case 'STRIPE':
  gateway = new StripeGateway(config);
  break;
```

### Step 3: Add Environment Variables

Add to `.env`:
```env
STRIPE_PUBLIC_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Step 4: Update Database Enum

Update `prisma/schema.prisma`:
```prisma
enum PaymentGateway {
  FLUTTERWAVE
  PAYSTACK
  STRIPE  // Add new gateway
  // ...
}
```

### Step 5: Test

```typescript
// Usage is identical for all gateways
const result = await initiateGatewayPaymentUseCase.execute({
  invoiceId: '...',
  amount: 10000,
  gateway: 'STRIPE',  // Just change the gateway name
  // ...
}, tenantId);
```

---

## Configuration

### Gateway Selection

The gateway can be configured at different levels:

1. **Tenant Level** (Recommended)
   - Each tenant can choose their preferred gateway
   - Store in `Tenant` model: `preferredPaymentGateway`

2. **Invoice Level**
   - Different invoices can use different gateways
   - Useful for special cases

3. **Environment Level**
   - Single gateway for entire application
   - Use environment variable: `DEFAULT_PAYMENT_GATEWAY`

### Environment Variables

**Required for each gateway:**
```env
# Gateway credentials
<GATEWAY>_PUBLIC_KEY=xxxxx
<GATEWAY>_SECRET_KEY=xxxxx
<GATEWAY>_WEBHOOK_SECRET=xxxxx

# Application settings
NODE_ENV=production  # or test/development
DEFAULT_PAYMENT_GATEWAY=FLUTTERWAVE
```

---

## Security

### 1. API Key Management
- Store keys in environment variables (never in code)
- Use different keys for test/production
- Rotate keys periodically

### 2. Webhook Verification
- Always verify webhook signatures
- Reject unsigned/invalid webhooks
- Log verification failures

### 3. Payment Verification
- Always verify payments server-side
- Never trust client-side verification alone
- Use payment reference for verification

### 4. Amount Validation
- Verify amount matches invoice
- Check invoice hasn't been paid already
- Prevent double-payment

---

## Testing

### Test Mode
All gateways support test mode:

```env
NODE_ENV=test
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
```

### Test Cards

**Flutterwave:**
- Success: `5531886652142950` / CVV: `564` / Expiry: `09/32` / PIN: `3310`
- Insufficient funds: `5143010522339965` / CVV: `276` / Expiry: `08/26` / PIN: `3310`

**Paystack:**
- Success: `4084084084084081` / CVV: `408` / Expiry: `01/99`
- Insufficient funds: `5060666666666666666` / CVV: `123` / Expiry: `01/99`

---

## Benefits of Multi-Gateway Architecture

1. **Flexibility**: Switch providers without code changes
2. **Redundancy**: Fallback to alternate gateway if one fails
3. **Cost Optimization**: Use cheapest gateway for each transaction type
4. **Geographic Coverage**: Different gateways for different regions
5. **Feature Availability**: Use gateway with best features for use case
6. **Vendor Independence**: Not locked into single provider
7. **Easy Migration**: Gradual migration between providers
8. **Testing**: Test with multiple providers simultaneously

---

## Future Enhancements

- [ ] Automatic gateway selection based on amount/region
- [ ] Gateway health monitoring & automatic failover
- [ ] Transaction fee comparison & optimization
- [ ] Multi-currency support per gateway
- [ ] Recurring/subscription payments
- [ ] Saved card tokenization
- [ ] 3D Secure authentication
- [ ] Split payments (marketplace model)
- [ ] Payment analytics & reporting

---

## Files Created

### Infrastructure
- ✅ `payment-gateway.interface.ts` - Common interface
- ✅ `flutterwave.gateway.ts` - Flutterwave implementation
- ✅ `paystack.gateway.ts` - Paystack implementation
- ✅ `payment-gateway.factory.ts` - Gateway factory

### Use Cases
- ✅ `initiate-gateway-payment.use-case.ts` - Initiate payment
- ✅ `verify-gateway-payment.use-case.ts` - Verify payment

### Database
- ✅ Updated `Payment` model with gateway fields
- ✅ Added `PaymentGateway` enum

---

## Conclusion

The multi-gateway architecture provides a **flexible, scalable, and future-proof** payment processing system. Adding support for new payment gateways is straightforward and doesn't require changes to existing code.

The system currently supports **Flutterwave** and **Paystack**, with a clear path to adding Stripe, Interswitch, Remita, and other providers as needed.
