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
  respiratoryRate: number | null;
  temperature: number | null;
  weight: number | null;
  height: number | null;
  headCircumference: number | null;
  muac: number | null;
  spO2: number | null;
  bmi: number | null;

  // WHO Z-Scores (optional cache)
  zScoreWeightForAge: number | null;
  zScoreHeightForAge: number | null;
  zScoreWeightForHeight: number | null;
  zScoreBMIForAge: number | null;

  // Diagnoses (ICD-11/10) (REQ-CLIN-5)
  diagnoses: any[]; // Array of ConsultationDiagnosis
  icd10Codes?: string[];

  // Status (REQ-CLIN-6)
  status: ConsultationStatus;
  billingStatus: string;
  finalizedAt: Date | null;

  consultationDate: Date;
  createdAt: Date;
  updatedAt: Date;

  // Optimistic-concurrency token — callers must echo this back on update so
  // a stale save (autosave racing a manual save, or two tabs editing the
  // same consultation) gets a conflict instead of silently overwriting.
  version?: number;
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
    public readonly respiratoryRate: number | null,
    public readonly temperature: number | null,
    public readonly weight: number | null,
    public readonly height: number | null,
    public readonly headCircumference: number | null,
    public readonly muac: number | null,
    public readonly spO2: number | null,
    public readonly bmi: number | null,
    public readonly zScoreWeightForAge: number | null,
    public readonly zScoreHeightForAge: number | null,
    public readonly zScoreWeightForHeight: number | null,
    public readonly zScoreBMIForAge: number | null,
    public readonly diagnoses: any[],
    public readonly status: ConsultationStatus,
    public readonly billingStatus: string,
    public readonly finalizedAt: Date | null,
    public readonly consultationDate: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly icd10Codes?: string[]
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
   * Get formatted diagnoses
   */
  getDiagnoses(): any[] {
    return this.diagnoses || [];
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
      data.bloodPressure || (data.systolicBP && data.diastolicBP ? `${data.systolicBP}/${data.diastolicBP}` : null),
      data.heartRate,
      data.respiratoryRate,
      data.temperature,
      data.weight,
      data.height,
      data.headCircumference,
      data.muac,
      data.spO2,
      data.bmi !== null ? Number(data.bmi) : null,
      data.zScoreWeightForAge || null,
      data.zScoreHeightForAge || null,
      data.zScoreWeightForHeight || null,
      data.zScoreBMIForAge || null,
      Array.isArray(data.diagnoses) ? data.diagnoses.map((d: any) => ({
        diagnosisId: d.diagnosisId,
        code: d.diagnosis?.code,
        name: d.diagnosis?.name,
        isPrimary: d.isPrimary,
        notes: d.notes,
      })) : [],
      data.status as ConsultationStatus,
      data.billingStatus || 'UNBILLED',
      data.finalizedAt ? new Date(data.finalizedAt) : null,
      data.consultationDate ? new Date(data.consultationDate) : new Date(),
      data.createdAt ? new Date(data.createdAt) : new Date(),
      data.updatedAt ? new Date(data.updatedAt) : new Date(),
      Array.isArray(data.icd10Codes) ? data.icd10Codes : []
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
      respiratoryRate: this.respiratoryRate,
      temperature: this.temperature,
      weight: this.weight,
      height: this.height,
      headCircumference: this.headCircumference,
      muac: this.muac,
      spO2: this.spO2,
      bmi: this.bmi,
      zScoreWeightForAge: this.zScoreWeightForAge,
      zScoreHeightForAge: this.zScoreHeightForAge,
      zScoreWeightForHeight: this.zScoreWeightForHeight,
      zScoreBMIForAge: this.zScoreBMIForAge,
      icd10Codes: this.icd10Codes ? JSON.stringify(this.icd10Codes) : null,
      diagnoses: this.diagnoses,
      status: this.status,
      finalizedAt: this.finalizedAt,
      consultationDate: this.consultationDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
