import type { Gender, PatientStatus } from '../../shared/types/prisma-enums.ts';;

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  address?: string;
}

export class PatientEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly patientId: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly dateOfBirth: Date,
    public readonly gender: Gender,
    public readonly phone: string,
    public readonly email: string | null,
    public readonly address: string | null,
    public readonly city: string | null,
    public readonly state: string | null,
    public readonly lga: string | null,
    public readonly country: string,
    public readonly nationality: string | null,
    public readonly occupation: string | null,
    public readonly maritalStatus: string | null,
    public readonly bloodGroup: string | null,
    public readonly genotype: string | null,
    public readonly allergies: string[],
    public readonly patientAllergies: any[],
    public readonly chronicConditions: string[],
    public readonly pastSurgicalHistory: string | null,
    public readonly emergencyContact: EmergencyContact | null,
    public readonly nhisNumber: string | null,
    public readonly patientType: 'PRIVATE' | 'HMO',
    public readonly hmoProvider: string | null,
    public readonly hmoProviderId: string | null,
    public readonly hmoNumber: string | null,
    public readonly photoUrl: string | null,
    public readonly consentGiven: boolean, // US-PAT-006: Consent tracking
    public readonly consentDate: Date | null,
    public readonly consentVersion: string | null,
    public readonly status: PatientStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
    public readonly version: number = 1,
    // Newborn linkage (see record-delivery-outcome.use-case.ts) — set on a
    // newborn's own record, or lists the newborns this patient is the
    // mother of. Declared optional (not just default-valued) so existing
    // plain-object test mocks of this structurally-typed class don't need
    // to name every field just to satisfy the type.
    public readonly motherPatientId?: string | null,
    public readonly mother?: { id: string; patientId: string; firstName: string; lastName: string } | null,
    public readonly newbornChildren?: Array<{ id: string; patientId: string; firstName: string; lastName: string }>
  ) {}

  /**
   * Get patient number (alias for patientId for backward compatibility)
   */
  public get patientNumber(): string {
    return this.patientId;
  }

  /**
   * Calculate patient's age in years
   */
  public calculateAge(): number {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Check if patient is a minor (under 18)
   */
  public isMinor(): boolean {
    return this.calculateAge() < 18;
  }

  /**
   * Check if patient has a specific allergy
   */
  public hasAllergy(allergyName: string): boolean {
    return this.allergies.some(
      allergy => allergy.toLowerCase().includes(allergyName.toLowerCase())
    );
  }

  /**
   * Check if patient has any allergies
   */
  public hasAnyAllergies(): boolean {
    return this.allergies.length > 0;
  }

  /**
   * Check if patient has a specific chronic condition
   */
  public hasChronicCondition(conditionName: string): boolean {
    return this.chronicConditions.some(
      condition => condition.toLowerCase().includes(conditionName.toLowerCase())
    );
  }

  /**
   * Check if patient is active
   */
  public isActive(): boolean {
    return this.status === 'ACTIVE' && this.deletedAt === null;
  }

  /**
   * Check if patient is soft deleted
   */
  public isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  /**
   * Get patient's full name
   */
  public getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  /**
   * Get patient display info for UI
   */
  public toDisplayInfo() {
    return {
      id: this.patientId,
      name: this.getFullName(),
      age: this.calculateAge(),
      gender: this.gender,
      phone: this.phone,
      hasAllergies: this.hasAnyAllergies(),
      status: this.status,
    };
  }

  /**
   * Create a new patient entity from database record
   */
  static fromDatabase(data: any): PatientEntity {
    let parsedEmergencyContact = data.emergencyContact;
    if (typeof data.emergencyContact === 'string') {
      try {
        parsedEmergencyContact = JSON.parse(data.emergencyContact);
      } catch (e) {
        // Ignore
      }
    }
    return new PatientEntity(
      data.id,
      data.tenantId,
      data.patientId || data.patientNumber, // Support both field names
      data.firstName,
      data.lastName,
      data.dateOfBirth,
      data.gender,
      data.phone,
      data.email,
      data.address,
      data.city,
      data.state,
      data.lga,
      data.country,
      data.nationality,
      data.occupation,
      data.maritalStatus,
      data.bloodGroup,
      data.genotype,
      data.allergies,
      data.PatientAllergy || [],
      data.chronicConditions,
      data.pastSurgicalHistory,
      parsedEmergencyContact,
      data.nhisNumber,
      data.patientType || 'PRIVATE',
      data.hmoProvider || null,
      data.hmoProviderId || null,
      data.hmoNumber || null,
      data.photoUrl,
      data.consentGiven || false, // US-PAT-006: Default to false if not provided
      data.consentDate || null,
      data.consentVersion || null,
      data.status,
      data.createdAt,
      data.updatedAt,
      data.deletedAt,
      data.version ?? 1,
      data.motherPatientId ?? null,
      data.mother ?? null,
      data.newbornChildren ?? []
    );
  }
}
