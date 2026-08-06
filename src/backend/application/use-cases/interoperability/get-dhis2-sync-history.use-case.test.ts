import { GetDhis2SyncHistoryUseCase } from './get-dhis2-sync-history.use-case';

describe('GetDhis2SyncHistoryUseCase', () => {
  let useCase: GetDhis2SyncHistoryUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    mockPrisma = { dhis2SyncLog: { findMany: jest.fn().mockResolvedValue([]) } };
    useCase = new GetDhis2SyncHistoryUseCase(mockPrisma);
  });

  it('queries logs scoped to the tenant, most recent first, defaulting to 20', async () => {
    await useCase.execute(tenantId);

    expect(mockPrisma.dhis2SyncLog.findMany).toHaveBeenCalledWith({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { triggeredBy: { select: { firstName: true, lastName: true } } },
    });
  });

  it('respects a custom limit when provided', async () => {
    await useCase.execute(tenantId, 5);

    expect(mockPrisma.dhis2SyncLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});
