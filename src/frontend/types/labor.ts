export type LaborStatus = 'IN_LABOR' | 'DELIVERED' | 'TRANSFERRED' | 'DISCONTINUED';

export interface PartographObservation {
  id: string;
  laborRecordId: string;
  recordedById: string;
  recordedAt: string;

  cervicalDilation?: number;
  fetalHeartRate?: number;

  descentOfHead?: string;
  liquor?: string;
  moulding?: string;
  contractionsFrequencyPer10Min?: number;
  contractionsDurationSeconds?: number;
  maternalPulse?: number;
  maternalSystolicBP?: number;
  maternalDiastolicBP?: number;
  maternalTemperature?: number;
  urineProtein?: string;
  urineAcetone?: string;
  urineVolumeMl?: number;
  oxytocinDose?: string;
  drugsGiven?: string;
  ivFluids?: string;
  notes?: string;

  recordedBy?: { firstName: string; lastName: string };
}

export interface LaborRecord {
  id: string;
  admissionId: string;
  patientId: string;
  pregnancyId?: string;
  startedById: string;

  laborOnsetAt: string;
  onsetType?: string;
  activePhaseOnsetAt?: string;
  romAt?: string;
  romType?: string;
  liquorAtRom?: string;

  status: LaborStatus;

  deliveredAt?: string;
  deliveredById?: string;
  modeOfDelivery?: string;
  perineumStatus?: string;
  estimatedBloodLossMl?: number;
  babyOutcome?: string;
  babySex?: 'MALE' | 'FEMALE' | 'OTHER';
  babyBirthWeightGrams?: number;
  apgarScore1Min?: number;
  apgarScore5Min?: number;
  resuscitationRequired?: boolean;
  deliveryNotes?: string;
  newbornPatientId?: string;
  newbornPatient?: NewbornPatientSummary;

  pregnancy?: { id: string; gravidity: number; parity: number; lmp?: string; edd?: string };
  startedBy?: { firstName: string; lastName: string };
  deliveredBy?: { firstName: string; lastName: string };
  observations?: PartographObservation[];
}

export interface ActiveLaborWorklistItem extends LaborRecord {
  admission: {
    id: string;
    patient: { id: string; patientId: string; firstName: string; lastName: string };
    bed: { bedNumber: string; ward: { name: string } };
  };
  observations: PartographObservation[]; // latest 1
}

export interface StartLaborDto {
  laborOnsetAt?: string;
  onsetType?: string;
  romAt?: string;
  romType?: string;
  liquorAtRom?: string;
  pregnancyId?: string;
}

export interface RecordObservationDto {
  recordedAt?: string;
  cervicalDilation?: number;
  fetalHeartRate?: number;
  descentOfHead?: string;
  liquor?: string;
  moulding?: string;
  contractionsFrequencyPer10Min?: number;
  contractionsDurationSeconds?: number;
  maternalPulse?: number;
  maternalSystolicBP?: number;
  maternalDiastolicBP?: number;
  maternalTemperature?: number;
  urineProtein?: string;
  urineAcetone?: string;
  urineVolumeMl?: number;
  oxytocinDose?: string;
  drugsGiven?: string;
  ivFluids?: string;
  notes?: string;
}

export interface RecordDeliveryOutcomeDto {
  deliveredAt?: string;
  modeOfDelivery?: string;
  perineumStatus?: string;
  estimatedBloodLossMl?: number;
  babyOutcome?: string;
  babySex?: 'MALE' | 'FEMALE' | 'OTHER';
  babyBirthWeightGrams?: number;
  apgarScore1Min?: number;
  apgarScore5Min?: number;
  resuscitationRequired?: boolean;
  deliveryNotes?: string;
  registerNewbornAsPatient?: boolean;
}

export interface NewbornPatientSummary {
  id: string;
  patientId: string;
}

export interface DiscontinueLaborDto {
  status: 'TRANSFERRED' | 'DISCONTINUED';
  reason: string;
}
