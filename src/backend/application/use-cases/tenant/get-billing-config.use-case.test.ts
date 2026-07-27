/**
 * Get Billing Config Use Case Tests
 */

import { GetBillingConfigUseCase } from './get-billing-config.use-case';

describe('GetBillingConfigUseCase', () => {
  let useCase: GetBillingConfigUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  const mockConfig = {
    id: tenantId,
    clinicName: 'St Stephen Medical Center',
    currency: 'NGN',
    currencySymbol: '₦',
    taxEnabled: true,
    defaultTaxRate: 7.5,
    taxName: 'VAT',
    taxId: 'TIN-12345',
    defaultMarkupPercent: 20,
    acceptCash: true,
    acceptCard: false,
    acceptMobileMoney: true,
    acceptBankTransfer: true,
    acceptInsurance: false,
    invoicePrefix: 'INV',
    invoiceStartNumber: 1000,
    invoiceFooterText: 'Thank you',
    termsAndConditions: 'Terms apply',
    bankName: 'Test Bank',
    accountNumber: '0123456789',
    accountName: 'St Stephen Clinic',
    swiftCode: 'TESTNGLA',
    mobileMoneyProvider: 'MTN',
    mobileMoneyNumber: '08012345678',
    mobileMoneyName: 'St Stephen Clinic',
    paystackEnabled: false,
    paystackPublicKey: null,
    paystackSecretKey: null,
    flutterwaveEnabled: false,
    flutterwavePublicKey: null,
    flutterwaveSecretKey: null,
    moniepointEnabled: false,
    moniepointApiKey: null,
    moniepointContractCode: null,
  };

  beforeEach(() => {
    mockPrisma = {
      tenant: { findUnique: jest.fn() },
    };

    useCase = new GetBillingConfigUseCase(mockPrisma);
  });

  it('should query the tenant scoped by id and return the billing config', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(mockConfig);

    const result = await useCase.execute(tenantId);

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: tenantId },
        select: expect.objectContaining({
          currency: true,
          taxEnabled: true,
          defaultTaxRate: true,
          acceptCash: true,
          invoicePrefix: true,
          paystackEnabled: true,
          moniepointContractCode: true,
        }),
      })
    );
    expect(result).toEqual(mockConfig);
  });

  it('should throw NotFoundError when the tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(tenantId)).rejects.toThrow(
      `Tenant with identifier '${tenantId}' not found`
    );
  });
});
