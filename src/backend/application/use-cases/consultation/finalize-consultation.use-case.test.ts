/**
 * Finalize Consultation Use Case Tests
 *
 * Tests for finalizing consultation business logic
 */

import { FinalizeConsultationUseCase } from './finalize-consultation.use-case';
import { IConsultationRepository } from '../../../domain/interfaces/IConsultationRepository';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

describe('FinalizeConsultationUseCase', () => {
  let useCase: FinalizeConsultationUseCase;
  let mockConsultationRepository: jest.Mocked<IConsultationRepository>;

  const tenantId = 'test-tenant-001';
  const consultationId = 'consultation-uuid-123';

  const draftConsultation = {
    id: consultationId,
    tenantId,
    patientId: 'patient-uuid-456',
    doctorId: 'doctor-uuid-789',
    subjective: 'Patient has headache',
    objective: 'Alert and oriented',
    assessment: 'Tension headache',
    plan: 'Prescribe paracetamol',
    bloodPressure: '120/80',
    heartRate: 72,
    temperature: 37.0,
    weight: 70,
    height: 175,
    spO2: 98,
    bmi: 22.86,
    icd10Codes: JSON.stringify(['R51']),
    status: 'DRAFT',
    consultationDate: new Date(),
    finalizedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockConsultationRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPatientId: jest.fn(),
      findByDoctorId: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      finalize: jest.fn(),
      lock: jest.fn(),
      delete: jest.fn(),
    } as any;

    useCase = new FinalizeConsultationUseCase(mockConsultationRepository);
  });

  describe('execute', () => {
    it('should successfully finalize a valid DRAFT consultation', async () => {
      // Arrange
      mockConsultationRepository.findById.mockResolvedValue(draftConsultation);
      mockConsultationRepository.finalize.mockResolvedValue({
        ...draftConsultation,
        status: 'FINALIZED',
        finalizedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(consultationId, tenantId);

      // Assert
      expect(mockConsultationRepository.findById).toHaveBeenCalledWith(
        consultationId,
        tenantId
      );
      expect(mockConsultationRepository.finalize).toHaveBeenCalledWith(
        consultationId,
        tenantId
      );

      expect(result).toEqual({
        success: true,
        message: 'Consultation finalized successfully. It can no longer be edited.',
      });
    });

    it('should throw NotFoundError if consultation does not exist', async () => {
      // Arrange
      mockConsultationRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        NotFoundError
      );
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        'Consultation'
      );

      expect(mockConsultationRepository.finalize).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if consultation is already finalized', async () => {
      // Arrange
      const finalizedConsultation = {
        ...draftConsultation,
        status: 'FINALIZED',
        finalizedAt: new Date(),
      };

      mockConsultationRepository.findById.mockResolvedValue(finalizedConsultation);

      // Act & Assert
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        ValidationError
      );
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        'Consultation is already finalized'
      );

      expect(mockConsultationRepository.finalize).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if consultation is locked', async () => {
      // Arrange
      const lockedConsultation = {
        ...draftConsultation,
        status: 'LOCKED',
        finalizedAt: new Date(),
      };

      mockConsultationRepository.findById.mockResolvedValue(lockedConsultation);

      // Act & Assert
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        ValidationError
      );
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        'Consultation is already finalized'
      );

      expect(mockConsultationRepository.finalize).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if subjective is missing', async () => {
      // Arrange
      const incompleteConsultation = {
        ...draftConsultation,
        subjective: null,
      };

      mockConsultationRepository.findById.mockResolvedValue(incompleteConsultation);

      // Act & Assert
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        ValidationError
      );
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        'Subjective and Assessment are required to finalize consultation'
      );

      expect(mockConsultationRepository.finalize).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if assessment is missing', async () => {
      // Arrange
      const incompleteConsultation = {
        ...draftConsultation,
        assessment: null,
      };

      mockConsultationRepository.findById.mockResolvedValue(incompleteConsultation);

      // Act & Assert
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        ValidationError
      );
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        'Subjective and Assessment are required to finalize consultation'
      );

      expect(mockConsultationRepository.finalize).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if both subjective and assessment are missing', async () => {
      // Arrange
      const incompleteConsultation = {
        ...draftConsultation,
        subjective: null,
        assessment: null,
      };

      mockConsultationRepository.findById.mockResolvedValue(incompleteConsultation);

      // Act & Assert
      await expect(useCase.execute(consultationId, tenantId)).rejects.toThrow(
        ValidationError
      );

      expect(mockConsultationRepository.finalize).not.toHaveBeenCalled();
    });

    it('should finalize even if objective and plan are missing', async () => {
      // Arrange
      const minimalConsultation = {
        ...draftConsultation,
        objective: null,
        plan: null,
      };

      mockConsultationRepository.findById.mockResolvedValue(minimalConsultation);
      mockConsultationRepository.finalize.mockResolvedValue({
        ...minimalConsultation,
        status: 'FINALIZED',
        finalizedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(consultationId, tenantId);

      // Assert
      expect(mockConsultationRepository.finalize).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should finalize even if vital signs are missing', async () => {
      // Arrange
      const noVitalsConsultation = {
        ...draftConsultation,
        bloodPressure: null,
        heartRate: null,
        temperature: null,
        weight: null,
        height: null,
        spO2: null,
        bmi: null,
      };

      mockConsultationRepository.findById.mockResolvedValue(noVitalsConsultation);
      mockConsultationRepository.finalize.mockResolvedValue({
        ...noVitalsConsultation,
        status: 'FINALIZED',
        finalizedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(consultationId, tenantId);

      // Assert
      expect(mockConsultationRepository.finalize).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should finalize even if ICD-10 codes are empty', async () => {
      // Arrange
      const noCodesConsultation = {
        ...draftConsultation,
        icd10Codes: '[]',
      };

      mockConsultationRepository.findById.mockResolvedValue(noCodesConsultation);
      mockConsultationRepository.finalize.mockResolvedValue({
        ...noCodesConsultation,
        status: 'FINALIZED',
        finalizedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(consultationId, tenantId);

      // Assert
      expect(mockConsultationRepository.finalize).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should enforce tenant isolation', async () => {
      // Arrange
      mockConsultationRepository.findById.mockResolvedValue(draftConsultation);
      mockConsultationRepository.finalize.mockResolvedValue({
        ...draftConsultation,
        status: 'FINALIZED',
        finalizedAt: new Date(),
      });

      // Act
      await useCase.execute(consultationId, 'different-tenant-id');

      // Assert
      expect(mockConsultationRepository.findById).toHaveBeenCalledWith(
        consultationId,
        'different-tenant-id'
      );
    });
  });
});
