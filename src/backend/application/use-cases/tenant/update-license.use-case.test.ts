/**
 * Update License Use Case Tests
 */

jest.mock('../../../infrastructure/security/license.util', () => ({
  verifyLicenseToken: jest.fn(),
}));

import { UpdateLicenseUseCase } from './update-license.use-case';
import { ValidationError } from '../../../shared/errors/AppError';
import { verifyLicenseToken } from '../../../infrastructure/security/license.util';

describe('UpdateLicenseUseCase', () => {
  let useCase: UpdateLicenseUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const token = 'some-license-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = { tenant: { update: jest.fn().mockResolvedValue({}) } };
    useCase = new UpdateLicenseUseCase(mockPrisma);
  });

  it('saves the token when it verifies successfully', async () => {
    (verifyLicenseToken as jest.Mock).mockReturnValue({
      clinicName: 'Test Clinic',
      licenseIssuedAt: '2026-01-01',
      maintenanceExpiresAt: '2027-01-01',
    });

    await useCase.execute(tenantId, token);

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: tenantId },
      data: { licenseToken: token },
    });
  });

  it('rejects with ValidationError and never saves when the token does not verify', async () => {
    (verifyLicenseToken as jest.Mock).mockReturnValue(null);

    await expect(useCase.execute(tenantId, 'garbage')).rejects.toThrow(ValidationError);
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });
});
