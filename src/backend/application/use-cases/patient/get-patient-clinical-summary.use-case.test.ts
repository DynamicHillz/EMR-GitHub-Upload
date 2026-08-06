/**
 * Get Patient Clinical Summary Use Case Tests
 *
 * Covers a real gap: a nonexistent or wrong-tenant patient id previously
 * fell straight through to the prescription/diagnosis queries and came back
 * as an empty (but 200 OK) summary — indistinguishable from "this real
 * patient just has no active meds or diagnoses yet". Now throws NotFoundError
 * (404), same as every other patient-lookup endpoint.
 */

import { GetPatientClinicalSummaryUseCase } from './get-patient-clinical-summary.use-case';
import { NotFoundError } from '../../../shared/errors/AppError';

describe('GetPatientClinicalSummaryUseCase', () => {
  let useCase: GetPatientClinicalSummaryUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const patientId = 'patient-1';

  beforeEach(() => {
    mockPrisma = {
      patient: { findFirst: jest.fn() },
      prescription: { findMany: jest.fn().mockResolvedValue([]) },
      consultationDiagnosis: { findMany: jest.fn().mockResolvedValue([]) },
    };
    useCase = new GetPatientClinicalSummaryUseCase(mockPrisma);
  });

  it('throws NotFoundError instead of returning an empty summary when the patient does not exist for this tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(patientId, tenantId)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.prescription.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.consultationDiagnosis.findMany).not.toHaveBeenCalled();
  });

  it('scopes the existence check by tenantId (a cross-tenant id is treated as not found)', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(patientId, tenantId)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: patientId, tenantId }) })
    );
  });

  it('returns the bundled summary when the patient exists', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ id: patientId });
    mockPrisma.prescription.findMany.mockResolvedValue([
      {
        medicationName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'TID',
        createdAt: new Date('2026-06-01'),
        doctor: { firstName: 'Jane', lastName: 'Doe' },
      },
    ]);
    mockPrisma.consultationDiagnosis.findMany.mockResolvedValue([
      { createdAt: new Date('2026-06-01'), diagnosis: { code: 'J45', name: 'Asthma' } },
    ]);

    const result = await useCase.execute(patientId, tenantId);

    expect(result.activePrescriptions).toEqual([
      {
        medicationName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'TID',
        prescribedAt: new Date('2026-06-01').toISOString(),
        prescriberName: 'Jane Doe',
      },
    ]);
    expect(result.recentDiagnoses).toEqual([
      { code: 'J45', name: 'Asthma', diagnosedAt: new Date('2026-06-01').toISOString() },
    ]);
  });
});
