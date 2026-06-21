/**
 * Get Patient Use Case Tests
 *
 * Tests for retrieving patient information
 */

import { GetPatientUseCase } from './get-patient.use-case';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { NotFoundError } from '../../../shared/errors/AppError';

describe('GetPatientUseCase', () => {
  let useCase: GetPatientUseCase;
  let mockPatientRepository: jest.Mocked<IPatientRepository>;

  const tenantId = 'test-tenant-001';
  const patientUuid = 'patient-uuid-123';
  const patientNumber = 'P000001';

  const mockPatient = {
    id: patientUuid,
    tenantId,
    patientId: patientNumber,
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'MALE' as const,
    phone: '+2348012345678',
    email: 'john.doe@example.com',
    address: '123 Test Street, Lagos',
    bloodGroup: 'O+' as const,
    genotype: 'AA' as const,
    allergies: ['Penicillin'],
    chronicConditions: ['Hypertension'],
    emergencyContact: {
      name: 'Jane Doe',
      relationship: 'Spouse',
      phone: '+2348087654321',
    },
    status: 'ACTIVE' as const,
    consentGiven: true,
    consentDate: new Date('2024-01-01'),
    consentVersion: '1.0',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    mockPatientRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPatientId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    } as any;

    useCase = new GetPatientUseCase(mockPatientRepository);
  });

  describe('executeById', () => {
    it('should successfully retrieve patient by UUID', async () => {
      // Arrange
      mockPatientRepository.findById.mockResolvedValue(mockPatient);

      // Act
      const result = await useCase.executeById(patientUuid, tenantId);

      // Assert
      expect(mockPatientRepository.findById).toHaveBeenCalledWith(patientUuid, tenantId);
      expect(result).toMatchObject({
        id: patientUuid,
        patientId: patientNumber,
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        gender: 'MALE',
        phone: '+2348012345678',
        email: 'john.doe@example.com',
        status: 'ACTIVE',
      });
    });

    it('should throw NotFoundError if patient does not exist', async () => {
      // Arrange
      mockPatientRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.executeById(patientUuid, tenantId)).rejects.toThrow(NotFoundError);
      await expect(useCase.executeById(patientUuid, tenantId)).rejects.toThrow('Patient');
    });

    it('should calculate patient age correctly', async () => {
      // Arrange
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);

      mockPatientRepository.findById.mockResolvedValue({
        ...mockPatient,
        dateOfBirth: twentyYearsAgo,
      });

      // Act
      const result = await useCase.executeById(patientUuid, tenantId);

      // Assert
      expect(result.age).toBe(20);
    });

    it('should correctly identify patients with allergies', async () => {
      // Arrange - Patient with allergies
      mockPatientRepository.findById.mockResolvedValue({
        ...mockPatient,
        allergies: ['Penicillin', 'Peanuts'],
      });

      // Act
      const resultWithAllergies = await useCase.executeById(patientUuid, tenantId);

      // Assert
      expect(resultWithAllergies.hasAllergies).toBe(true);
      expect(resultWithAllergies.allergies).toEqual(['Penicillin', 'Peanuts']);
    });

    it('should correctly identify patients without allergies', async () => {
      // Arrange - Patient without allergies
      mockPatientRepository.findById.mockResolvedValue({
        ...mockPatient,
        allergies: [],
      });

      // Act
      const resultWithoutAllergies = await useCase.executeById(patientUuid, tenantId);

      // Assert
      expect(resultWithoutAllergies.hasAllergies).toBe(false);
      expect(resultWithoutAllergies.allergies).toEqual([]);
    });

    it('should include emergency contact information', async () => {
      // Arrange
      mockPatientRepository.findById.mockResolvedValue(mockPatient);

      // Act
      const result = await useCase.executeById(patientUuid, tenantId);

      // Assert
      expect(result.emergencyContact).toEqual({
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '+2348087654321',
      });
    });
  });

  describe('executeByPatientId', () => {
    it('should successfully retrieve patient by patient number', async () => {
      // Arrange
      mockPatientRepository.findByPatientId.mockResolvedValue(mockPatient);

      // Act
      const result = await useCase.executeByPatientId(patientNumber, tenantId);

      // Assert
      expect(mockPatientRepository.findByPatientId).toHaveBeenCalledWith(
        patientNumber,
        tenantId
      );
      expect(result).toMatchObject({
        id: patientUuid,
        patientId: patientNumber,
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
      });
    });

    it('should throw NotFoundError if patient does not exist', async () => {
      // Arrange
      mockPatientRepository.findByPatientId.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.executeByPatientId(patientNumber, tenantId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should only find patients within the same tenant', async () => {
      // Arrange
      mockPatientRepository.findByPatientId.mockResolvedValue(null);

      // Act
      await expect(
        useCase.executeByPatientId(patientNumber, 'different-tenant')
      ).rejects.toThrow(NotFoundError);

      // Assert
      expect(mockPatientRepository.findByPatientId).toHaveBeenCalledWith(
        patientNumber,
        'different-tenant'
      );
    });

    it('should handle null optional fields correctly', async () => {
      // Arrange
      mockPatientRepository.findByPatientId.mockResolvedValue({
        ...mockPatient,
        email: null,
        address: null,
        bloodGroup: null,
        genotype: null,
        allergies: [],
        chronicConditions: [],
        emergencyContact: null,
        consentDate: null,
        consentVersion: null,
      });

      // Act
      const result = await useCase.executeByPatientId(patientNumber, tenantId);

      // Assert
      expect(result.email).toBeNull();
      expect(result.address).toBeNull();
      expect(result.bloodGroup).toBeNull();
      expect(result.allergies).toEqual([]);
      expect(result.chronicConditions).toEqual([]);
      expect(result.emergencyContact).toBeNull();
      expect(result.consentDate).toBeNull();
      expect(result.consentVersion).toBeNull();
    });
  });
});
