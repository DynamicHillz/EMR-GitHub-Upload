/**
 * Create Consultation Use Case Tests
 *
 * Tests for consultation creation business logic
 */

import { CreateConsultationUseCase } from './create-consultation.use-case';
import { IConsultationRepository } from '../../../domain/interfaces/IConsultationRepository';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { CreateConsultationDto } from '../../dtos/consultation/CreateConsultation.dto';
import { NotFoundError } from '../../../shared/errors/AppError';

describe('CreateConsultationUseCase', () => {
  let useCase: CreateConsultationUseCase;
  let mockConsultationRepository: jest.Mocked<IConsultationRepository>;
  let mockPatientRepository: jest.Mocked<IPatientRepository>;

  const tenantId = 'test-tenant-001';
  const patientId = 'patient-uuid-123';
  const doctorId = 'doctor-uuid-456';

  const mockPatient = {
    id: patientId,
    patientId: 'P000001',
    firstName: 'John',
    lastName: 'Doe',
    tenantId,
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

    mockPatientRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPatientId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    } as any;

    useCase = new CreateConsultationUseCase(
      mockConsultationRepository,
      mockPatientRepository
    );
  });

  describe('execute', () => {
    const validDto: CreateConsultationDto = {
      patientId,
      doctorId,
      subjective: 'Patient complains of headache for 2 days',
      objective: 'Alert and oriented. No fever.',
      assessment: 'Tension headache',
      plan: 'Prescribe paracetamol. Rest advised.',
      bloodPressure: '120/80',
      heartRate: 72,
      temperature: 37.0,
      weight: 70,
      height: 175,
      spO2: 98,
      icd10Codes: ['R51'],
    };

    it('should successfully create a new consultation', async () => {
      // Arrange
      mockPatientRepository.findById.mockResolvedValue(mockPatient as any);

      const mockCreatedConsultation = {
        id: 'consultation-uuid-789',
        tenantId,
        patientId,
        doctorId,
        subjective: validDto.subjective,
        objective: validDto.objective,
        assessment: validDto.assessment,
        plan: validDto.plan,
        bloodPressure: validDto.bloodPressure,
        heartRate: validDto.heartRate,
        temperature: validDto.temperature,
        weight: validDto.weight,
        height: validDto.height,
        spO2: validDto.spO2,
        bmi: 22.86, // 70 / (1.75^2)
        icd10Codes: JSON.stringify(validDto.icd10Codes),
        status: 'DRAFT',
        consultationDate: new Date(),
        finalizedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockConsultationRepository.create.mockResolvedValue(mockCreatedConsultation);

      // Act
      const result = await useCase.execute(validDto, tenantId);

      // Assert
      expect(mockPatientRepository.findById).toHaveBeenCalledWith(patientId, tenantId);
      expect(mockConsultationRepository.create).toHaveBeenCalledWith({
        tenantId,
        patientId,
        doctorId,
        subjective: validDto.subjective,
        objective: validDto.objective,
        assessment: validDto.assessment,
        plan: validDto.plan,
        bloodPressure: validDto.bloodPressure,
        heartRate: validDto.heartRate,
        temperature: validDto.temperature,
        weight: validDto.weight,
        height: validDto.height,
        spO2: validDto.spO2,
        icd10Codes: validDto.icd10Codes,
      });

      expect(result).toMatchObject({
        id: 'consultation-uuid-789',
        patientId,
        patientName: 'John Doe',
        doctorId,
        subjective: validDto.subjective,
        objective: validDto.objective,
        assessment: validDto.assessment,
        plan: validDto.plan,
        status: 'DRAFT',
        canEdit: true,
        canFinalize: true,
      });

      expect(result.vitalSigns).toMatchObject({
        bloodPressure: '120/80',
        heartRate: 72,
        temperature: 37.0,
        weight: 70,
        height: 175,
        spO2: 98,
        bmi: 22.86,
        bmiCategory: 'Normal weight',
      });

      expect(result.icd10Codes).toEqual(['R51']);
    });

    it('should throw NotFoundError if patient does not exist', async () => {
      // Arrange
      mockPatientRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(NotFoundError);
      await expect(useCase.execute(validDto, tenantId)).rejects.toThrow('Patient');

      expect(mockConsultationRepository.create).not.toHaveBeenCalled();
    });

    it('should handle minimal consultation with only required fields', async () => {
      // Arrange
      const minimalDto: CreateConsultationDto = {
        patientId,
        doctorId,
        subjective: 'Patient has fever',
        objective: undefined,
        assessment: 'Viral infection suspected',
        plan: undefined,
      };

      mockPatientRepository.findById.mockResolvedValue(mockPatient as any);

      mockConsultationRepository.create.mockResolvedValue({
        id: 'consultation-uuid-minimal',
        tenantId,
        patientId,
        doctorId,
        subjective: minimalDto.subjective,
        objective: null,
        assessment: minimalDto.assessment,
        plan: null,
        bloodPressure: null,
        heartRate: null,
        temperature: null,
        weight: null,
        height: null,
        spO2: null,
        bmi: null,
        icd10Codes: '[]',
        status: 'DRAFT',
        consultationDate: new Date(),
        finalizedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(minimalDto, tenantId);

      // Assert
      expect(result.subjective).toBe('Patient has fever');
      expect(result.assessment).toBe('Viral infection suspected');
      expect(result.vitalSigns.bmi).toBeNull();
      expect(result.canFinalize).toBe(true); // Has subjective and assessment
    });

    it('should calculate BMI correctly from weight and height', async () => {
      // Arrange
      const dtoWithVitals: CreateConsultationDto = {
        ...validDto,
        weight: 80,
        height: 180,
      };

      mockPatientRepository.findById.mockResolvedValue(mockPatient as any);

      const expectedBMI = 24.69; // 80 / (1.8^2)

      mockConsultationRepository.create.mockResolvedValue({
        id: 'consultation-uuid-bmi',
        tenantId,
        patientId,
        doctorId,
        subjective: validDto.subjective,
        objective: validDto.objective,
        assessment: validDto.assessment,
        plan: validDto.plan,
        bloodPressure: validDto.bloodPressure,
        heartRate: validDto.heartRate,
        temperature: validDto.temperature,
        weight: 80,
        height: 180,
        spO2: validDto.spO2,
        bmi: expectedBMI,
        icd10Codes: JSON.stringify(validDto.icd10Codes),
        status: 'DRAFT',
        consultationDate: new Date(),
        finalizedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(dtoWithVitals, tenantId);

      // Assert
      expect(result.vitalSigns.bmi).toBeCloseTo(24.69, 2);
      expect(result.vitalSigns.bmiCategory).toBe('Normal weight');
    });

    it('should handle multiple ICD-10 codes', async () => {
      // Arrange
      const multipleCodesDto: CreateConsultationDto = {
        ...validDto,
        icd10Codes: ['I10', 'E11.9', 'M79.3'], // Hypertension, Diabetes, Myalgia
      };

      mockPatientRepository.findById.mockResolvedValue(mockPatient as any);

      mockConsultationRepository.create.mockResolvedValue({
        id: 'consultation-uuid-codes',
        tenantId,
        patientId,
        doctorId,
        subjective: validDto.subjective,
        objective: validDto.objective,
        assessment: validDto.assessment,
        plan: validDto.plan,
        bloodPressure: validDto.bloodPressure,
        heartRate: validDto.heartRate,
        temperature: validDto.temperature,
        weight: validDto.weight,
        height: validDto.height,
        spO2: validDto.spO2,
        bmi: 22.86,
        icd10Codes: JSON.stringify(['I10', 'E11.9', 'M79.3']),
        status: 'DRAFT',
        consultationDate: new Date(),
        finalizedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(multipleCodesDto, tenantId);

      // Assert
      expect(result.icd10Codes).toEqual(['I10', 'E11.9', 'M79.3']);
    });

    it('should create consultation in DRAFT status', async () => {
      // Arrange
      mockPatientRepository.findById.mockResolvedValue(mockPatient as any);

      mockConsultationRepository.create.mockResolvedValue({
        id: 'consultation-uuid-draft',
        tenantId,
        patientId,
        doctorId,
        subjective: validDto.subjective,
        objective: validDto.objective,
        assessment: validDto.assessment,
        plan: validDto.plan,
        bloodPressure: validDto.bloodPressure,
        heartRate: validDto.heartRate,
        temperature: validDto.temperature,
        weight: validDto.weight,
        height: validDto.height,
        spO2: validDto.spO2,
        bmi: 22.86,
        icd10Codes: JSON.stringify(validDto.icd10Codes),
        status: 'DRAFT',
        consultationDate: new Date(),
        finalizedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(validDto, tenantId);

      // Assert
      expect(result.status).toBe('DRAFT');
      expect(result.canEdit).toBe(true);
      expect(result.finalizedAt).toBeNull();
    });
  });
});
