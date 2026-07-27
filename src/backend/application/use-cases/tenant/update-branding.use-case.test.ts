/**
 * Update Branding Use Case Tests
 */

import { UpdateBrandingUseCase } from './update-branding.use-case';

describe('UpdateBrandingUseCase', () => {
  let useCase: UpdateBrandingUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  const mockTenant = {
    id: tenantId,
    clinicName: 'Existing Clinic Name',
    address: 'Existing Address',
    logoUrl: 'https://example.test/existing-logo.png',
    primaryColor: '#111111',
    secondaryColor: '#222222',
    accentColor: '#333333',
    fontFamily: 'Existing Font',
  };

  const mockUpdatedTenant = { ...mockTenant, updatedAt: new Date('2026-07-27T00:00:00.000Z') };

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(mockTenant),
        update: jest.fn().mockResolvedValue(mockUpdatedTenant),
      },
    };

    useCase = new UpdateBrandingUseCase(mockPrisma);
  });

  it('should update branding fields with valid hex colors', async () => {
    const dto = {
      clinicName: 'New Clinic Name',
      primaryColor: '#3b82f6',
      secondaryColor: '#10b981',
      accentColor: '#f59e0b',
      fontFamily: 'Inter',
    };

    const result = await useCase.execute(tenantId, dto);

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: tenantId },
      data: {
        clinicName: 'New Clinic Name',
        address: mockTenant.address,
        logoUrl: mockTenant.logoUrl,
        primaryColor: '#3b82f6',
        secondaryColor: '#10b981',
        accentColor: '#f59e0b',
        fontFamily: 'Inter',
      },
      select: expect.objectContaining({ id: true, primaryColor: true }),
    });
    expect(result).toEqual(mockUpdatedTenant);
  });

  it('should accept a shorthand 3-digit hex color', async () => {
    await useCase.execute(tenantId, { primaryColor: '#fff' });

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ primaryColor: '#fff' }) })
    );
  });

  it('should fall back to the existing tenant values for fields not provided', async () => {
    await useCase.execute(tenantId, {});

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          clinicName: mockTenant.clinicName,
          address: mockTenant.address,
          logoUrl: mockTenant.logoUrl,
          primaryColor: mockTenant.primaryColor,
          secondaryColor: mockTenant.secondaryColor,
          accentColor: mockTenant.accentColor,
          fontFamily: mockTenant.fontFamily,
        },
      })
    );
  });

  it('should allow explicitly clearing the address and logoUrl to null', async () => {
    await useCase.execute(tenantId, { address: null, logoUrl: null } as any);

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ address: null, logoUrl: null }) })
    );
  });

  it('should throw NotFoundError when the tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, {})).rejects.toThrow(
      `Tenant with identifier '${tenantId}' not found`
    );
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });

  it('should reject an invalid primary color', async () => {
    await expect(useCase.execute(tenantId, { primaryColor: 'blue' })).rejects.toThrow(
      'Primary color must be a valid hex color'
    );
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });

  it('should reject an invalid secondary color', async () => {
    await expect(useCase.execute(tenantId, { secondaryColor: 'not-a-color' })).rejects.toThrow(
      'Secondary color must be a valid hex color'
    );
  });

  it('should reject an invalid accent color', async () => {
    await expect(useCase.execute(tenantId, { accentColor: '123456' })).rejects.toThrow(
      'Accent color must be a valid hex color'
    );
  });
});
