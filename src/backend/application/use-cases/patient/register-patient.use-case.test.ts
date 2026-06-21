/**
 * Register Patient Use Case Tests
 *
 * Tests for patient registration business logic
 */

import { RegisterPatientUseCase } from './register-patient.use-case';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { PatientIdGenerator } from '../../../infrastructure/generators/patient-id.generator';
import { RegisterPatientDto } from '../../dtos/patient/RegisterPatient.dto';
import { ConflictError } from '../../../shared/errors/AppError';

describe('RegisterPatientUseCase', () => {
  let useCase: RegisterPatientUseCase;
  let mockPatientRepository: jest.Mocked<IPatientRepository>;
  let mockPatientIdGenerator: jest.Mocked<PatientIdGenerator>;

  const tenantId = 'test-tenant-001';
  const mockPatientId = 'P000001';

  beforeEach(() => {
    // Create mocks
    mockPatientRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPatientId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    } as any;

    mockPatientIdGenerator = {
      generatePatientId: jest.fn(),
    } as any;

    // Instantiate use case with mocks
    useCase = new RegisterPatientUseCase(
      mockPatientRepository,
      mockPatientIdGenerator
    );
  });

  describe('execute', () => {
    const validDto: RegisterPatientDto = {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      gender: 'MALE',
      phone: '+2348012345678',
      email: 'john.doe@example.com',
      address: '123 Test Street, Lagos',
      bloodGroup: 'O+',
      allergies: [],
      chronicConditions: [],
      consentGiven: true,
    };

    it('should successfully register a new patient', async () => {
      // Arrange
      mockPatientIdGenerator.generatePatientId.mockResolvedValue(mockPatientId);
      mockPatientRepository.search.mockResolvedValue({
        total: 0,
        data: [],
        skip: 0,
        take: 1,
      });

      const mockCreatedPatient = {
        id: 'patient-uuid-123',
        tenantId,
        patientId: mockPatientId,
        firstName: validDto.firstName,
        lastName: validDto.lastName,
        dateOfBirth: new Date(validDto.dateOfBirth),
        gender: validDto.gender,
        phone: validDto.phone,
        email: validDto.email,
        address: validDto.address,
        bloodGroup: validDto.bloodGroup,
        genotype: null,
        allergies: [],
        chronicConditions: [],
        emergencyContact: null,
        status: 'ACTIVE',
        consentGiven: true,
        consentDate: new Date(),
        consentVersion: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPatientRepository.create.mockResolvedValue(mockCreatedPatient);

      // Act
      const result = await useCase.execute(validDto, tenantId);

      // Assert
      expect(mockPatientIdGenerator.generatePatientId).toHaveBeenCalledWith(tenantId);
      expect(mockPatientRepository.search).toHaveBeenCalledWith({
        tenantId,
        query: validDto.phone,
        take: 1,
      });
      expect(mockPatientRepository.create).toHaveBeenCalledWith({
        patientId: mockPatientId,
        firstName: validDto.firstName.trim(),
        lastName: validDto.lastName.trim(),
        dateOfBirth: new Date(validDto.dateOfBirth),
        gender: validDto.gender,
        phone: validDto.phone.trim(),
        email: validDto.email.trim(),
        address: validDto.address.trim(),
        bloodGroup: validDto.bloodGroup,
        allergies: [],
        chronicConditions: [],
        emergencyContact: undefined,
        consentGiven: true,
        tenantId,
      });

      expect(result).toMatchObject({
        id: mockCreatedPatient.id,
        patientId: mockPatientId,
        firstName: validDto.firstName,
        lastName: validDto.lastName,
        fullName: 'John Doe',
        gender: validDto.gender,
        phone: validDto.phone,
        email: validDto.email,
        status: 'ACTIVE',
        consentGiven: true,
      });
    });

    it('should throw ConflictError if phone number already exists', async () => {
      // Arrange
      mockPatientIdGenerator.generatePatientId.mockResolvedValue(mockPatientId);
      mockPatientRepository.search.mockResolvedValue({
        total: 1,
        data: [
          {
            id: 'existing-patient-id',
            tenantId,
            patientId: 'P000000',
            phone: validDto.phone,
          } as any,
        ],
        skip: 0,
        take: 1,
      });

      // Act & Assert
      await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(ConflictError);
      await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(
        'A patient with this phone number already exists'
      );

      expect(mockPatientRepository.create).not.toHaveBeenCalled();
    });

    it('should trim whitespace from text fields', async () => {
      // Arrange
      const dtoWithWhitespace: RegisterPatientDto = {
        ...validDto,
        firstName: '  John  ',
        lastName: '  Doe  ',
        phone: '  +2348012345678  ',
        email: '  john.doe@example.com  ',
        address: '  123 Test Street  ',
      };

      mockPatientIdGenerator.generatePatientId.mockResolvedValue(mockPatientId);
      mockPatientRepository.search.mockResolvedValue({
        total: 0,
        data: [],
        skip: 0,
        take: 1,
      });

      mockPatientRepository.create.mockResolvedValue({
        id: 'patient-uuid-123',
        tenantId,
        patientId: mockPatientId,
        firstName: 'John',
        lastName: 'Doe',
        phone: '+2348012345678',
        email: 'john.doe@example.com',
        address: '123 Test Street',
        dateOfBirth: new Date(validDto.dateOfBirth),
        gender: validDto.gender,
        bloodGroup: validDto.bloodGroup,
        genotype: null,
        allergies: [],
        chronicConditions: [],
        emergencyContact: null,
        status: 'ACTIVE',
        consentGiven: true,
        consentDate: new Date(),
        consentVersion: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await useCase.execute(dtoWithWhitespace, tenantId);

      // Assert
      expect(mockPatientRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          phone: '+2348012345678',
          email: 'john.doe@example.com',
          address: '123 Test Street',
        })
      );
    });

    it('should handle optional fields correctly', async () => {
      // Arrange
      const minimalDto: RegisterPatientDto = {
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1985-05-15',
        gender: 'FEMALE',
        phone: '+2348087654321',
        consentGiven: true,
      };

      mockPatientIdGenerator.generatePatientId.mockResolvedValue(mockPatientId);
      mockPatientRepository.search.mockResolvedValue({
        total: 0,
        data: [],
        skip: 0,
        take: 1,
      });

      mockPatientRepository.create.mockResolvedValue({
        id: 'patient-uuid-456',
        tenantId,
        patientId: mockPatientId,
        firstName: minimalDto.firstName,
        lastName: minimalDto.lastName,
        dateOfBirth: new Date(minimalDto.dateOfBirth),
        gender: minimalDto.gender,
        phone: minimalDto.phone,
        email: null,
        address: null,
        bloodGroup: null,
        genotype: null,
        allergies: [],
        chronicConditions: [],
        emergencyContact: null,
        status: 'ACTIVE',
        consentGiven: true,
        consentDate: new Date(),
        consentVersion: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(minimalDto, tenantId);

      // Assert
      expect(mockPatientRepository.create).toHaveBeenCalledWith({
        patientId: mockPatientId,
        firstName: minimalDto.firstName.trim(),
        lastName: minimalDto.lastName.trim(),
        dateOfBirth: new Date(minimalDto.dateOfBirth),
        gender: minimalDto.gender,
        phone: minimalDto.phone.trim(),
        email: undefined,
        address: undefined,
        bloodGroup: undefined,
        allergies: [],
        chronicConditions: [],
        emergencyContact: undefined,
        consentGiven: true,
        tenantId,
      });

      expect(result.email).toBeNull();
      expect(result.address).toBeNull();
      expect(result.bloodGroup).toBeNull();
    });

    it('should include allergies and chronic conditions', async () => {
      // Arrange
      const dtoWithConditions: RegisterPatientDto = {
        ...validDto,
        allergies: ['Penicillin', 'Peanuts'],
        chronicConditions: ['Hypertension', 'Diabetes Type 2'],
      };

      mockPatientIdGenerator.generatePatientId.mockResolvedValue(mockPatientId);
      mockPatientRepository.search.mockResolvedValue({
        total: 0,
        data: [],
        skip: 0,
        take: 1,
      });

      mockPatientRepository.create.mockResolvedValue({
        id: 'patient-uuid-789',
        tenantId,
        patientId: mockPatientId,
        firstName: validDto.firstName,
        lastName: validDto.lastName,
        dateOfBirth: new Date(validDto.dateOfBirth),
        gender: validDto.gender,
        phone: validDto.phone,
        email: validDto.email,
        address: validDto.address,
        bloodGroup: validDto.bloodGroup,
        genotype: null,
        allergies: ['Penicillin', 'Peanuts'],
        chronicConditions: ['Hypertension', 'Diabetes Type 2'],
        emergencyContact: null,
        status: 'ACTIVE',
        consentGiven: true,
        consentDate: new Date(),
        consentVersion: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await useCase.execute(dtoWithConditions, tenantId);

      // Assert
      expect(result.allergies).toEqual(['Penicillin', 'Peanuts']);
      expect(result.chronicConditions).toEqual(['Hypertension', 'Diabetes Type 2']);
      expect(result.hasAllergies).toBe(true);
    });
  });
});
