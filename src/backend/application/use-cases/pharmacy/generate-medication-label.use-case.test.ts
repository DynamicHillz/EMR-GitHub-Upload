/**
 * Generate Medication Label Use Case Tests
 */

import { GenerateMedicationLabelUseCase } from './generate-medication-label.use-case';
import { NotFoundError } from '../../../shared/errors/AppError';

describe('GenerateMedicationLabelUseCase', () => {
  let useCase: GenerateMedicationLabelUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const dto = { dispensingRecordId: 'dispense-1' };

  const dispensingRecord = {
    id: 'dispense-1',
    tenantId,
    quantityDispensed: 20,
    dispensedAt: new Date('2026-01-01T08:00:00Z'),
    labelUrl: null,
    prescription: {
      medicationName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'Twice daily',
      patient: { firstName: 'John', lastName: 'Doe' },
    },
    batch: {
      batchNumber: 'B-001',
      expiryDate: new Date('2027-01-01'),
    },
    pharmacist: { firstName: 'Jane', lastName: 'Smith' },
  };

  beforeEach(() => {
    mockPrisma = {
      dispensingRecord: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    useCase = new GenerateMedicationLabelUseCase(mockPrisma);
  });

  it('should build label data and mark the dispensing record as labelled', async () => {
    mockPrisma.dispensingRecord.findFirst.mockResolvedValue(dispensingRecord);
    mockPrisma.dispensingRecord.update.mockResolvedValue({});

    const result = await useCase.execute(dto, tenantId);

    expect(mockPrisma.dispensingRecord.findFirst).toHaveBeenCalledWith({
      where: { id: dto.dispensingRecordId, tenantId },
      include: {
        prescription: {
          include: { patient: { select: { firstName: true, lastName: true } } },
        },
        batch: true,
        pharmacist: { select: { firstName: true, lastName: true } },
      },
    });

    const expectedLabelUrl = `/api/pharmacy/labels/${dispensingRecord.id}/print`;

    expect(result).toEqual({
      id: 'dispense-1',
      patientName: 'John Doe',
      medicationName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'Twice daily',
      quantity: 20,
      batchNumber: 'B-001',
      expiryDate: dispensingRecord.batch.expiryDate.toISOString(),
      dispensedDate: dispensingRecord.dispensedAt.toISOString(),
      pharmacistName: 'Jane Smith',
      instructions: 'Take 500mg Twice daily',
      labelUrl: expectedLabelUrl,
    });

    expect(mockPrisma.dispensingRecord.update).toHaveBeenCalledWith({
      where: { id: dto.dispensingRecordId },
      data: { labelGenerated: true, labelUrl: expectedLabelUrl },
    });
  });

  it('should throw NotFoundError when the dispensing record does not exist for the tenant', async () => {
    mockPrisma.dispensingRecord.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(dto, tenantId)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.dispensingRecord.update).not.toHaveBeenCalled();
  });
});
