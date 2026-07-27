/**
 * Update Fraud Prevention Settings Use Case Tests
 *
 * Covers the upsert-not-update semantics (a tenant may never have had a
 * settings row seeded), the generic negative-number guard applied across
 * every numeric field, and the duplicateAmountTolerancePercent upper bound.
 */

import { UpdateFraudPreventionSettingsUseCase } from './update-fraud-prevention-settings.use-case';

describe('UpdateFraudPreventionSettingsUseCase', () => {
  let useCase: UpdateFraudPreventionSettingsUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const mockTenant = { id: tenantId };
  const mockUpdatedSettings = { id: 'settings-uuid-1', tenantId, cashApprovalThreshold: 60000 };

  beforeEach(() => {
    mockPrisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue(mockTenant) },
      fraudPreventionSettings: { upsert: jest.fn().mockResolvedValue(mockUpdatedSettings) },
    };

    useCase = new UpdateFraudPreventionSettingsUseCase(mockPrisma);
  });

  it('should upsert settings with create/update payloads built from the dto', async () => {
    const dto = { cashApprovalThreshold: 60000, requireReceiptPhotoForCash: false };

    const result = await useCase.execute(tenantId, dto);

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: tenantId } });
    expect(mockPrisma.fraudPreventionSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId },
        create: { tenantId, ...dto },
        update: dto,
      })
    );
    expect(result).toEqual(mockUpdatedSettings);
  });

  it('should throw NotFoundError when the tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, { cashApprovalThreshold: 1000 })).rejects.toThrow(
      `Tenant with identifier '${tenantId}' not found`
    );
    expect(mockPrisma.fraudPreventionSettings.upsert).not.toHaveBeenCalled();
  });

  it('should reject any negative numeric field with a field-specific message', async () => {
    await expect(useCase.execute(tenantId, { cashApprovalThreshold: -1 })).rejects.toThrow(
      'cashApprovalThreshold cannot be negative'
    );
    expect(mockPrisma.fraudPreventionSettings.upsert).not.toHaveBeenCalled();
  });

  it('should reject a negative dailyCashLimitPerUser', async () => {
    await expect(useCase.execute(tenantId, { dailyCashLimitPerUser: -100 })).rejects.toThrow(
      'dailyCashLimitPerUser cannot be negative'
    );
  });

  it('should reject duplicateAmountTolerancePercent above 100', async () => {
    await expect(
      useCase.execute(tenantId, { duplicateAmountTolerancePercent: 150 })
    ).rejects.toThrow('duplicateAmountTolerancePercent cannot exceed 100');
    expect(mockPrisma.fraudPreventionSettings.upsert).not.toHaveBeenCalled();
  });

  it('should accept duplicateAmountTolerancePercent at exactly 100', async () => {
    await useCase.execute(tenantId, { duplicateAmountTolerancePercent: 100 });

    expect(mockPrisma.fraudPreventionSettings.upsert).toHaveBeenCalled();
  });
});
