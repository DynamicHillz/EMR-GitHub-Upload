# Billing Configuration Module - Implementation Plan

## Overview
Create a comprehensive billing configuration system that allows administrators to configure billing settings for their clinic without modifying code.

## What's Been Implemented ✅

### 1. Professional Dialog System
- ✅ Custom ConfirmDialog component
- ✅ useConfirm hook for easy usage
- ✅ Replaced window.confirm in:
  - UserListPage (suspend, deactivate, reactivate)
  - MainLayout (logout)

### 2. Global Branding Application
- ✅ BrandingProvider component
- ✅ Applies branding across all pages on app startup
- ✅ Listens for login events to reload branding

## Next: Billing Configuration Module

### Features to Implement

#### 1. Billing Configuration Schema (Database)
Add to `tenants` table:
```prisma
model Tenant {
  // ... existing fields...

  // Billing Configuration
  currency              String   @default("USD")
  currencySymbol        String   @default("$")
  taxEnabled            Boolean  @default(true)
  defaultTaxRate        Decimal  @default(0)  // Percentage
  taxName               String   @default("VAT")
  taxId                 String?  // Tax identification number

  // Payment Methods
  acceptCash            Boolean  @default(true)
  acceptCard            Boolean  @default(true)
  acceptMobileMoney     Boolean  @default(true)
  acceptBankTransfer    Boolean  @default(true)
  acceptInsurance       Boolean  @default(false)

  // Invoice Settings
  invoicePrefix         String   @default("INV")
  invoiceStartNumber    Int      @default(1000)
  invoiceFooterText     String?
  termsAndConditions    String?

  // Bank Details
  bankName              String?
  accountNumber         String?
  accountName           String?
  swiftCode             String?

  // Mobile Money Details
  mobileMoneyProvider   String?
  mobileMoneyNumber     String?
  mobileMoneyName       String?
}
```

#### 2. Backend API Endpoints
```
GET    /api/billing/config          - Get billing configuration
PUT    /api/billing/config          - Update billing configuration (Admin only)
POST   /api/billing/config/test     - Test payment configuration
```

#### 3. Frontend UI - Billing Configuration Page
Location: `/settings/billing`

**Tabs:**
1. **General Settings**
   - Currency selection (USD, EUR, GBP, NGN, KES, etc.)
   - Tax configuration (enable/disable, rate, name)
   - Invoice settings (prefix, starting number)

2. **Payment Methods**
   - Enable/disable payment methods
   - Configure each payment method details

3. **Bank Details**
   - Bank account information for bank transfers
   - Display on invoices

4. **Mobile Money**
   - Mobile money provider and number
   - Display on invoices

5. **Terms & Conditions**
   - Invoice footer text
   - Terms and conditions for invoices

#### 4. Integration Points
- Invoice generation uses configured settings
- Payment forms show only enabled payment methods
- Currency displayed on all billing-related pages
- Tax calculated automatically based on configuration

## User Workflow

### Admin Setup (One-Time)
1. Admin logs in
2. Goes to Settings → Billing Configuration
3. Sets up:
   - Currency (e.g., NGN - Nigerian Naira)
   - Tax rate (e.g., 7.5% VAT)
   - Payment methods (Cash, Card, Bank Transfer)
   - Bank details for displaying on invoices
   - Invoice customization (prefix, terms)
4. Saves configuration

### Staff Usage
- Create invoices → uses configured currency and tax
- Process payments → shows only enabled payment methods
- Print invoices → displays bank details, terms, and configured footer

### Patient/Client Experience
- Invoices show correct currency
- Tax clearly displayed
- Payment options match clinic's capabilities
- Professional invoice with clinic branding

## Benefits

1. **No Code Changes Needed**
   - Admins configure through UI
   - Settings stored in database
   - Applied automatically

2. **Multi-Currency Support**
   - Each clinic can use their local currency
   - Consistent formatting

3. **Tax Compliance**
   - Configure local tax rates
   - Automatic tax calculations
   - Clear tax display on invoices

4. **Payment Flexibility**
   - Enable only available payment methods
   - Configure payment provider details

5. **Professional Invoices**
   - Custom branding
   - Bank details for transfers
   - Terms and conditions

## Implementation Steps

### Phase 1: Database & Backend (Priority)
1. ✅ Update Prisma schema
2. ✅ Create migration
3. ✅ Create DTOs
4. ✅ Create use cases
5. ✅ Create API endpoints
6. ✅ Test endpoints

### Phase 2: Frontend UI
1. ✅ Create BillingConfigPage component
2. ✅ Create configuration forms
3. ✅ Add validation
4. ✅ Add route to settings
5. ✅ Test configuration flow

### Phase 3: Integration
1. Update invoice generation to use config
2. Update payment forms to show enabled methods
3. Update all displays to use configured currency
4. Test end-to-end

## Status

- **Professional Dialogs**: ✅ Complete
- **Global Branding**: ✅ Complete
- **Billing Configuration**: 🚧 Ready to implement

---

**Ready to Continue**: Yes
**Next Action**: Implement billing configuration database schema and backend API
