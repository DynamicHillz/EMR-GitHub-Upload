/**
 * List Tenants Use Case Tests
 *
 * SUPER_ADMIN-only listing across all tenants - covers pagination
 * defaults/bounds and the search/status filter construction, since this
 * is the one list use-case in the codebase that deliberately has no
 * tenantId scoping.
 */

import { ListTenantsUseCase } from './list-tenants.use-case';

describe('ListTenantsUseCase', () => {
  let useCase: ListTenantsUseCase;
  let mockPrisma: any;

  const mockTenants = [{ id: 'tenant-1', name: 'Clinic A' }];

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findMany: jest.fn().mockResolvedValue(mockTenants),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    useCase = new ListTenantsUseCase(mockPrisma);
  });

  it('should default to page 1 and limit 20 with no filters', async () => {
    const result = await useCase.execute({});

    expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      })
    );
    expect(mockPrisma.tenant.count).toHaveBeenCalledWith({ where: {} });
    expect(result).toEqual({
      tenants: mockTenants,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('should apply the requested page and limit and compute the correct skip', async () => {
    await useCase.execute({ page: 3, limit: 10 });

    expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it('should fall back to page 1 when an invalid (zero/negative) page is given', async () => {
    await useCase.execute({ page: 0 });
    expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));

    await useCase.execute({ page: -5 });
    expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });

  it('should cap the limit at 100 even when a higher limit is requested', async () => {
    await useCase.execute({ limit: 500 });

    expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('should filter by status when provided', async () => {
    await useCase.execute({ status: 'SUSPENDED' });

    expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'SUSPENDED' } })
    );
  });

  it('should build a case-insensitive OR search across name/clinicName/slug', async () => {
    await useCase.execute({ search: 'stephen' });

    expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'stephen', mode: 'insensitive' } },
            { clinicName: { contains: 'stephen', mode: 'insensitive' } },
            { slug: { contains: 'stephen', mode: 'insensitive' } },
          ],
        },
      })
    );
  });

  it('should compute totalPages from the total count and limit', async () => {
    mockPrisma.tenant.count.mockResolvedValue(45);

    const result = await useCase.execute({ limit: 20 });

    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 45, totalPages: 3 });
  });
});
