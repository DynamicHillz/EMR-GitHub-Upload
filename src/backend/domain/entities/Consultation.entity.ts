/**
 * Consultation Entity
 *
 * Domain entity representing a clinical consultation/encounter with SOAP notes,
 * vital signs, and diagnosis codes.
 *
 * Requirements:
 * - REQ-CLIN-1: SOAP format documentation
 * - REQ-CLIN-2: Vital signs capture with BMI calculation
 * - REQ-CLIN-6: Lock finalized consultations
 */

import { logger } from '../../config/logger';

export enum ConsultationStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
  LOCKED = 'LOCKED',
}

export interface Consultation {
  id: string;
  tenantId: string;
  patientId: string;
  doctorId: string;

  // SOAP Notes (REQ-CLIN-1)
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;

  // Vital Signs (REQ-CLIN-2)
  bloodPressure: string | null;
  heartRate: number | null;
  temperature: number | null;
  weight: number | null;
  height: number | null;
  spO2: number | null;
  bmi: number | null;

  // ICD-10 Codes (REQ-CLIN-5)
  icd10Codes: string | null; // JSON array stored as string

  // Status (REQ-CLIN-6)
  status: ConsultationStatus;
  finalizedAt: Date | null;

  consultationDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ConsultationEntity implements Consultation {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly patientId: string,
    public readonly doctorId: string,
    public readonly subjective: string | null,
    public readonly objective: string | null,
    public readonly assessment: string | null,
    public readonly plan: string | null,
    public readonly bloodPressure: string | null,
    public readonly heartRate: number | null,
    public readonly temperature: number | null,
    public readonly weight: number | null,
    public readonly height: number | null,
    public readonly spO2: number | null,
    public readonly bmi: number | null,
    public readonly icd10Codes: string | null,
    public readonly status: ConsultationStatus,
    public readonly finalizedAt: Date | null,
    public readonly consultationDate: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  /**
   * Check if consultation is in draft status
   */
  isDraft(): boolean {
    return this.status === ConsultationStatus.DRAFT;
  }

  /**
   * Check if consultation is finalized
   */
  isFinalized(): boolean {
    return this.status === ConsultationStatus.FINALIZED;
  }

  /**
   * Check if consultation is locked
   */
  isLocked(): boolean {
    return this.status === ConsultationStatus.LOCKED;
  }

  /**
   * Check if consultation can be edited
   * Only DRAFT consultations can be edited (REQ-CLIN-6)
   */
  canEdit(): boolean {
    return this.isDraft();
  }

  /**
   * Check if consultation can be finalized
   * Must be in DRAFT status and have required SOAP sections
   */
  canFinalize(): boolean {
    if (!this.isDraft()) {
      return false;
    }

    // Must have at least subjective and assessment to finalize
    return !!(this.subjective && this.assessment);
  }

  /**
   * Calculate BMI from weight and height (REQ-CLIN-2)
   * BMI = weight (kg) / (height (m))^2
   *
   * @returns BMI value rounded to 1 decimal place, or null if weight/height missing
   */
  calculateBMI(): number | null {
    if (!this.weight || !this.height) {
      return null;
    }

    const heightInMeters = this.height / 100; // Convert cm to meters
    const bmi = this.weight / (heightInMeters ** 2);

    return parseFloat(bmi.toFixed(1));
  }

  /**
   * Get BMI category based on WHO classification
   */
  getBMICategory(): string | null {
    const bmi = this.bmi ?? this.calculateBMI();
    if (!bmi) return null;

    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal weight';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  }

  /**
   * Parse ICD-10 codes from JSON string to array
   */
  getICD10Codes(): string[] {
    if (!this.icd10Codes) {
      return [];
    }

    try {
      const parsed = JSON.parse(this.icd10Codes);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.error('Error parsing ICD-10 codes:', error);
      return [];
    }
  }

  /**
   * Check if vital signs are complete
   */
  hasCompleteVitalSigns(): boolean {
    return !!(
      this.bloodPressure &&
      this.heartRate &&
      this.temperature &&
      this.spO2
    );
  }

  /**
   * Get consultation summary for display
   */
  getSummary(): string {
    if (this.subjective) {
      return this.subjective.substring(0, 100) + (this.subjective.length > 100 ? '...' : '');
    }
    return 'No chief complaint recorded';
  }

  /**
   * Validate blood pressure format
   * Expected format: XXX/YYY (e.g., 120/80)
   */
  static isValidBloodPressure(bp: string): boolean {
    const bpPattern = /^\d{2,3}\/\d{2,3}$/;
    return bpPattern.test(bp);
  }

  /**
   * Create a new consultation entity from database record
   */
  static fromDatabase(data: any): ConsultationEntity {
    return new ConsultationEntity(
      data.id,
      data.tenantId,
      data.patientId,
      data.doctorId,
      data.subjective,
      data.objective,
      data.assessment,
      data.plan,
      data.bloodPressure,
      data.heartRate,
      data.temperature,
      data.weight,
      data.height,
      data.spO2,
      data.bmi,
      data.icd10Codes,
      data.status as ConsultationStatus,
      data.finalizedAt,
      data.consultationDate,
      data.createdAt,
      data.updatedAt
    );
  }

  /**
   * Convert entity to plain object for persistence
   */
  toDatabase(): any {
    return {
      id: this.id,
      tenantId: this.tenantId,
      patientId: this.patientId,
      doctorId: this.doctorId,
      subjective: this.subjective,
      objective: this.objective,
      assessment: this.assessment,
      plan: this.plan,
      bloodPressure: this.bloodPressure,
      heartRate: this.heartRate,
      temperature: this.temperature,
      weight: this.weight,
      height: this.height,
      spO2: this.spO2,
      bmi: this.bmi,
      icd10Codes: this.icd10Codes,
      status: this.status,
      finalizedAt: this.finalizedAt,
      consultationDate: this.consultationDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
