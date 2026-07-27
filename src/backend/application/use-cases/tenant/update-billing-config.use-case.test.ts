/**
 * Update Billing Config Use Case Tests
 */

import { UpdateBillingConfigUseCase } from './update-billing-config.use-case';

describe('UpdateBillingConfigUseCase', () => {
  let useCase: UpdateBillingConfigUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const mockTenant = { id: tenantId, clinicName: 'St Stephen Medical Center' };
  const mockUpdatedTenant = { id: tenantId, currency: 'NGN', defaultTaxRate: 7.5 };

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(mockTenant),
        update: jest.fn().mockResolvedValue(mockUpdatedTenant),
      },
    };

    useCase = new UpdateBillingConfigUseCase(mockPrisma);
  });

  it('should update only the fields provided in the dto', async () => {
    const dto = { currency: 'NGN', defaultTaxRate: 7.5, acceptCash: true };

    const result = await useCase.execute(tenantId, dto);

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: tenantId } });
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: tenantId },
        data: { currency: 'NGN', defaultTaxRate: 7.5, acceptCash: true },
      })
    );
    expect(result).toEqual(mockUpdatedTenant);
  });

  it('should send an empty update payload when no fields are provided', async () => {
    await useCase.execute(tenantId, {});

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(expect.objectContaining({ data: {} }));
  });

  it('should throw NotFoundError when the tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, { currency: 'NGN' })).rejects.toThrow(
      `Tenant with identifier '${tenantId}' not found`
    );
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });

  it('should reject a negative tax rate', async () => {
    await expect(useCase.execute(tenantId, { defaultTaxRate: -1 })).rejects.toThrow(
      'Tax rate must be between 0 and 100'
    );
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });

  it('should reject a tax rate above 100', async () => {
    await expect(useCase.execute(tenantId, { defaultTaxRate: 101 })).rejects.toThrow(
      'Tax rate must be between 0 and 100'
    );
  });

  it('should reject an invoice start number below 1', async () => {
    await expect(useCase.execute(tenantId, { invoiceStartNumber: 0 })).rejects.toThrow(
      'Invoice start number must be at least 1'
    );
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });

  it('should reject a negative markup percent', async () => {
    await expect(useCase.execute(tenantId, { defaultMarkupPercent: -5 })).rejects.toThrow(
      'Markup percent must be between 0 and 1000'
    );
  });

  it('should reject a markup percent above 1000', async () => {
    await expect(useCase.execute(tenantId, { defaultMarkupPercent: 1001 })).rejects.toThrow(
      'Markup percent must be between 0 and 1000'
    );
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });
});
