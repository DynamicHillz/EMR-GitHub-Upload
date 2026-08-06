/**
 * Dispense Medication Use Case Tests
 *
 * Covers the multiple guard clauses (prescription status, quantity
 * validation, allergy check, critical drug interaction check, batch
 * expiry, stock sufficiency, and the concurrent-dispense race guard
 * inside the transaction) in addition to the happy path.
 */

import { DispenseMedicationUseCase } from './dispense-medication.use-case';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { checkDrugInteractions } from '../../services/drug-interaction-checker.service';

jest.mock('../../services/drug-interaction-checker.service');

describe('DispenseMedicationUseCase', () => {
  let useCase: DispenseMedicationUseCase;
  let mockPrisma: any;
  let mockTx: any;

  const tenantId = 'tenant-1';
  const pharmacistId = 'pharmacist-1';

  const dto = {
    prescriptionId: 'rx-1',
    batchId: 'batch-1',
    quantityDispensed: 10,
    pharmacistNotes: 'Take with food',
  };

  const prescription = {
    id: 'rx-1',
    tenantId,
    status: 'PENDING',
    medicationName: 'Amoxicillin',
    patientId: 'patient-1',
    allergyWarning: false,
    patient: {
      id: 'patient-1',
      firstName: 'John',
      lastName: 'Doe',
      allergies: [] as string[],
    },
  };

  const batch = {
    id: 'batch-1',
    tenantId,
    status: 'ACTIVE',
    batchNumber: 'B-001',
    quantity: 50,
    expiryDate: new Date('2099-01-01'),
    medicationId: 'med-1',
    medication: { id: 'med-1', name: 'Amoxicillin' },
  };

  const noInteractions = {
    interactionWarning: false,
    interactionDetails: [] as string[],
    highestSeverity: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      dispensingRecord: { create: jest.fn() },
      medicationBatch: { updateMany: jest.fn() },
      medication: { update: jest.fn() },
      prescription: { updateMany: jest.fn() },
    };

    mockPrisma = {
      prescription: { findFirst: jest.fn() },
      medicationBatch: { findFirst: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    (checkDrugInteractions as jest.Mock).mockResolvedValue(noInteractions);

    useCase = new DispenseMedicationUseCase(mockPrisma);
  });

  function setupHappyPath() {
    mockPrisma.prescription.findFirst.mockResolvedValue(prescription);
    mockPrisma.medicationBatch.findFirst.mockResolvedValue(batch);
    mockTx.dispensingRecord.create.mockResolvedValue({
      id: 'dispense-1',
      dispensedAt: new Date('2026-01-01T10:00:00Z'),
      labelUrl: null,
    });
    mockTx.medicationBatch.updateMany.mockResolvedValue({ count: 1 });
    mockTx.prescription.updateMany.mockResolvedValue({ count: 1 });
  }

  it('should dispense medication, deduct stock, and update the prescription on the happy path', async () => {
    setupHappyPath();

    const result = await useCase.execute(dto, pharmacistId, tenantId);

    expect(mockPrisma.prescription.findFirst).toHaveBeenCalledWith({
      where: { id: dto.prescriptionId, tenantId },
      include: { patient: { select: { id: true, firstName: true, lastName: true, allergies: true } } },
    });
    expect(mockTx.dispensingRecord.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        prescriptionId: dto.prescriptionId,
        batchId: dto.batchId,
        pharmacistId,
        quantityDispensed: dto.quantityDispensed,
        pharmacistNotes: dto.pharmacistNotes,
        labelGenerated: false,
      },
    });
    expect(mockTx.medicationBatch.updateMany).toHaveBeenCalledWith({
      where: { id: dto.batchId, tenantId, quantity: { gte: dto.quantityDispensed } },
      data: { quantity: { decrement: dto.quantityDispensed } },
    });
    expect(mockTx.medication.update).toHaveBeenCalledWith({
      where: { id: batch.medicationId },
      data: { stockLevel: { decrement: dto.quantityDispensed } },
    });
    expect(mockTx.prescription.updateMany).toHaveBeenCalledWith({
      where: { id: dto.prescriptionId, tenantId, status: 'PENDING' },
      data: {
        status: 'DISPENSED',
        dispensedAt: expect.any(Date),
        dispensedBy: pharmacistId,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
      },
    });
    expect(result).toEqual({
      id: 'dispense-1',
      prescriptionId: dto.prescriptionId,
      dispensedAt: '2026-01-01T10:00:00.000Z',
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate.toISOString(),
      labelUrl: undefined,
      warnings: { allergy: false, interaction: false, details: [] },
    });
  });

  it('should include allergy and interaction warning details in the response when flagged', async () => {
    setupHappyPath();
    mockPrisma.prescription.findFirst.mockResolvedValue({
      ...prescription,
      allergyWarning: true,
    });
    (checkDrugInteractions as jest.Mock).mockResolvedValue({
      interactionWarning: true,
      interactionDetails: ['Interaction with Ibuprofen: NSAID risk (WARNING)'],
      highestSeverity: 'WARNING',
    });

    const result = await useCase.execute(dto, pharmacistId, tenantId);

    expect(result.warnings).toEqual({
      allergy: true,
      interaction: true,
      details: [
        'Allergy warning flagged during prescription',
        'Interaction with Ibuprofen: NSAID risk (WARNING)',
      ],
    });
  });

  it('should throw NotFoundError when the prescription does not exist for the tenant', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(dto, pharmacistId, tenantId)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.medicationBatch.findFirst).not.toHaveBeenCalled();
  });

  it('should reject a prescription that is not PENDING', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue({ ...prescription, status: 'DISPENSED' });

    await expect(useCase.execute(dto, pharmacistId, tenantId)).rejects.toThrow(
      'Cannot dispense prescription with status: DISPENSED'
    );
  });

  it('should reject a non-integer or non-positive quantityDispensed', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(prescription);

    await expect(
      useCase.execute({ ...dto, quantityDispensed: 1.5 }, pharmacistId, tenantId)
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ ...dto, quantityDispensed: 0 }, pharmacistId, tenantId)
    ).rejects.toThrow('quantityDispensed must be a positive integer');
    await expect(
      useCase.execute({ ...dto, quantityDispensed: -5 }, pharmacistId, tenantId)
    ).rejects.toThrow(ValidationError);
  });

  it('should block dispensing when the medication matches a recorded patient allergy', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue({
      ...prescription,
      medicationName: 'Amoxicillin',
      patient: { ...prescription.patient, allergies: ['Penicillin'] },
    });

    await expect(useCase.execute(dto, pharmacistId, tenantId)).rejects.toThrow(
      /ALLERGY WARNING.*Penicillin.*Dispensing blocked/
    );
    expect(mockPrisma.medicationBatch.findFirst).not.toHaveBeenCalled();
  });

  it('should block dispensing on a CRITICAL drug interaction', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(prescription);
    (checkDrugInteractions as jest.Mock).mockResolvedValue({
      interactionWarning: true,
      interactionDetails: ['Interaction with Warfarin: bleeding risk'],
      highestSeverity: 'CRITICAL',
    });

    await expect(useCase.execute(dto, pharmacistId, tenantId)).rejects.toThrow(
      /CRITICAL DRUG INTERACTION.*Dispensing blocked/
    );
    expect(mockPrisma.medicationBatch.findFirst).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the ACTIVE batch does not exist for the tenant', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(prescription);
    mockPrisma.medicationBatch.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(dto, pharmacistId, tenantId)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should reject dispensing from an expired batch', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(prescription);
    mockPrisma.medicationBatch.findFirst.mockResolvedValue({
      ...batch,
      expiryDate: new Date('2000-01-01'),
    });

    await expect(useCase.execute(dto, pharmacistId, tenantId)).rejects.toThrow(
      `Batch ${batch.batchNumber} has expired`
    );
  });

  it('should reject when the batch has insufficient stock', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(prescription);
    mockPrisma.medicationBatch.findFirst.mockResolvedValue({ ...batch, quantity: 5 });

    await expect(useCase.execute(dto, pharmacistId, tenantId)).rejects.toThrow(
      'Insufficient stock. Available: 5, Required: 10'
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should reject inside the transaction when a concurrent dispense already consumed the stock', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(prescription);
    mockPrisma.medicationBatch.findFirst.mockResolvedValue(batch);
    mockTx.medicationBatch.updateMany.mockResolvedValue({ count: 0 });

    await expect(useCase.execute(dto, pharmacistId, tenantId)).rejects.toThrow(
      'Insufficient stock — it may have just been dispensed by another pharmacist'
    );
    expect(mockTx.medication.update).not.toHaveBeenCalled();
    expect(mockTx.prescription.updateMany).not.toHaveBeenCalled();
  });

  it('throws ConflictError when a concurrent request already dispensed this prescription', async () => {
    setupHappyPath();
    mockTx.prescription.updateMany.mockResolvedValue({ count: 0 });

    await expect(useCase.execute(dto, pharmacistId, tenantId)).rejects.toThrow(
      'This prescription was already dispensed — please refresh and check its current status.'
    );
  });
});
