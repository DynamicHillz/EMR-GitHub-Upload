/**
 * Update Lab Dictionary Item Use Case Tests
 */

import { UpdateLabDictionaryItemUseCase } from './update-lab-dictionary-item.use-case';

describe('UpdateLabDictionaryItemUseCase', () => {
  let useCase: UpdateLabDictionaryItemUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const testId = 'test-1';

  const existingTest = {
    id: testId,
    tenantId,
    name: 'CBC',
    category: 'Hematology',
    price: 500,
    isActive: true,
  };

  const updatedTest = { ...existingTest, name: 'CBC Panel' };
  const finalTest = { ...updatedTest, parameters: [] };

  beforeEach(() => {
    mockPrisma = {
      labTest: {
        findFirst: jest.fn().mockResolvedValue(existingTest),
        update: jest.fn().mockResolvedValue(updatedTest),
        findUnique: jest.fn().mockResolvedValue(finalTest),
      },
      labTestParameter: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      labParameter: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-param', tenantId }),
      },
    };

    useCase = new UpdateLabDictionaryItemUseCase(mockPrisma);
  });

  it('should throw when the test does not belong to this tenant', async () => {
    mockPrisma.labTest.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, testId, { name: 'X' })).rejects.toThrow(
      'Lab test not found or unauthorized'
    );
    expect(mockPrisma.labTest.update).not.toHaveBeenCalled();
  });

  it('should update only the provided fields, defaulting to existing values otherwise', async () => {
    await useCase.execute(tenantId, testId, { name: 'CBC Panel' });

    expect(mockPrisma.labTest.update).toHaveBeenCalledWith({
      where: { id: testId },
      data: {
        name: 'CBC Panel',
        category: existingTest.category,
        price: existingTest.price,
        isActive: existingTest.isActive,
      },
    });
  });

  it('should parse a provided price to an integer', async () => {
    await useCase.execute(tenantId, testId, { price: '750' });

    expect(mockPrisma.labTest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ price: 750 }) })
    );
  });

  it('should respect an explicit isActive: false', async () => {
    await useCase.execute(tenantId, testId, { isActive: false });

    expect(mockPrisma.labTest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) })
    );
  });

  it('should not touch parameter links when parameters is not provided', async () => {
    await useCase.execute(tenantId, testId, { name: 'CBC Panel' });

    expect(mockPrisma.labTestParameter.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.labTestParameter.create).not.toHaveBeenCalled();
  });

  it('should replace parameter links: delete existing links, create a new parameter (no id given), and link it', async () => {
    mockPrisma.labParameter.create.mockResolvedValue({ id: 'new-param' });

    await useCase.execute(tenantId, testId, {
      parameters: [{ name: 'Hemoglobin', unit: 'g/dL', refRangeMale: '13-17', refRangeFemale: '12-15' }],
    });

    expect(mockPrisma.labTestParameter.deleteMany).toHaveBeenCalledWith({ where: { testId } });
    expect(mockPrisma.labParameter.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        name: 'Hemoglobin',
        unit: 'g/dL',
        refRangeMale: '13-17',
        refRangeFemale: '12-15',
      },
    });
    expect(mockPrisma.labParameter.update).not.toHaveBeenCalled();
    expect(mockPrisma.labTestParameter.create).toHaveBeenCalledWith({
      data: { testId: updatedTest.id, parameterId: 'new-param', displayOrder: 0 },
    });
  });

  it('should update an existing parameter in place (by id) and re-link it, without creating a new parameter row', async () => {
    await useCase.execute(tenantId, testId, {
      parameters: [{ id: 'existing-param', name: 'Hemoglobin Updated', unit: 'g/dL', displayOrder: 5 }],
    });

    expect(mockPrisma.labParameter.create).not.toHaveBeenCalled();
    expect(mockPrisma.labParameter.update).toHaveBeenCalledWith({
      where: { id: 'existing-param' },
      data: {
        name: 'Hemoglobin Updated',
        unit: 'g/dL',
        refRangeMale: undefined,
        refRangeFemale: undefined,
      },
    });
    expect(mockPrisma.labTestParameter.create).toHaveBeenCalledWith({
      data: { testId: updatedTest.id, parameterId: 'existing-param', displayOrder: 5 },
    });
  });

  it('should reject updating an existing parameter id that does not belong to this tenant', async () => {
    mockPrisma.labParameter.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute(tenantId, testId, {
        parameters: [{ id: 'someone-elses-param', name: 'Tampered' }],
      })
    ).rejects.toThrow('Lab parameter not found or unauthorized');
    expect(mockPrisma.labParameter.update).not.toHaveBeenCalled();
  });

  it('should fall back to array index for displayOrder when not provided', async () => {
    await useCase.execute(tenantId, testId, {
      parameters: [{ id: 'param-a' }, { id: 'param-b' }],
    });

    expect(mockPrisma.labTestParameter.create).toHaveBeenNthCalledWith(1, {
      data: { testId: updatedTest.id, parameterId: 'param-a', displayOrder: 0 },
    });
    expect(mockPrisma.labTestParameter.create).toHaveBeenNthCalledWith(2, {
      data: { testId: updatedTest.id, parameterId: 'param-b', displayOrder: 1 },
    });
  });

  it('should return the fully-included test after update', async () => {
    const result = await useCase.execute(tenantId, testId, { name: 'CBC Panel' });

    expect(mockPrisma.labTest.findUnique).toHaveBeenCalledWith({
      where: { id: updatedTest.id },
      include: { parameters: { include: { parameter: true } } },
    });
    expect(result).toEqual(finalTest);
  });
});
