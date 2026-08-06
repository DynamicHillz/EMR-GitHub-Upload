/**
 * Get Postnatal Worklist Use Case Tests
 */

import { GetPostnatalWorklistUseCase } from './get-postnatal-worklist.use-case';

describe('GetPostnatalWorklistUseCase', () => {
  let useCase: GetPostnatalWorklistUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  const patient = { id: 'mother-1', firstName: 'Jane', lastName: 'Doe', patientId: 'PT-2026-0001' };

  beforeEach(() => {
    mockPrisma = {
      laborRecord: { findMany: jest.fn().mockResolvedValue([]) },
      postnatalVisit: { findMany: jest.fn().mockResolvedValue([]) },
      worklistDismissal: { findMany: jest.fn().mockResolvedValue([]) },
    };
    useCase = new GetPostnatalWorklistUseCase(mockPrisma);
  });

  it('flags the 24h contact as due once it has passed and nothing is recorded', async () => {
    mockPrisma.laborRecord.findMany.mockResolvedValue([
      { id: 'labor-1', patientId: 'mother-1', pregnancyId: null, deliveredAt: new Date(Date.now() - 25 * HOUR), patient },
    ]);

    const result = await useCase.execute(tenantId, 7);

    const dueTypes = result.filter((r) => r.laborRecordId === 'labor-1').map((r) => r.contactType);
    expect(dueTypes).toContain('PNC_24H');
  });

  it('does not flag a contact that is not due yet within the window', async () => {
    mockPrisma.laborRecord.findMany.mockResolvedValue([
      { id: 'labor-1', patientId: 'mother-1', pregnancyId: null, deliveredAt: new Date(), patient },
    ]);

    const result = await useCase.execute(tenantId, 7);

    // Delivered just now — week 6 contact is ~42 days out, well past a 7-day window.
    expect(result.some((r) => r.contactType === 'PNC_WEEK6')).toBe(false);
  });

  it('excludes a contact that has already been recorded', async () => {
    mockPrisma.laborRecord.findMany.mockResolvedValue([
      { id: 'labor-1', patientId: 'mother-1', pregnancyId: 'preg-1', deliveredAt: new Date(Date.now() - 25 * HOUR), patient },
    ]);
    mockPrisma.postnatalVisit.findMany.mockResolvedValue([{ patientId: 'mother-1', pregnancyId: 'preg-1', contactType: 'PNC_24H' }]);

    const result = await useCase.execute(tenantId, 7);

    expect(result.some((r) => r.laborRecordId === 'labor-1' && r.contactType === 'PNC_24H')).toBe(false);
  });

  it('excludes a contact that has been dismissed', async () => {
    mockPrisma.laborRecord.findMany.mockResolvedValue([
      { id: 'labor-1', patientId: 'mother-1', pregnancyId: 'preg-1', deliveredAt: new Date(Date.now() - 25 * HOUR), patient },
    ]);
    mockPrisma.worklistDismissal.findMany.mockResolvedValue([{ patientId: 'mother-1', pregnancyId: 'preg-1', contactType: 'PNC_24H' }]);

    const result = await useCase.execute(tenantId, 7);

    expect(result.some((r) => r.laborRecordId === 'labor-1' && r.contactType === 'PNC_24H')).toBe(false);
  });

  it('bounds the laborRecord query to deliveries within the last 6 weeks', async () => {
    await useCase.execute(tenantId, 7);

    const where = mockPrisma.laborRecord.findMany.mock.calls[0][0].where;
    const gte: Date = where.deliveredAt.gte;
    const expectedSixWeeksAgo = Date.now() - 42 * DAY;
    // Allow a small tolerance for time elapsed between computing the
    // expected value here and inside the use case.
    expect(Math.abs(gte.getTime() - expectedSixWeeksAgo)).toBeLessThan(5000);
  });

  it('scopes the postnatalVisit/dismissal lookups to mothers from the bounded delivery set', async () => {
    mockPrisma.laborRecord.findMany.mockResolvedValue([
      { id: 'labor-1', patientId: 'mother-1', pregnancyId: null, deliveredAt: new Date(Date.now() - 25 * HOUR), patient },
    ]);

    await useCase.execute(tenantId, 7);

    expect(mockPrisma.postnatalVisit.findMany.mock.calls[0][0].where.patientId).toEqual({ in: ['mother-1'] });
    expect(mockPrisma.worklistDismissal.findMany.mock.calls[0][0].where.patientId).toEqual({ in: ['mother-1'] });
  });

  it('sorts results by expected date ascending', async () => {
    mockPrisma.laborRecord.findMany.mockResolvedValue([
      { id: 'labor-1', patientId: 'mother-1', pregnancyId: null, deliveredAt: new Date(Date.now() - 8 * DAY), patient },
    ]);

    const result = await useCase.execute(tenantId, 7);

    const dates = result.map((r) => new Date(r.expectedDate).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
});
