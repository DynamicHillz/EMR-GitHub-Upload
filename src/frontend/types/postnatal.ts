export type PncContactType = 'PNC_24H' | 'PNC_DAY3' | 'PNC_WEEK1' | 'PNC_WEEK6' | 'OTHER';

export interface PostnatalVisit {
  id: string;
  patientId: string;
  pregnancyId?: string;
  contactType: PncContactType;
  visitDate: string;
  recordedById: string;

  maternalTemperature?: number;
  maternalSystolicBP?: number;
  maternalDiastolicBP?: number;
  lochiaStatus?: string;
  uterineInvolutionNormal?: boolean;
  perinealWoundStatus?: string;
  breastfeedingStatus?: string;
  moodScreeningConcern?: boolean;

  newbornWeightGrams?: number;
  newbornTemperature?: number;
  newbornFeedingWell?: boolean;
  cordConditionNormal?: boolean;
  jaundiceObserved?: boolean;
  newbornDangerSigns: string[];

  familyPlanningCounselingDone?: boolean;
  notes?: string;

  recordedBy?: { firstName: string; lastName: string };
}

export interface RecordPostnatalVisitDto {
  pregnancyId?: string;
  appointmentId?: string;
  contactType: PncContactType;
  visitDate?: string;
  maternalTemperature?: number;
  maternalSystolicBP?: number;
  maternalDiastolicBP?: number;
  lochiaStatus?: string;
  uterineInvolutionNormal?: boolean;
  perinealWoundStatus?: string;
  breastfeedingStatus?: string;
  moodScreeningConcern?: boolean;
  newbornWeightGrams?: number;
  newbornTemperature?: number;
  newbornFeedingWell?: boolean;
  cordConditionNormal?: boolean;
  jaundiceObserved?: boolean;
  newbornDangerSigns?: string[];
  familyPlanningCounselingDone?: boolean;
  notes?: string;
}

export interface PostnatalWorklistItem {
  id: string;
  patientId: string;
  pregnancyId?: string;
  laborRecordId: string;
  contactType: PncContactType;
  expectedDate: string;
  patient: { id: string; firstName: string; lastName: string; patientId: string };
}
