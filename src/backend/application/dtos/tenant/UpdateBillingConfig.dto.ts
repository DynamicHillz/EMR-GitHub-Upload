/**
 * Update Billing Configuration DTO
 */

export interface UpdateBillingConfigDto {
  // Currency
  currency?: string;
  currencySymbol?: string;

  // Tax Configuration
  taxEnabled?: boolean;
  defaultTaxRate?: number; // Percentage
  taxName?: string;
  taxId?: string;

  // Payment Methods
  acceptCash?: boolean;
  acceptCard?: boolean;
  acceptMobileMoney?: boolean;
  acceptBankTransfer?: boolean;
  acceptInsurance?: boolean;

  // Invoice Settings
  invoicePrefix?: string;
  invoiceStartNumber?: number;
  invoiceFooterText?: string;
  termsAndConditions?: string;

  // Bank Details
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  swiftCode?: string;

  // Mobile Money Details
  mobileMoneyProvider?: string;
  mobileMoneyNumber?: string;
  mobileMoneyName?: string;

  // Payment Gateway Configuration
  paystackEnabled?: boolean;
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  flutterwaveEnabled?: boolean;
  flutterwavePublicKey?: string;
  flutterwaveSecretKey?: string;
  moniepointEnabled?: boolean;
  moniepointApiKey?: string;
  moniepointContractCode?: string;
}
