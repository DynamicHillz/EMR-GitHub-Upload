/**
 * Notification Service Tests — notifyRoleWithCooldown
 */

import { NotificationService } from './notification.service';

describe('NotificationService.notifyRoleWithCooldown', () => {
  let service: NotificationService;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const input = {
    type: 'CRITICAL_VITAL_SIGN',
    severity: 'CRITICAL' as const,
    title: 'Critical Vital Sign',
    message: 'Jane Doe — HR high',
    entityType: 'Admission',
    entityId: 'admission-1',
  };

  beforeEach(() => {
    mockPrisma = {
      notification: {
        findFirst: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }]),
      },
    };
    service = new NotificationService(mockPrisma);
  });

  it('does not create a notification when one already fired within the cooldown window', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue({ id: 'existing-notification' });

    await service.notifyRoleWithCooldown(tenantId, ['DOCTOR', 'NURSE'], input, 30);

    expect(mockPrisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, type: input.type, entityId: input.entityId }),
      })
    );
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('creates a notification when nothing fired within the cooldown window', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    await service.notifyRoleWithCooldown(tenantId, ['DOCTOR', 'NURSE'], input, 30);

    expect(mockPrisma.user.findMany).toHaveBeenCalled();
    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ tenantId, userId: 'user-1', type: input.type, entityId: input.entityId })],
      })
    );
  });

  it('scopes the cooldown lookup to a createdAt cutoff matching the requested window', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    await service.notifyRoleWithCooldown(tenantId, ['DOCTOR', 'NURSE'], input, 30);

    const cutoff: Date = mockPrisma.notification.findFirst.mock.calls[0][0].where.createdAt.gte;
    const expectedCutoff = Date.now() - 30 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5000);
  });
});
