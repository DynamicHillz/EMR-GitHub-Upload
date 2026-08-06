/**
 * Create Lab Dictionary Item Use Case Tests
 */

import { CreateLabDictionaryItemUseCase } from './create-lab-dictionary-item.use-case';

describe('CreateLabDictionaryItemUseCase', () => {
  let useCase: CreateLabDictionaryItemUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const createdTest = { id: 'test-1', tenantId, name: 'CBC' };
  const finalTest = { ...createdTest, parameters: [] };

  beforeEach(() => {
    mockPrisma = {
      labTest: {
        create: jest.fn().mockResolvedValue(createdTest),
        findUnique: jest.fn().mockResolvedValue(finalTest),
      },
      labParameter: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-param', tenantId }),
      },
      labTestParameter: {
        create: jest.fn(),
      },
    };

    useCase = new CreateLabDictionaryItemUseCase(mockPrisma);
  });

  it('should create a lab test with no parameters and return it with includes', async () => {
    const result = await useCase.execute(tenantId, {
      name: 'CBC',
      category: 'Hematology',
      price: '500',
      isActive: true,
    });

    expect(mockPrisma.labTest.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        name: 'CBC',
        category: 'Hematology',
        price: 500,
        isActive: true,
      },
    });
    expect(mockPrisma.labParameter.create).not.toHaveBeenCalled();
    expect(mockPrisma.labTestParameter.create).not.toHaveBeenCalled();
    expect(mockPrisma.labTest.findUnique).toHaveBeenCalledWith({
      where: { id: createdTest.id },
      include: { parameters: { include: { parameter: true } } },
    });
    expect(result).toEqual(finalTest);
  });

  it('should default price to 0 when price is not a valid number', async () => {
    await useCase.execute(tenantId, { name: 'CBC', category: 'Hematology' });

    expect(mockPrisma.labTest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ price: 0 }) })
    );
  });

  it('should default isActive to true when not provided', async () => {
    await useCase.execute(tenantId, { name: 'CBC', category: 'Hematology' });

    expect(mockPrisma.labTest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: true }) })
    );
  });

  it('should respect an explicit isActive: false', async () => {
    await useCase.execute(tenantId, { name: 'CBC', category: 'Hematology', isActive: false });

    expect(mockPrisma.labTest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) })
    );
  });

  it('should create a new lab parameter and link it when a parameter has no id', async () => {
    mockPrisma.labParameter.create.mockResolvedValue({ id: 'param-1' });

    await useCase.execute(tenantId, {
      name: 'CBC',
      category: 'Hematology',
      price: 500,
      parameters: [{ name: 'Hemoglobin', unit: 'g/dL', refRangeMale: '13-17', refRangeFemale: '12-15' }],
    });

    expect(mockPrisma.labParameter.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        name: 'Hemoglobin',
        unit: 'g/dL',
        refRangeMale: '13-17',
        refRangeFemale: '12-15',
      },
    });
    expect(mockPrisma.labTestParameter.create).toHaveBeenCalledWith({
      data: { testId: createdTest.id, parameterId: 'param-1', displayOrder: 0 },
    });
  });

  it('should link an existing parameter by id without creating a new one', async () => {
    await useCase.execute(tenantId, {
      name: 'CBC',
      category: 'Hematology',
      price: 500,
      parameters: [{ id: 'existing-param', displayOrder: 3 }],
    });

    expect(mockPrisma.labParameter.create).not.toHaveBeenCalled();
    expect(mockPrisma.labTestParameter.create).toHaveBeenCalledWith({
      data: { testId: createdTest.id, parameterId: 'existing-param', displayOrder: 3 },
    });
  });

  it('should reject linking an existing parameter id that does not belong to this tenant', async () => {
    mockPrisma.labParameter.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute(tenantId, {
        name: 'CBC',
        category: 'Hematology',
        price: 500,
        parameters: [{ id: 'someone-elses-param' }],
      })
    ).rejects.toThrow('Lab parameter not found or unauthorized');
    expect(mockPrisma.labTestParameter.create).not.toHaveBeenCalled();
  });

  it('should fall back to array index for displayOrder when not provided', async () => {
    mockPrisma.labParameter.create
      .mockResolvedValueOnce({ id: 'param-1' })
      .mockResolvedValueOnce({ id: 'param-2' });

    await useCase.execute(tenantId, {
      name: 'CBC',
      category: 'Hematology',
      price: 500,
      parameters: [{ name: 'Param A' }, { name: 'Param B' }],
    });

    expect(mockPrisma.labTestParameter.create).toHaveBeenNthCalledWith(1, {
      data: { testId: createdTest.id, parameterId: 'param-1', displayOrder: 0 },
    });
    expect(mockPrisma.labTestParameter.create).toHaveBeenNthCalledWith(2, {
      data: { testId: createdTest.id, parameterId: 'param-2', displayOrder: 1 },
    });
  });

  it('should skip parameter processing when parameters is an empty array', async () => {
    await useCase.execute(tenantId, { name: 'CBC', category: 'Hematology', price: 500, parameters: [] });

    expect(mockPrisma.labParameter.create).not.toHaveBeenCalled();
    expect(mockPrisma.labTestParameter.create).not.toHaveBeenCalled();
  });
});
