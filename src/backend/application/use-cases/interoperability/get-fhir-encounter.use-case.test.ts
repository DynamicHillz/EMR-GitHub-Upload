/**
 * Get FHIR Encounter Use Case Tests
 *
 * Covers the Consultation -> FHIR R4 Encounter resource mapping, including
 * the status-code translation, since a mismatch there would misrepresent
 * whether a visit is still open.
 */

import { GetFhirEncounterUseCase } from './get-fhir-encounter.use-case';

describe('GetFhirEncounterUseCase', () => {
  let useCase: GetFhirEncounterUseCase;
  let mockPrisma: any;

  const consultationId = 'consultation-uuid-1';
  const tenantId = 'tenant-1';

  const baseConsultation = {
    id: consultationId,
    tenantId,
    patientId: 'patient-uuid-1',
    doctorId: 'doctor-uuid-1',
    status: 'COMPLETED',
    createdAt: new Date('2026-01-10T09:00:00.000Z'),
    updatedAt: new Date('2026-01-10T09:30:00.000Z'),
  };

  beforeEach(() => {
    mockPrisma = {
      consultation: {
        findFirst: jest.fn(),
      },
    };

    useCase = new GetFhirEncounterUseCase(mockPrisma);
  });

  it('should query the consultation scoped by id and tenantId', async () => {
    mockPrisma.consultation.findFirst.mockResolvedValue(baseConsultation);

    await useCase.execute(consultationId, tenantId);

    expect(mockPrisma.consultation.findFirst).toHaveBeenCalledWith({
      where: { id: consultationId, tenantId },
    });
  });

  it('should map a completed consultation into a finished Encounter with a period end', async () => {
    mockPrisma.consultation.findFirst.mockResolvedValue(baseConsultation);

    const result = await useCase.execute(consultationId, tenantId);

    expect(result).toEqual({
      resourceType: 'Encounter',
      id: consultationId,
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory',
      },
      subject: { reference: 'Patient/patient-uuid-1' },
      participant: [{ individual: { reference: 'Practitioner/doctor-uuid-1' } }],
      period: {
        start: '2026-01-10T09:00:00.000Z',
        end: '2026-01-10T09:30:00.000Z',
      },
    });
  });

  it('should map an in-progress consultation to status in-progress with no period end', async () => {
    mockPrisma.consultation.findFirst.mockResolvedValue({ ...baseConsultation, status: 'IN_PROGRESS' });

    const result = await useCase.execute(consultationId, tenantId);

    expect(result.status).toBe('in-progress');
    expect(result.period).toEqual({ start: '2026-01-10T09:00:00.000Z' });
  });

  it('should map a cancelled consultation to status cancelled', async () => {
    mockPrisma.consultation.findFirst.mockResolvedValue({ ...baseConsultation, status: 'CANCELLED' });

    const result = await useCase.execute(consultationId, tenantId);

    expect(result.status).toBe('cancelled');
  });

  it('should throw when the consultation does not exist for the tenant', async () => {
    mockPrisma.consultation.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow('Consultation not found');
  });
});
