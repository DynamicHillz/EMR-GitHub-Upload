/**
 * Patient Repository Tests — delete()
 *
 * Covers a real cross-tenant data-integrity bug: delete() discarded the
 * result of its own tenant-ownership check, and the actual write was scoped
 * only by { id } — no tenantId at all. The exact same class of bug had
 * already been found and fixed in the neighboring update() method (see its
 * own comment), but was never applied here. Not exploitable through the
 * current API surface (delete-patient.use-case.ts happens to re-check
 * tenant ownership itself before calling this), but the repository method
 * itself — the layer meant to be the safe, reusable primitive — had no
 * defense of its own.
 */

import { PatientRepository } from './patient.repository';
import { NotFoundError } from '../../../shared/errors/AppError';

describe('PatientRepository.delete', () => {
  let repository: PatientRepository;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const patientId = 'patient-1';

  const existingPatientRow = {
    id: patientId,
    tenantId,
    isDeleted: false,
    deletedAt: null,
    PatientAllergy: [],
  };

  beforeEach(() => {
    mockPrisma = {
      patient: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    repository = new PatientRepository(mockPrisma);
  });

  it('scopes the actual soft-delete write by both id AND tenantId, not id alone', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(existingPatientRow);

    await repository.delete(patientId, tenantId, 'user-1');

    expect(mockPrisma.patient.updateMany).toHaveBeenCalledWith({
      where: { id: patientId, tenantId },
      data: expect.objectContaining({
        isDeleted: true,
        deletedAt: expect.any(Date),
        deletedBy: 'user-1',
      }),
    });
  });

  it('throws NotFoundError and never attempts the write when the patient belongs to a different tenant', async () => {
    // findById itself is tenant-scoped, so a cross-tenant id correctly
    // resolves to null here — the bug was that delete() used to ignore
    // that null and update anyway, with no tenantId in the write's WHERE.
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(repository.delete(patientId, tenantId, 'user-1')).rejects.toThrow(NotFoundError);
    expect(mockPrisma.patient.updateMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for a patient id that does not exist at all', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(repository.delete('no-such-id', tenantId)).rejects.toThrow(
      "Patient with identifier 'no-such-id' not found"
    );
  });
});
