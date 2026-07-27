export interface ImmunizationSchedule {
  id: string;
  vaccineName: string;
  diseaseTarget: string;
  targetAgeWeeks: number;
  route?: string;
  description?: string;
}

export interface PatientImmunization {
  id: string;
  patientId: string;
  scheduleId: string;
  administeredAt: string;
  batchNumber?: string;
  nextDueDate?: string;
  notes?: string;
  hasAdverseReaction: boolean;
  reactionNotes?: string;
  schedule?: ImmunizationSchedule;
  administeredBy?: {
    firstName: string;
    lastName: string;
    role: string;
  };
}
