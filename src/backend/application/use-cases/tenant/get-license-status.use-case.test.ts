/**
 * Get License Status Use Case Tests
 */

import { GetLicenseStatusUseCase } from './get-license-status.use-case';
import { NotFoundError } from '../../../shared/errors/AppError';

describe('GetLicenseStatusUseCase', () => {
  let useCase: GetLicenseStatusUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    mockPrisma = { tenant: { findUnique: jest.fn() } };
    useCase = new GetLicenseStatusUseCase(mockPrisma);
  });

  it('reports MISSING when the tenant has no license token stored', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ licenseToken: null });

    const result = await useCase.execute(tenantId);

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: tenantId },
      select: { licenseToken: true },
    });
    expect(result.status).toBe('MISSING');
  });

  it('throws NotFoundError when the tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(tenantId)).rejects.toThrow(NotFoundError);
  });
});
