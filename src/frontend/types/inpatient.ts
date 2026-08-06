import { User } from './auth.types';

export type Patient = any;
export type Prescription = any;

export interface Ward {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  capacity: number;
  status: string;
  beds?: Bed[];
}

export interface Bed {
  id: string;
  wardId: string;
  bedNumber: string;
  type?: string;
  isolationReady: boolean;
  status: string;
  ward?: Ward;
  admissions?: Admission[];
}

export interface Admission {
  id: string;
  patientId: string;
  bedId: string;
  admittedById: string;
  admissionDate: string;
  dischargeDate?: string;
  /** When the bed actually became available again after discharge — null
   * means the bed is still being held for this admission. See
   * OverstayStatus for the countdown/overstay computation. */
  bedClearedAt?: string | null;
  reason: string;
  status: string;
  notes?: string;
  isolationRequired: boolean;
  infectionRisk?: string;

  /** MEDICAL | SURGERY | CHILD_BIRTH — drives which clinical tabs show on
   * the inpatient details page (see showOperationNote/showPartograph for
   * the manual per-admission override). */
  admissionType: string;
  /** Manual override: shows the Operation Note tab even for a MEDICAL
   * admission (e.g. surgery becomes necessary mid-stay). */
  showOperationNote: boolean;
  /** Manual override: shows the Partograph tab outside a CHILD_BIRTH admission. */
  showPartograph: boolean;
  /** Manual override: shows the "Record Oxygen" quick action for this
   * admission — off by default, since most admissions never need it. */
  showOxygen: boolean;

  patient?: Patient;
  bed?: Bed;
  admittedBy?: User;
  wardRounds?: WardRound[];
  medicationAdministrations?: MedicationAdministration[];
  prescriptions?: Prescription[];
  diagnoses?: AdmissionDiagnosis[];
  dischargeSummary?: DischargeSummary;
  transferHistory?: BedTransferHistory[];
  operationNotes?: OperationNote[];
  vitalCharts?: VitalChart[];
}

export interface VitalChart {
  id: string;
  admissionId: string;
  recordedAt: string;
  temperature?: number;
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  respiratoryRate?: number;
  spO2?: number;
  painScore?: number;
}

export interface OperationNote {
  id: string;
  admissionId: string;
  recordedById: string;
  surgicalProcedure: string;
  indication?: string;
  surgeons: string;
  assistants?: string;
  anaesthetics?: string;
  anaesthetist?: string;
  incision?: string;
  findings?: string;
  procedure?: string;
  plan?: string;
  others?: string;
  operationDate: string;
  createdAt: string;
  billingStatus?: 'UNBILLED' | 'BILLED';

  recordedBy?: User;
  // Only populated by GET /inpatients/operation-notes (the cross-admission
  // log) — the per-admission fetch (GET /admissions/:id/operation-notes)
  // already has this context from the page it's rendered on, so it doesn't
  // bother joining it.
  admission?: {
    id: string;
    patient?: { id: string; patientId: string; firstName: string; lastName: string };
  };
}

export interface OperationNotesLogResponse {
  notes: OperationNote[];
  total: number;
  page: number;
  limit: number;
}

export interface AdmissionDiagnosis {
  id: string;
  diagnosisId: string;
  isPrimary: boolean;
  isAdmission: boolean;
  notes?: string;
  diagnosis?: any; // DiagnosisCatalog
}

export interface DischargeSummary {
  id: string;
  finalNotes: string;
  followUpPlan?: string;
  ttoMedications?: any;
}

export interface BedTransferHistory {
  id: string;
  fromBedId: string;
  toBedId: string;
  transferredById: string;
  transferDate: string;
  reason: string;
  fromBed?: Bed;
  toBed?: Bed;
  transferredBy?: User;
}

// One entry per newly-added medication that triggered an allergy/
// interaction/duplicate-therapy flag (REQ-CLIN-7) — same checks
// CreatePrescriptionUseCase runs, now also run when a medication is added
// during a ward round. Absent/empty medicationWarnings means nothing to warn about.
export interface MedicationWarning {
  medicationName: string;
  allergyWarning: boolean;
  allergyDetails: string[];
  interactionWarning: boolean;
  interactionDetails: string[];
  duplicateWarning: boolean;
  duplicateDetails: string[];
}

export interface WardRound {
  id: string;
  admissionId: string;
  conductedById: string;
  roundDate: string;
  notes: string;
  vitals?: any;
  plan?: string;
  medicationWarnings?: MedicationWarning[];

  conductedBy?: User;
}

// Powers the "Awaiting Bed Clearance" countdown on InpatientPage — one entry
// per discharged admission whose bed is still being held (bedClearedAt null).
export interface OverstayStatus {
  admissionId: string;
  patient?: Patient;
  bed?: Bed;
  dischargeDate: string;
  billingStatus: 'UNBILLED' | 'BILLED';
  daysSinceDischarge: number;
  graceDaysRemaining: number;
  overstayDays: number;
  estimatedExtraCharge: number;
  isOverstay: boolean;
}

export interface MedicationAdministration {
  id: string;
  admissionId: string;
  prescriptionId?: string;
  administeredById: string;
  medicationName: string;
  dosage: string;
  administeredAt: string;
  notes?: string;
  status: string;

  prescription?: Prescription;
  administeredBy?: User;
}
