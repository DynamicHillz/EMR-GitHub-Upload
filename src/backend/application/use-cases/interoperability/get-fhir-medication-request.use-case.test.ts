/**
 * Get FHIR MedicationRequest Use Case Tests
 *
 * Covers the Prescription -> FHIR R4 MedicationRequest mapping, including
 * the status translation and the instructions-appended dosage text.
 */

import { GetFhirMedicationRequestUseCase } from './get-fhir-medication-request.use-case';

describe('GetFhirMedicationRequestUseCase', () => {
  let useCase: GetFhirMedicationRequestUseCase;
  let mockPrisma: any;

  const prescriptionId = 'prescription-uuid-1';
  const tenantId = 'tenant-1';

  const basePrescription = {
    id: prescriptionId,
    tenantId,
    patientId: 'patient-uuid-1',
    doctorId: 'doctor-uuid-1',
    status: 'PENDING',
    medicationName: 'Amoxicillin',
    dosage: '500mg',
    frequency: 'Twice daily',
    duration: '7 days',
    instructions: null,
    createdAt: new Date('2026-02-01T08:00:00.000Z'),
  };

  beforeEach(() => {
    mockPrisma = {
      prescription: { findFirst: jest.fn() },
    };

    useCase = new GetFhirMedicationRequestUseCase(mockPrisma);
  });

  it('should query the prescription scoped by id and tenantId', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(basePrescription);

    await useCase.execute(prescriptionId, tenantId);

    expect(mockPrisma.prescription.findFirst).toHaveBeenCalledWith({
      where: { id: prescriptionId, tenantId },
    });
  });

  it('should map a pending prescription into an active MedicationRequest', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(basePrescription);

    const result = await useCase.execute(prescriptionId, tenantId);

    expect(result).toEqual({
      resourceType: 'MedicationRequest',
      id: prescriptionId,
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: { text: 'Amoxicillin' },
      subject: { reference: 'Patient/patient-uuid-1' },
      requester: { reference: 'Practitioner/doctor-uuid-1' },
      authoredOn: '2026-02-01T08:00:00.000Z',
      dosageInstruction: [{ text: '500mg, Twice daily, 7 days' }],
    });
  });

  it('should append instructions to the dosage text when present', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue({
      ...basePrescription,
      instructions: 'Take with food',
    });

    const result = await useCase.execute(prescriptionId, tenantId);

    expect(result.dosageInstruction?.[0].text).toBe('500mg, Twice daily, 7 days — Take with food');
  });

  it('should map a dispensed prescription to status completed', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue({ ...basePrescription, status: 'DISPENSED' });

    const result = await useCase.execute(prescriptionId, tenantId);

    expect(result.status).toBe('completed');
  });

  it('should map a cancelled prescription to status cancelled', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue({ ...basePrescription, status: 'CANCELLED' });

    const result = await useCase.execute(prescriptionId, tenantId);

    expect(result.status).toBe('cancelled');
  });

  it('should throw when the prescription does not exist for the tenant', async () => {
    mockPrisma.prescription.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(prescriptionId, tenantId)).rejects.toThrow('Prescription not found');
  });
});
