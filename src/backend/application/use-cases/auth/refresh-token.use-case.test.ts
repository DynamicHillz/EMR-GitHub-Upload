/**
 * Refresh Token Use Case Tests
 *
 * Covers token rotation and the invalid/revoked/expired/inactive-user
 * rejection paths, since a bug here directly affects session integrity.
 */

import { RefreshTokenUseCase } from './refresh-token.use-case';
import { TokenService } from '../../../infrastructure/services/token.service';

jest.mock('../../../infrastructure/services/token.service');

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let mockPrisma: any;

  const oldToken = 'old-refresh-token';
  const mockUser = {
    id: 'user-uuid-1',
    email: 'doctor@clinic.test',
    role: 'DOCTOR',
    tenantId: 'tenant-1',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      refreshToken: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    (TokenService.generateAccessToken as jest.Mock).mockReturnValue('new-access-token');
    (TokenService.generateRefreshToken as jest.Mock).mockReturnValue('new-refresh-token');
    (TokenService.calculateExpiryDate as jest.Mock).mockReturnValue(new Date('2099-01-01'));
    (TokenService.getTokenExpiry as jest.Mock).mockReturnValue(3600);

    useCase = new RefreshTokenUseCase(mockPrisma);
  });

  it('should rotate the refresh token and issue a new access token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      token: oldToken,
      revoked: false,
      expiresAt: new Date('2099-01-01'),
      ipAddress: '10.0.0.5',
      userAgent: 'test-agent',
      user: mockUser,
    });

    const result = await useCase.execute(oldToken);

    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
      where: { token: oldToken },
      data: { revoked: true },
    });
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: mockUser.id,
          token: 'new-refresh-token',
          ipAddress: '10.0.0.5',
          userAgent: 'test-agent',
        }),
      })
    );
    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
    });
  });

  it('should carry forward the original session ip/userAgent when the request has none', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      token: oldToken,
      revoked: false,
      expiresAt: new Date('2099-01-01'),
      ipAddress: '10.0.0.5',
      userAgent: 'original-agent',
      user: mockUser,
    });

    await useCase.execute(oldToken, {});

    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ipAddress: '10.0.0.5', userAgent: 'original-agent' }),
      })
    );
  });

  it('should reject a refresh token that does not exist', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(useCase.execute('nonexistent')).rejects.toThrow('Invalid refresh token');
    expect(mockPrisma.refreshToken.update).not.toHaveBeenCalled();
  });

  it('should reject a revoked refresh token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      token: oldToken,
      revoked: true,
      expiresAt: new Date('2099-01-01'),
      user: mockUser,
    });

    await expect(useCase.execute(oldToken)).rejects.toThrow('Refresh token has been revoked');
  });

  it('should reject an expired refresh token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      token: oldToken,
      revoked: false,
      expiresAt: new Date('2000-01-01'),
      user: mockUser,
    });

    await expect(useCase.execute(oldToken)).rejects.toThrow('Refresh token has expired');
  });

  it('should reject when the user account is no longer active', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      token: oldToken,
      revoked: false,
      expiresAt: new Date('2099-01-01'),
      user: { ...mockUser, status: 'SUSPENDED' },
    });

    await expect(useCase.execute(oldToken)).rejects.toThrow('User account is not active');
    expect(mockPrisma.refreshToken.update).not.toHaveBeenCalled();
  });
});
