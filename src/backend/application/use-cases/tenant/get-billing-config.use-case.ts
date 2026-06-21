/**
 * Get Billing Configuration Use Case
 *
 * Retrieves billing configuration settings for a tenant
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors/AppError';

export class GetBillingConfigUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        clinicName: true,

        // Currency
        currency: true,
        currencySymbol: true,

        // Tax Configuration
        taxEnabled: true,
        defaultTaxRate: true,
        taxName: true,
        taxId: true,

        // Payment Methods
        acceptCash: true,
        acceptCard: true,
        acceptMobileMoney: true,
        acceptBankTransfer: true,
        acceptInsurance: true,

        // Invoice Settings
        invoicePrefix: true,
        invoiceStartNumber: true,
        invoiceFooterText: true,
        termsAndConditions: true,

        // Bank Details
        bankName: true,
        accountNumber: true,
        accountName: true,
        swiftCode: true,

        // Mobile Money Details
        mobileMoneyProvider: true,
        mobileMoneyNumber: true,
        mobileMoneyName: true,

        // Payment Gateway Configuration
        paystackEnabled: true,
        paystackPublicKey: true,
        paystackSecretKey: true,
        flutterwaveEnabled: true,
        flutterwavePublicKey: true,
        flutterwaveSecretKey: true,
        moniepointEnabled: true,
        moniepointApiKey: true,
        moniepointContractCode: true,
      }
    });

    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    return tenant;
  }
}
