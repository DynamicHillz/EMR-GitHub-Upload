/**
 * Update Patient Use Case Tests
 *
 * Tests for updating patient information
 */

import { UpdatePatientUseCase } from './update-patient.use-case';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { UpdatePatientDto } from '../../dtos/patient/RegisterPatient.dto';
import { NotFoundError, ConflictError } from '../../../shared/errors/AppError';

describe('UpdatePatientUseCase', () => {
  let useCase: UpdatePatientUseCase;
  let mockPatientRepository: jest.Mocked<IPatientRepository>;

  const tenantId = 'test-tenant-001';
  const patientId = 'patient-uuid-123';

  const existingPatient = {
    id: patientId,
    tenantId,
    patientId: 'P000001',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'MALE' as const,
    phone: '+2348012345678',
    email: 'john.doe@example.com',
    address: '123 Test Street, Lagos',
    bloodGroup: 'O_POSITIVE' as const,
    genotype: 'AA' as const,
    allergies: ['Penicillin'],
    chronicConditions: ['Hypertension'],
    emergencyContact: null,
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
      findByPhone: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    } as any;

    useCase = new UpdatePatientUseCase(mockPatientRepository);
  });

  describe('execute', () => {
    it('should successfully update patient information', async () => {
      // Arrange
      const updateDto: UpdatePatientDto = {
        firstName: 'Jane',
        email: 'jane.doe@example.com',
        address: '456 New Street, Abuja',
      };

      mockPatientRepository.findById.mockResolvedValue(existingPatient);
      mockPatientRepository.update.mockResolvedValue({
        ...existingPatient,
        firstName: 'Jane',
        email: 'jane.doe@example.com',
        address: '456 New Street, Abuja',
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(patientId, updateDto, tenantId);

      // Assert
      expect(mockPatientRepository.findById).toHaveBeenCalledWith(patientId, tenantId);
      expect(mockPatientRepository.update).toHaveBeenCalledWith(
        patientId,
        tenantId,
        expect.objectContaining({
          firstName: 'Jane',
          email: 'jane.doe@example.com',
          address: '456 New Street, Abuja',
        }),
        undefined // updateDto.version — not set in this test's DTO
      );
      expect(result.firstName).toBe('Jane');
      expect(result.email).toBe('jane.doe@example.com');
      expect(result.address).toBe('456 New Street, Abuja');
    });

    it('should throw NotFoundError if patient does not exist', async () => {
      // Arrange
      const updateDto: UpdatePatientDto = { firstName: 'Jane' };
      mockPatientRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(patientId, updateDto, tenantId)).rejects.toThrow(
        NotFoundError
      );
      await expect(useCase.execute(patientId, updateDto, tenantId)).rejects.toThrow(
        `Patient`
      );

      expect(mockPatientRepository.update).not.toHaveBeenCalled();
    });

    it('should allow phone number update if no duplicate exists', async () => {
      // Arrange
      const newPhone = '+2348099999999';
      const updateDto: UpdatePatientDto = { phone: newPhone };

      mockPatientRepository.findById.mockResolvedValue(existingPatient);
      mockPatientRepository.findByPhone.mockResolvedValue(null);
      mockPatientRepository.update.mockResolvedValue({
        ...existingPatient,
        phone: newPhone,
      });

      // Act
      const result = await useCase.execute(patientId, updateDto, tenantId);

      // Assert
      expect(mockPatientRepository.findByPhone).toHaveBeenCalledWith(newPhone, tenantId);
      expect(result.phone).toBe(newPhone);
    });

    it('should throw ConflictError if phone number already exists', async () => {
      // Arrange
      const duplicatePhone = '+2348099999999';
      const updateDto: UpdatePatientDto = { phone: duplicatePhone };

      mockPatientRepository.findById.mockResolvedValue(existingPatient);
      mockPatientRepository.findByPhone.mockResolvedValue({
        id: 'different-patient-id',
        phone: duplicatePhone,
      } as any);

      // Act & Assert
      await expect(useCase.execute(patientId, updateDto, tenantId)).rejects.toThrow(
        ConflictError
      );
      await expect(useCase.execute(patientId, updateDto, tenantId)).rejects.toThrow(
        'A patient with this phone number already exists'
      );

      expect(mockPatientRepository.update).not.toHaveBeenCalled();
    });

    it('should skip phone uniqueness check if phone unchanged', async () => {
      // Arrange
      const updateDto: UpdatePatientDto = {
        firstName: 'Jane',
        phone: existingPatient.phone, // Same phone
      };

      mockPatientRepository.findById.mockResolvedValue(existingPatient);
      mockPatientRepository.update.mockResolvedValue({
        ...existingPatient,
        firstName: 'Jane',
      });

      // Act
      await useCase.execute(patientId, updateDto, tenantId);

      // Assert
      expect(mockPatientRepository.findByPhone).not.toHaveBeenCalled();
    });

    it('should trim whitespace from updated text fields', async () => {
      // Arrange
      const updateDto: UpdatePatientDto = {
        firstName: '  Jane  ',
        lastName: '  Smith  ',
        phone: '  +2348099999999  ',
        email: '  jane.smith@example.com  ',
        address: '  789 Updated Street  ',
      };

      mockPatientRepository.findById.mockResolvedValue(existingPatient);
      mockPatientRepository.findByPhone.mockResolvedValue(null);
      mockPatientRepository.update.mockResolvedValue({
        ...existingPatient,
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+2348099999999',
        email: 'jane.smith@example.com',
        address: '789 Updated Street',
      });

      // Act
      await useCase.execute(patientId, updateDto, tenantId);

      // Assert
      expect(mockPatientRepository.update).toHaveBeenCalledWith(
        patientId,
        tenantId,
        expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+2348099999999',
          email: 'jane.smith@example.com',
          address: '789 Updated Street',
        }),
        undefined // updateDto.version — not set in this test's DTO
      );
    });

    it('should handle partial updates correctly', async () => {
      // Arrange
      const updateDto: UpdatePatientDto = {
        email: 'newemail@example.com',
      };

      mockPatientRepository.findById.mockResolvedValue(existingPatient);
      mockPatientRepository.update.mockResolvedValue({
        ...existingPatient,
        email: 'newemail@example.com',
      });

      // Act
      await useCase.execute(patientId, updateDto, tenantId);

      // Assert
      expect(mockPatientRepository.update).toHaveBeenCalledWith(
        patientId,
        tenantId,
        { email: 'newemail@example.com' },
        undefined // updateDto.version — not set in this test's DTO
      );
    });

    it('should update allergies list', async () => {
      // Arrange
      const updateDto: UpdatePatientDto = {
        allergies: ['Penicillin', 'Peanuts', 'Latex'],
      };

      mockPatientRepository.findById.mockResolvedValue(existingPatient);
      mockPatientRepository.update.mockResolvedValue({
        ...existingPatient,
        allergies: ['Penicillin', 'Peanuts', 'Latex'],
      });

      // Act
      const result = await useCase.execute(patientId, updateDto, tenantId);

      // Assert
      expect(result.allergies).toEqual(['Penicillin', 'Peanuts', 'Latex']);
      expect(result.hasAllergies).toBe(true);
    });

    it('should update chronic conditions list', async () => {
      // Arrange
      const updateDto: UpdatePatientDto = {
        chronicConditions: ['Hypertension', 'Diabetes Type 2', 'Asthma'],
      };

      mockPatientRepository.findById.mockResolvedValue(existingPatient);
      mockPatientRepository.update.mockResolvedValue({
        ...existingPatient,
        chronicConditions: ['Hypertension', 'Diabetes Type 2', 'Asthma'],
      });

      // Act
      const result = await useCase.execute(patientId, updateDto, tenantId);

      // Assert
      expect(result.chronicConditions).toEqual(['Hypertension', 'Diabetes Type 2', 'Asthma']);
    });

    it('should update emergency contact information', async () => {
      // Arrange
      const newEmergencyContact = {
        name: 'Mary Doe',
        relationship: 'Sister',
        phone: '+2348011111111',
      };

      const updateDto: UpdatePatientDto = {
        emergencyContact: newEmergencyContact,
      };

      mockPatientRepository.findById.mockResolvedValue(existingPatient);
      mockPatientRepository.update.mockResolvedValue({
        ...existingPatient,
        emergencyContact: newEmergencyContact,
      });

      // Act
      const result = await useCase.execute(patientId, updateDto, tenantId);

      // Assert
      expect(result.emergencyContact).toEqual(newEmergencyContact);
    });

    it('should handle empty update DTO without errors', async () => {
      // Arrange
      const updateDto: UpdatePatientDto = {};

      mockPatientRepository.findById.mockResolvedValue(existingPatient);
      mockPatientRepository.update.mockResolvedValue(existingPatient);

      // Act
      const result = await useCase.execute(patientId, updateDto, tenantId);

      // Assert
      // With empty DTO, updateData will be empty object {}
      expect(mockPatientRepository.update).toHaveBeenCalledWith(
        patientId,
        tenantId,
        {},
        undefined // updateDto.version — not set in this test's DTO
      );
      expect(result.id).toBe(patientId);
    });
  });
});
