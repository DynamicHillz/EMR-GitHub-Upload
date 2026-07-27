export interface AncPregnancy {
  id: string;
  patientId: string;
  gravidity: number;
  parity: number;
  lmp?: string;
  edd?: string;
  bloodGroup?: string;
  husbandBloodGroup?: string;
  isActive: boolean;
  deliveryDate?: string;
  outcome?: string;
  // Obstetric History
  livingChildren?: number;
  abortionsMiscarriages?: number;
  historyOfCSection?: boolean;
  historyOfPPH?: boolean;
  historyOfPreEclampsia?: boolean;
  historyOfStillbirth?: boolean;

  // Medical Risk Profiling
  preExistingDiabetes?: boolean;
  preExistingHypertension?: boolean;
  cardiacDisease?: boolean;
  multipleGestation?: boolean;

  createdAt: string;
  visits?: AncVisit[];
}

export interface AncVisit {
  id: string;
  pregnancyId: string;
  consultationId?: string;
  gestationalAgeWeeks?: number;
  weight?: number;
  systolicBP?: number;
  diastolicBP?: number;
  fundalHeight?: number;
  fetalHeartRate?: number;
  presentation?: string;
  urineProtein?: string;
  notes?: string;
  others?: string;

  // WHO Standard programmatic fields
  ironFolicAcidProvided?: boolean;
  calciumProvided?: boolean;
  itnProvided?: boolean;
  iptpDose?: number;
  syphilisTestResult?: string;
  hivTestResult?: string;
  hepBTestResult?: string;
  malariaRdtResult?: string;
  ultrasoundDone?: boolean;
  counselingDone?: boolean;
  ttDosesToDate?: number;
  ttDoseGivenToday?: boolean;

  createdAt: string;
  recordedBy?: {
    firstName: string;
    lastName: string;
    role: string;
  };
}
