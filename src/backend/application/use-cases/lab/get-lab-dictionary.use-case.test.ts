/**
 * Get Lab Dictionary Use Case Tests
 */

import { GetLabDictionaryUseCase } from './get-lab-dictionary.use-case';

describe('GetLabDictionaryUseCase', () => {
  let useCase: GetLabDictionaryUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const includeShape = {
    parameters: {
      include: { parameter: true },
      orderBy: { displayOrder: 'asc' },
    },
  };

  beforeEach(() => {
    mockPrisma = {
      labTest: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    useCase = new GetLabDictionaryUseCase(mockPrisma);
  });

  it('should look up a single test by name (testCode) when provided', async () => {
    const test = { id: 'test-1', name: 'CBC' };
    mockPrisma.labTest.findFirst.mockResolvedValue(test);

    const result = await useCase.execute(tenantId, 'CBC');

    expect(mockPrisma.labTest.findFirst).toHaveBeenCalledWith({
      where: { tenantId, name: 'CBC' },
      include: includeShape,
    });
    expect(mockPrisma.labTest.findMany).not.toHaveBeenCalled();
    expect(result).toEqual(test);
  });

  it('should list all active tests scoped to the tenant when no testCode is provided', async () => {
    const tests = [{ id: 'test-1' }, { id: 'test-2' }];
    mockPrisma.labTest.findMany.mockResolvedValue(tests);

    const result = await useCase.execute(tenantId);

    expect(mockPrisma.labTest.findMany).toHaveBeenCalledWith({
      where: { tenantId, isActive: true },
      include: includeShape,
    });
    expect(mockPrisma.labTest.findFirst).not.toHaveBeenCalled();
    expect(result).toEqual(tests);
  });

  it('should return null when a testCode lookup finds nothing', async () => {
    mockPrisma.labTest.findFirst.mockResolvedValue(null);

    const result = await useCase.execute(tenantId, 'UNKNOWN');

    expect(result).toBeNull();
  });
});
