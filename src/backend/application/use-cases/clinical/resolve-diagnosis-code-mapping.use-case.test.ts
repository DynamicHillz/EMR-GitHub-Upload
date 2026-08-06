/**
 * Resolve Diagnosis Code Mapping Use Case Tests
 */

import { ResolveDiagnosisCodeMappingUseCase } from './resolve-diagnosis-code-mapping.use-case';

describe('ResolveDiagnosisCodeMappingUseCase', () => {
  let useCase: ResolveDiagnosisCodeMappingUseCase;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      diagnosisCodeMapping: { findMany: jest.fn() },
    };
    useCase = new ResolveDiagnosisCodeMappingUseCase(mockPrisma);
  });

  it('returns an empty array when no mapping exists for the given system/code', async () => {
    mockPrisma.diagnosisCodeMapping.findMany.mockResolvedValue([]);

    const result = await useCase.execute('ICD-11', '1A00');

    expect(mockPrisma.diagnosisCodeMapping.findMany).toHaveBeenCalledWith({
      where: { sourceSystem: 'ICD-11', sourceCode: '1A00' },
    });
    expect(result).toEqual([]);
  });

  it('returns a single exact mapping', async () => {
    mockPrisma.diagnosisCodeMapping.findMany.mockResolvedValue([
      { id: 'm1', sourceSystem: 'ICD-11', sourceCode: '1A00', targetSystem: 'ICD-10', targetCode: 'A00', mapKind: 'EXACT', note: null },
    ]);

    const result = await useCase.execute('ICD-11', '1A00');

    expect(result).toEqual([
      { targetSystem: 'ICD-10', targetCode: 'A00', mapKind: 'EXACT', note: null },
    ]);
  });

  it('returns every target for a one-to-many mapping, not just the first', async () => {
    mockPrisma.diagnosisCodeMapping.findMany.mockResolvedValue([
      { id: 'm1', sourceSystem: 'ICD-10', sourceCode: 'I10', targetSystem: 'ICD-11', targetCode: 'BA00', mapKind: 'ONE_TO_MANY', note: 'primary' },
      { id: 'm2', sourceSystem: 'ICD-10', sourceCode: 'I10', targetSystem: 'ICD-11', targetCode: 'BA01', mapKind: 'ONE_TO_MANY', note: 'secondary' },
    ]);

    const result = await useCase.execute('ICD-10', 'I10');

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.targetCode)).toEqual(['BA00', 'BA01']);
  });

  it('carries the approximate mapKind through unchanged', async () => {
    mockPrisma.diagnosisCodeMapping.findMany.mockResolvedValue([
      { id: 'm1', sourceSystem: 'ICD-11', sourceCode: 'BA00', targetSystem: 'ICD-10', targetCode: 'I10', mapKind: 'APPROXIMATE', note: 'not an exact clinical match' },
    ]);

    const result = await useCase.execute('ICD-11', 'BA00');

    expect(result[0].mapKind).toBe('APPROXIMATE');
  });
});
