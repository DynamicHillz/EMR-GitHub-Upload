/**
 * License Controller Tests
 */

const mockPrismaInstance = {
  tenant: { findUnique: jest.fn(), update: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaInstance),
}));

import { getLicenseStatus, updateLicense } from './license.controller';

describe('license.controller', () => {
  const tenantId = 'tenant-1';

  const mockReq = (body: any = {}) => ({ user: { tenantId }, body } as any);
  const mockRes = () => {
    const res: any = {};
    res.json = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLicenseStatus', () => {
    it('returns the derived status for the caller\'s tenant', async () => {
      mockPrismaInstance.tenant.findUnique.mockResolvedValue({ licenseToken: null });

      const res = mockRes();
      await getLicenseStatus(mockReq(), res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { status: 'MISSING', claims: null, daysRemaining: null },
      });
    });

    it('returns a 404 when the tenant record is missing', async () => {
      mockPrismaInstance.tenant.findUnique.mockResolvedValue(null);

      const res = mockRes();
      await getLicenseStatus(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateLicense', () => {
    it('returns a 400 for a token that fails verification, without saving', async () => {
      const res = mockRes();
      await updateLicense(mockReq({ licenseToken: 'not-a-real-token' }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockPrismaInstance.tenant.update).not.toHaveBeenCalled();
    });
  });
});
