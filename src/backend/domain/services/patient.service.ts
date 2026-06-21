/**
 * Patient Domain Service
 *
 * Contains complex business logic for patient-related operations.
 * Domain services coordinate between entities and enforce business rules.
 */

import { PatientEntity } from '../entities/Patient.entity';
import { IPatientRepository, PatientCreateData, PatientUpdateData } from '../interfaces/IPatientRepository';

export class PatientService {
  constructor(private patientRepository: IPatientRepository) {}

  /**
   * Register a new patient
   */
  async registerPatient(data: PatientCreateData): Promise<PatientEntity> {
    // Business rule: Patient ID must be unique within tenant
    const isUnique = await this.patientRepository.isPatientIdUnique(
      data.patientId,
      data.tenantId
    );

    if (!isUnique) {
      throw new Error(`Patient ID ${data.patientId} already exists`);
    }

    // Business rule: Patient must be at least 0 years old and not born in the future
    const today = new Date();
    if (data.dateOfBirth > today) {
      throw new Error('Date of birth cannot be in the future');
    }

    // Business rule: Validate phone number format (basic validation)
    const phoneRegex = /^[\d\s\-+()]+$/;
    if (!phoneRegex.test(data.phone)) {
      throw new Error('Invalid phone number format');
    }

    // Business rule: Email validation if provided
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new Error('Invalid email format');
      }
    }

    return await this.patientRepository.create(data);
  }

  /**
   * Update patient information
   */
  async updatePatient(
    patientId: string,
    tenantId: string,
    data: PatientUpdateData
  ): Promise<PatientEntity> {
    // Ensure patient exists
    const existingPatient = await this.patientRepository.findById(patientId, tenantId);
    if (!existingPatient) {
      throw new Error('Patient not found');
    }

    // Business rule: Date of birth validation
    if (data.dateOfBirth) {
      const today = new Date();
      if (data.dateOfBirth > today) {
        throw new Error('Date of birth cannot be in the future');
      }
    }

    // Business rule: Phone validation if provided
    if (data.phone) {
      const phoneRegex = /^[\d\s\-+()]+$/;
      if (!phoneRegex.test(data.phone)) {
        throw new Error('Invalid phone number format');
      }
    }

    // Business rule: Email validation if provided
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new Error('Invalid email format');
      }
    }

    return await this.patientRepository.update(patientId, tenantId, data);
  }

  /**
   * Get patient by ID
   */
  async getPatientById(patientId: string, tenantId: string): Promise<PatientEntity> {
    const patient = await this.patientRepository.findById(patientId, tenantId);
    if (!patient) {
      throw new Error('Patient not found');
    }
    return patient;
  }

  /**
   * Get patient by patient ID
   */
  async getPatientById2(patientId: string, tenantId: string): Promise<PatientEntity> {
    const patient = await this.patientRepository.findByPatientId(patientId, tenantId);
    if (!patient) {
      throw new Error('Patient not found');
    }
    return patient;
  }

  /**
   * Check if patient can receive a specific medication
   * (Example of domain logic that coordinates with patient allergies)
   */
  async canReceiveMedication(patientId: string, tenantId: string, medication: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const patient = await this.getPatientById(patientId, tenantId);

    // Check allergies
    if (patient.hasAllergy(medication)) {
      return {
        allowed: false,
        reason: `Patient has documented allergy to ${medication}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Generate next patient number for a tenant
   * This is a domain service operation as it involves business logic
   */
  async generatePatientNumber(_tenantId: string, prefix: string = 'PAT'): Promise<string> {
    // In a real implementation, this would query for the last patient number
    // For now, we'll generate a simple format
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }
}
