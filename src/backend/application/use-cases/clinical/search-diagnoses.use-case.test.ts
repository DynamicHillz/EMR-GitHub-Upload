/**
 * Search Diagnoses Use Case Tests
 */

import { SearchDiagnosesUseCase } from './search-diagnoses.use-case';

describe('SearchDiagnosesUseCase', () => {
  let useCase: SearchDiagnosesUseCase;
  let mockPrisma: any;
  let fetchMock: jest.Mock;

  const tenantId = 'tenant-1';
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockPrisma = {
      diagnosisCatalog: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
    };
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    useCase = new SearchDiagnosesUseCase(mockPrisma);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('returns an empty array immediately when query is empty', async () => {
    const result = await useCase.execute('', 'ICD-11', tenantId);
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('ICD-11 (default)', () => {
    it('calls the WHO API and upserts each result as a tenant-scoped row', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          destinationEntities: [{ theCode: '1A00', title: 'Cholera' }],
        }),
      });
      mockPrisma.diagnosisCatalog.upsert.mockResolvedValue({
        id: 'cat-1',
        tenantId,
        code: '1A00',
        name: 'Cholera',
        type: 'ICD-11',
        isActive: true,
      });

      const result = await useCase.execute('cholera', 'ICD-11', tenantId);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/icd/release/11/'),
        expect.any(Object)
      );
      expect(mockPrisma.diagnosisCatalog.upsert).toHaveBeenCalledWith({
        where: { tenantId_code: { tenantId, code: '1A00' } },
        update: { name: 'Cholera', isActive: true },
        create: { tenantId, code: '1A00', name: 'Cholera', type: 'ICD-11', isActive: true },
      });
      expect(result).toEqual([
        { id: 'cat-1', tenantId, code: '1A00', name: 'Cholera', description: null, type: 'ICD-11', isActive: true },
      ]);
    });

    it('falls back to a local catalog search (tenant + global rows) when the WHO API call fails', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 });
      mockPrisma.diagnosisCatalog.findMany.mockResolvedValue([
        { id: 'cat-2', tenantId: null, code: 'A09', name: 'Gastroenteritis', type: 'ICD-11', isActive: true },
      ]);

      const result = await useCase.execute('gastro', 'ICD-11', tenantId);

      expect(mockPrisma.diagnosisCatalog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'ICD-11',
            isActive: true,
            OR: [{ tenantId }, { tenantId: null }],
          }),
        })
      );
      expect(result[0].id).toBe('cat-2');
    });

    it('returns an empty array when both the WHO API and the local fallback fail', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      mockPrisma.diagnosisCatalog.findMany.mockRejectedValue(new Error('db down'));

      const result = await useCase.execute('x', 'ICD-11', tenantId);

      expect(result).toEqual([]);
    });
  });

  describe('ICD-10', () => {
    it('never calls the WHO API and queries the local catalog directly, including global rows', async () => {
      mockPrisma.diagnosisCatalog.findMany.mockResolvedValue([
        { id: 'cat-3', tenantId: null, code: 'I10', name: 'Essential (primary) hypertension', type: 'ICD-10', isActive: true },
      ]);

      const result = await useCase.execute('hypertension', 'ICD-10', tenantId);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockPrisma.diagnosisCatalog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'ICD-10',
            isActive: true,
            OR: [{ tenantId }, { tenantId: null }],
          }),
        })
      );
      expect(result).toEqual([
        { id: 'cat-3', tenantId: null, code: 'I10', name: 'Essential (primary) hypertension', description: null, type: 'ICD-10', isActive: true },
      ]);
    });
  });
});
