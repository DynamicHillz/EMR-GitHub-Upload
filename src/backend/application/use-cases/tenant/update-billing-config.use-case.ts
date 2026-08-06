/**
 * Update Billing Configuration Use Case
 *
 * Updates billing configuration settings for a tenant
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { UpdateBillingConfigDto } from '../../dtos/tenant/UpdateBillingConfig.dto';

export class UpdateBillingConfigUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, dto: UpdateBillingConfigDto) {
    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    // Validate tax rate
    if (dto.defaultTaxRate !== undefined) {
      if (dto.defaultTaxRate < 0 || dto.defaultTaxRate > 100) {
        throw new ValidationError('Tax rate must be between 0 and 100');
      }
    }

    // Validate invoice start number
    if (dto.invoiceStartNumber !== undefined && dto.invoiceStartNumber < 1) {
      throw new ValidationError('Invoice start number must be at least 1');
    }

    // Validate markup percent
    if (dto.defaultMarkupPercent !== undefined) {
      if (dto.defaultMarkupPercent < 0 || dto.defaultMarkupPercent > 1000) {
        throw new ValidationError('Markup percent must be between 0 and 1000');
      }
    }

    // Validate overstay grace period
    if (dto.overstayGraceDays !== undefined) {
      if (dto.overstayGraceDays < 0 || dto.overstayGraceDays > 30) {
        throw new ValidationError('Overstay grace period must be between 0 and 30 days');
      }
    }

    // Prepare update data
    const updateData: Prisma.TenantUpdateInput = {};

    // Currency
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.currencySymbol !== undefined) updateData.currencySymbol = dto.currencySymbol;

    // Tax Configuration
    if (dto.taxEnabled !== undefined) updateData.taxEnabled = dto.taxEnabled;
    if (dto.defaultTaxRate !== undefined) updateData.defaultTaxRate = dto.defaultTaxRate;
    if (dto.taxName !== undefined) updateData.taxName = dto.taxName;
    if (dto.taxId !== undefined) updateData.taxId = dto.taxId;

    // Pharmacy Pricing
    if (dto.defaultMarkupPercent !== undefined) updateData.defaultMarkupPercent = dto.defaultMarkupPercent;

    // Payment Methods
    if (dto.acceptCash !== undefined) updateData.acceptCash = dto.acceptCash;
    if (dto.acceptCard !== undefined) updateData.acceptCard = dto.acceptCard;
    if (dto.acceptMobileMoney !== undefined) updateData.acceptMobileMoney = dto.acceptMobileMoney;
    if (dto.acceptBankTransfer !== undefined) updateData.acceptBankTransfer = dto.acceptBankTransfer;
    if (dto.acceptInsurance !== undefined) updateData.acceptInsurance = dto.acceptInsurance;

    // Invoice Settings
    if (dto.invoicePrefix !== undefined) updateData.invoicePrefix = dto.invoicePrefix;
    if (dto.invoiceStartNumber !== undefined) updateData.invoiceStartNumber = dto.invoiceStartNumber;
    if (dto.invoiceFooterText !== undefined) updateData.invoiceFooterText = dto.invoiceFooterText;
    if (dto.termsAndConditions !== undefined) updateData.termsAndConditions = dto.termsAndConditions;

    // Inpatient Settings
    if (dto.overstayGraceDays !== undefined) updateData.overstayGraceDays = dto.overstayGraceDays;

    // Bank Details
    if (dto.bankName !== undefined) updateData.bankName = dto.bankName;
    if (dto.accountNumber !== undefined) updateData.accountNumber = dto.accountNumber;
    if (dto.accountName !== undefined) updateData.accountName = dto.accountName;
    if (dto.swiftCode !== undefined) updateData.swiftCode = dto.swiftCode;

    // Mobile Money Details
    if (dto.mobileMoneyProvider !== undefined) updateData.mobileMoneyProvider = dto.mobileMoneyProvider;
    if (dto.mobileMoneyNumber !== undefined) updateData.mobileMoneyNumber = dto.mobileMoneyNumber;
    if (dto.mobileMoneyName !== undefined) updateData.mobileMoneyName = dto.mobileMoneyName;

    // Payment Gateway Configuration
    if (dto.paystackEnabled !== undefined) updateData.paystackEnabled = dto.paystackEnabled;
    if (dto.paystackPublicKey !== undefined) updateData.paystackPublicKey = dto.paystackPublicKey;
    if (dto.paystackSecretKey !== undefined) updateData.paystackSecretKey = dto.paystackSecretKey;
    if (dto.flutterwaveEnabled !== undefined) updateData.flutterwaveEnabled = dto.flutterwaveEnabled;
    if (dto.flutterwavePublicKey !== undefined) updateData.flutterwavePublicKey = dto.flutterwavePublicKey;
    if (dto.flutterwaveSecretKey !== undefined) updateData.flutterwaveSecretKey = dto.flutterwaveSecretKey;
    if (dto.moniepointEnabled !== undefined) updateData.moniepointEnabled = dto.moniepointEnabled;
    if (dto.moniepointApiKey !== undefined) updateData.moniepointApiKey = dto.moniepointApiKey;
    if (dto.moniepointContractCode !== undefined) updateData.moniepointContractCode = dto.moniepointContractCode;

    // Update tenant
    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: {
        id: true,
        clinicName: true,
        currency: true,
        currencySymbol: true,
        taxEnabled: true,
        defaultTaxRate: true,
        taxName: true,
        taxId: true,
        defaultMarkupPercent: true,
        acceptCash: true,
        acceptCard: true,
        acceptMobileMoney: true,
        acceptBankTransfer: true,
        acceptInsurance: true,
        invoicePrefix: true,
        invoiceStartNumber: true,
        invoiceFooterText: true,
        termsAndConditions: true,
        overstayGraceDays: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        swiftCode: true,
        mobileMoneyProvider: true,
        mobileMoneyNumber: true,
        mobileMoneyName: true,
        paystackEnabled: true,
        paystackPublicKey: true,
        paystackSecretKey: true,
        flutterwaveEnabled: true,
        flutterwavePublicKey: true,
        flutterwaveSecretKey: true,
        moniepointEnabled: true,
        moniepointApiKey: true,
        moniepointContractCode: true,
        updatedAt: true,
      }
    });

    return updatedTenant;
  }
}
