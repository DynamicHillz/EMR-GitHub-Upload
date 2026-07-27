/**
 * Update Consultation Use Case Tests
 *
 * Tests for updating consultation business logic
 */

import { UpdateConsultationUseCase } from './update-consultation.use-case';
import { IConsultationRepository } from '../../../domain/interfaces/IConsultationRepository';
import { UpdateConsultationDto } from '../../dtos/consultation/UpdateConsultation.dto';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

describe('UpdateConsultationUseCase', () => {
  let useCase: UpdateConsultationUseCase;
  let mockConsultationRepository: jest.Mocked<IConsultationRepository>;

  const tenantId = 'test-tenant-001';
  const consultationId = 'consultation-uuid-123';
  const patientId = 'patient-uuid-456';
  const doctorId = 'doctor-uuid-789';

  const draftConsultation = {
    id: consultationId,
    tenantId,
    patientId,
    doctorId,
    subjective: 'Original subjective',
    objective: 'Original objective',
    assessment: 'Original assessment',
    plan: 'Original plan',
    bloodPressure: '120/80',
    heartRate: 72,
    temperature: 37.0,
    weight: 70,
    height: 175,
    spO2: 98,
    bmi: 22.86,
    // The real repository (IConsultationRepository.update/findById) already
    // parses this into an array before returning — see
    // consultation.repository.ts's mapToEntity — so the mock must match that
    // contract rather than returning the raw JSON-string DB column value.
    icd10Codes: ['R51'],
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

    useCase = new UpdateConsultationUseCase(mockConsultationRepository);
  });

  describe('execute', () => {
    it('should successfully update a DRAFT consultation', async () => {
      // Arrange
      const updateDto: UpdateConsultationDto = {
        subjective: 'Updated subjective information',
        assessment: 'Updated assessment',
        plan: 'Updated treatment plan',
      };

      mockConsultationRepository.findById.mockResolvedValue(draftConsultation);
      mockConsultationRepository.update.mockResolvedValue({
        ...draftConsultation,
        subjective: updateDto.subjective,
        assessment: updateDto.assessment,
        plan: updateDto.plan,
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(consultationId, updateDto, tenantId);

      // Assert
      expect(mockConsultationRepository.findById).toHaveBeenCalledWith(
        consultationId,
        tenantId
      );
      expect(mockConsultationRepository.update).toHaveBeenCalledWith(
        consultationId,
        tenantId,
        expect.objectContaining({
          subjective: updateDto.subjective,
          assessment: updateDto.assessment,
          plan: updateDto.plan,
        }),
        undefined // updateDto.version — not set in this test's DTO
      );

      expect(result).toMatchObject({
        id: consultationId,
        subjective: 'Updated subjective information',
        assessment: 'Updated assessment',
        plan: 'Updated treatment plan',
        status: 'DRAFT',
      });
    });

    it('should throw NotFoundError if consultation does not exist', async () => {
      // Arrange
      const updateDto: UpdateConsultationDto = {
        subjective: 'Updated subjective',
      };

      mockConsultationRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        useCase.execute(consultationId, updateDto, tenantId)
      ).rejects.toThrow(NotFoundError);
      await expect(
        useCase.execute(consultationId, updateDto, tenantId)
      ).rejects.toThrow('Consultation');

      expect(mockConsultationRepository.update).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if consultation is FINALIZED', async () => {
      // Arrange
      const finalizedConsultation = {
        ...draftConsultation,
        status: 'FINALIZED',
        finalizedAt: new Date(),
      };

      const updateDto: UpdateConsultationDto = {
        subjective: 'Trying to update finalized consultation',
      };

      mockConsultationRepository.findById.mockResolvedValue(finalizedConsultation);

      // Act & Assert
      await expect(
        useCase.execute(consultationId, updateDto, tenantId)
      ).rejects.toThrow(ValidationError);
      await expect(
        useCase.execute(consultationId, updateDto, tenantId)
      ).rejects.toThrow('Cannot edit finalized or locked consultation');

      expect(mockConsultationRepository.update).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if consultation is LOCKED', async () => {
      // Arrange
      const lockedConsultation = {
        ...draftConsultation,
        status: 'LOCKED',
        finalizedAt: new Date(),
      };

      const updateDto: UpdateConsultationDto = {
        objective: 'Trying to update locked consultation',
      };

      mockConsultationRepository.findById.mockResolvedValue(lockedConsultation);

      // Act & Assert
      await expect(
        useCase.execute(consultationId, updateDto, tenantId)
      ).rejects.toThrow(ValidationError);

      expect(mockConsultationRepository.update).not.toHaveBeenCalled();
    });

    it('should update vital signs', async () => {
      // Arrange
      const updateDto: UpdateConsultationDto = {
        bloodPressure: '130/85',
        heartRate: 80,
        temperature: 37.5,
        weight: 75,
        height: 175,
        spO2: 97,
      };

      mockConsultationRepository.findById.mockResolvedValue(draftConsultation);

      const newBMI = 24.49; // 75 / (1.75^2)

      mockConsultationRepository.update.mockResolvedValue({
        ...draftConsultation,
        bloodPressure: updateDto.bloodPressure,
        heartRate: updateDto.heartRate,
        temperature: updateDto.temperature,
        weight: updateDto.weight,
        height: updateDto.height,
        spO2: updateDto.spO2,
        bmi: newBMI,
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(consultationId, updateDto, tenantId);

      // Assert
      expect(result.vitalSigns).toMatchObject({
        bloodPressure: '130/85',
        heartRate: 80,
        temperature: 37.5,
        weight: 75,
        height: 175,
        spO2: 97,
        bmi: newBMI,
        bmiCategory: 'Normal weight',
      });
    });

    it('should update ICD-10 codes', async () => {
      // Arrange
      const newCodes = ['I10', 'E11.9']; // Hypertension, Diabetes
      const updateDto: UpdateConsultationDto = {
        icd10Codes: newCodes,
      };

      mockConsultationRepository.findById.mockResolvedValue(draftConsultation);
      mockConsultationRepository.update.mockResolvedValue({
        ...draftConsultation,
        icd10Codes: newCodes,
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(consultationId, updateDto, tenantId);

      // Assert
      expect(result.icd10Codes).toEqual(newCodes);
    });

    it('should handle partial updates', async () => {
      // Arrange
      const updateDto: UpdateConsultationDto = {
        temperature: 38.5, // Only update temperature
      };

      mockConsultationRepository.findById.mockResolvedValue(draftConsultation);
      mockConsultationRepository.update.mockResolvedValue({
        ...draftConsultation,
        temperature: 38.5,
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(consultationId, updateDto, tenantId);

      // Assert
      expect(result.vitalSigns.temperature).toBe(38.5);
      // Other vitals should remain unchanged
      expect(result.vitalSigns.heartRate).toBe(72);
      expect(result.vitalSigns.bloodPressure).toBe('120/80');
    });

    it('should allow updating empty SOAP fields to filled values', async () => {
      // Arrange
      const incompleteDraft = {
        ...draftConsultation,
        objective: null,
        plan: null,
      };

      const updateDto: UpdateConsultationDto = {
        objective: 'Patient appears well',
        plan: 'Follow up in 1 week',
      };

      mockConsultationRepository.findById.mockResolvedValue(incompleteDraft);
      mockConsultationRepository.update.mockResolvedValue({
        ...incompleteDraft,
        objective: updateDto.objective,
        plan: updateDto.plan,
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(consultationId, updateDto, tenantId);

      // Assert
      expect(result.objective).toBe('Patient appears well');
      expect(result.plan).toBe('Follow up in 1 week');
    });

    it('should maintain canEdit and canFinalize status', async () => {
      // Arrange
      const updateDto: UpdateConsultationDto = {
        subjective: 'Patient has cough',
        assessment: 'Suspected bronchitis',
      };

      mockConsultationRepository.findById.mockResolvedValue(draftConsultation);
      mockConsultationRepository.update.mockResolvedValue({
        ...draftConsultation,
        subjective: updateDto.subjective,
        assessment: updateDto.assessment,
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(consultationId, updateDto, tenantId);

      // Assert
      expect(result.canEdit).toBe(true);
      expect(result.canFinalize).toBe(true); // Has subjective and assessment
    });
  });
});
