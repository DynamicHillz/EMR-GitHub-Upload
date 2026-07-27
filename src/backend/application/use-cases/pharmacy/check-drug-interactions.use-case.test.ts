/**
 * Check Drug Interactions Use Case Tests
 */

import { CheckDrugInteractionsUseCase } from './check-drug-interactions.use-case';

describe('CheckDrugInteractionsUseCase', () => {
  let useCase: CheckDrugInteractionsUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const dto = { patientId: 'patient-1', medicationName: 'Warfarin' };

  beforeEach(() => {
    mockPrisma = {
      prescription: { findMany: jest.fn() },
      drugInteraction: { findMany: jest.fn() },
    };

    useCase = new CheckDrugInteractionsUseCase(mockPrisma);
  });

  it('should return no interactions when the patient has no active prescriptions', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([]);

    const result = await useCase.execute(dto, tenantId);

    expect(mockPrisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          patientId: dto.patientId,
          status: 'DISPENSED',
        }),
      })
    );
    expect(mockPrisma.drugInteraction.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({ hasInteractions: false, interactions: [] });
  });

  it('should query drug interactions for each active medication in both directions', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([
      { medicationName: 'Aspirin' },
    ]);
    mockPrisma.drugInteraction.findMany.mockResolvedValue([
      {
        drug1: 'Warfarin',
        drug2: 'Aspirin',
        severity: 'CRITICAL',
        description: 'Increased bleeding risk',
        clinicalEffect: 'Bleeding',
        management: 'Avoid combination',
      },
    ]);

    const result = await useCase.execute(dto, tenantId);

    expect(mockPrisma.drugInteraction.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { drug1: { equals: 'Warfarin' }, drug2: { equals: 'Aspirin' } },
          { drug1: { equals: 'Aspirin' }, drug2: { equals: 'Warfarin' } },
        ],
      },
    });
    expect(result.hasInteractions).toBe(true);
    expect(result.interactions).toEqual([
      {
        drug1: 'Warfarin',
        drug2: 'Aspirin',
        severity: 'CRITICAL',
        description: 'Increased bleeding risk',
        clinicalEffect: 'Bleeding',
        management: 'Avoid combination',
      },
    ]);
  });

  it('should omit optional clinicalEffect/management when not present on the record', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([{ medicationName: 'Aspirin' }]);
    mockPrisma.drugInteraction.findMany.mockResolvedValue([
      {
        drug1: 'Warfarin',
        drug2: 'Aspirin',
        severity: 'WARNING',
        description: 'Minor interaction',
        clinicalEffect: null,
        management: null,
      },
    ]);

    const result = await useCase.execute(dto, tenantId);

    expect(result.interactions[0].clinicalEffect).toBeUndefined();
    expect(result.interactions[0].management).toBeUndefined();
  });

  it('should aggregate interaction checks across multiple active medications', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([
      { medicationName: 'Aspirin' },
      { medicationName: 'Ibuprofen' },
    ]);
    mockPrisma.drugInteraction.findMany
      .mockResolvedValueOnce([
        { drug1: 'Warfarin', drug2: 'Aspirin', severity: 'CRITICAL', description: 'Bleeding risk' },
      ])
      .mockResolvedValueOnce([]);

    const result = await useCase.execute(dto, tenantId);

    expect(mockPrisma.drugInteraction.findMany).toHaveBeenCalledTimes(2);
    expect(result.hasInteractions).toBe(true);
    expect(result.interactions).toHaveLength(1);
  });

  it('should return no interactions when none of the active medications interact', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([{ medicationName: 'Paracetamol' }]);
    mockPrisma.drugInteraction.findMany.mockResolvedValue([]);

    const result = await useCase.execute(dto, tenantId);

    expect(result).toEqual({ hasInteractions: false, interactions: [] });
  });
});
