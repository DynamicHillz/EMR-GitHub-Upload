/**
 * Delete Patient Use Case Tests
 *
 * No prior coverage existed for this use-case even though it sits directly
 * on top of patient.repository.ts's delete() — the method that turned out
 * to have no tenant isolation on its actual write (see
 * patient.repository.test.ts). Confirms the use-case's own tenant-scoped
 * existence check still gates deletion correctly.
 */

import { DeletePatientUseCase } from './delete-patient.use-case';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { NotFoundError } from '../../../shared/errors/AppError';

describe('DeletePatientUseCase', () => {
  let useCase: DeletePatientUseCase;
  let mockPatientRepository: jest.Mocked<IPatientRepository>;

  const tenantId = 'tenant-1';
  const patientId = 'patient-1';

  beforeEach(() => {
    mockPatientRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPatientId: jest.fn(),
      findByPhone: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
      isPatientIdUnique: jest.fn(),
    };
    useCase = new DeletePatientUseCase(mockPatientRepository);
  });

  it('deletes the patient when it exists for this tenant', async () => {
    mockPatientRepository.findById.mockResolvedValue({ id: patientId } as any);

    await useCase.execute(patientId, tenantId, 'user-1');

    expect(mockPatientRepository.delete).toHaveBeenCalledWith(patientId, tenantId, 'user-1');
  });

  it('throws NotFoundError (with statusCode 404) and never calls delete when the patient does not exist for this tenant', async () => {
    mockPatientRepository.findById.mockResolvedValue(null);

    const error = await useCase.execute(patientId, tenantId).catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.statusCode).toBe(404);
    expect(mockPatientRepository.delete).not.toHaveBeenCalled();
  });
});
