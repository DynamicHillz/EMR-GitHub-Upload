/**
 * Delete Patient Use Case
 *
 * Soft deletes a patient (sets deletedAt timestamp)
 *
 * Features:
 * - Soft delete (preserves data for audit/GDPR compliance)
 * - Tenant-scoped (no cross-tenant access)
 * - Verifies patient exists before deletion
 */

import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { NotFoundError } from '../../../shared/errors/AppError';

export class DeletePatientUseCase {
  constructor(private patientRepository: IPatientRepository) {}

  /**
   * Execute patient soft delete
   * @param id - Patient UUID
   * @param tenantId - Tenant ID from authenticated user
   * @throws Error if patient not found
   */
  async execute(id: string, tenantId: string): Promise<void> {
    // Verify patient exists
    const patient = await this.patientRepository.findById(id, tenantId);

    if (!patient) {
      throw new NotFoundError('Patient', id);
    }

    // Soft delete the patient
    await this.patientRepository.delete(id, tenantId);
  }
}
