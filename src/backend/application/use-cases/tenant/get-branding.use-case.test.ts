/**
 * Get Branding Use Case Tests
 */

import { GetBrandingUseCase } from './get-branding.use-case';

describe('GetBrandingUseCase', () => {
  let useCase: GetBrandingUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  const mockBranding = {
    id: tenantId,
    name: 'St Stephen Clinic',
    clinicName: 'St Stephen Medical Center',
    logoUrl: 'https://example.test/logo.png',
    primaryColor: '#3b82f6',
    secondaryColor: '#10b981',
    accentColor: '#f59e0b',
    fontFamily: 'Inter',
    address: '12 Clinic Road',
    phone: '+2348012345678',
    email: 'clinic@example.test',
    taxId: 'TIN-12345',
    taxName: 'VAT',
  };

  beforeEach(() => {
    mockPrisma = {
      tenant: { findUnique: jest.fn() },
    };

    useCase = new GetBrandingUseCase(mockPrisma);
  });

  it('should query the tenant scoped by id and return branding settings', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(mockBranding);

    const result = await useCase.execute(tenantId);

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        clinicName: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        fontFamily: true,
        address: true,
        phone: true,
        email: true,
        taxId: true,
        taxName: true,
      },
    });
    expect(result).toEqual(mockBranding);
  });

  it('should throw NotFoundError when the tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(tenantId)).rejects.toThrow(
      `Tenant with identifier '${tenantId}' not found`
    );
  });
});
