/**
 * Update Tenant Status Use Case Tests
 *
 * Suspending/reactivating/deactivating a whole clinic is security-relevant
 * (login and auth middleware gate on tenant.status), so this covers the
 * valid-status allowlist, the not-found path, and the audit trail written
 * on every successful change.
 */

import { UpdateTenantStatusUseCase } from './update-tenant-status.use-case';

describe('UpdateTenantStatusUseCase', () => {
  let useCase: UpdateTenantStatusUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const updatedBy = 'super-admin-uuid-1';

  const mockTenant = { id: tenantId, name: 'St Stephen Clinic', slug: 'st-stephen-clinic', status: 'ACTIVE' };
  const mockUpdated = { id: tenantId, name: mockTenant.name, slug: mockTenant.slug, status: 'SUSPENDED', updatedAt: new Date('2026-07-27T00:00:00.000Z') };

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(mockTenant),
        update: jest.fn().mockResolvedValue(mockUpdated),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    useCase = new UpdateTenantStatusUseCase(mockPrisma);
  });

  it('should update the tenant status and write an audit log entry', async () => {
    const result = await useCase.execute(tenantId, 'SUSPENDED', updatedBy);

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: tenantId } });
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: tenantId },
      data: { status: 'SUSPENDED' },
      select: { id: true, name: true, slug: true, status: true, updatedAt: true },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: updatedBy,
        tenantId,
        action: 'TENANT_STATUS_CHANGED',
        entityType: 'TENANT',
        entityId: tenantId,
        oldValues: JSON.stringify({ status: 'ACTIVE' }),
        newValues: JSON.stringify({ status: 'SUSPENDED' }),
        metadata: expect.stringContaining(updatedBy),
      },
    });
    expect(result).toEqual(mockUpdated);
  });

  it.each(['ACTIVE', 'SUSPENDED', 'INACTIVE'])('should accept the valid status %s', async (status) => {
    mockPrisma.tenant.update.mockResolvedValue({ ...mockUpdated, status });

    await expect(useCase.execute(tenantId, status, updatedBy)).resolves.toEqual(
      expect.objectContaining({ status })
    );
  });

  it('should reject an invalid status', async () => {
    await expect(useCase.execute(tenantId, 'DELETED', updatedBy)).rejects.toThrow(
      'Status must be one of: ACTIVE, SUSPENDED, INACTIVE'
    );
    expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, 'SUSPENDED', updatedBy)).rejects.toThrow(
      `Tenant with identifier '${tenantId}' not found`
    );
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});
