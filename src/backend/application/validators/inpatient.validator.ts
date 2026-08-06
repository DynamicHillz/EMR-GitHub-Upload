/**
 * Inpatient Validators
 *
 * Joi validation schemas for the inpatient module — previously had none at
 * all (no Joi, no validateRequest, no manual field checks anywhere), unlike
 * consultation.validator.ts. Vital-sign ranges intentionally mirror
 * consultation.validator.ts's ranges so the two modules stay consistent.
 *
 * validateRequest strips unknown fields by default, so every schema below
 * must include every field the corresponding inpatient.service.ts method
 * actually reads, not just the "important" ones.
 */

import Joi from 'joi';

const ADMINISTRATION_ROUTES = [
  'ORAL', 'INTRAVENOUS', 'INTRAMUSCULAR', 'SUBCUTANEOUS', 'TOPICAL',
  'RECTAL', 'SUBLINGUAL', 'INHALATION', 'OPHTHALMIC', 'OTIC', 'NASAL',
  'VAGINAL', 'OTHER',
];

// ==================== WARDS & BEDS ====================

export const createWardSchema = Joi.object<any>({
  name: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string().trim().min(1).max(50).required(),
  capacity: Joi.number().integer().min(1).max(500).required(),
  dailyCost: Joi.number().min(0).required(),
});

export const updateWardSchema = Joi.object<any>({
  name: Joi.string().trim().min(1).max(100).optional(),
  type: Joi.string().trim().min(1).max(50).optional(),
  capacity: Joi.number().integer().min(1).max(500).optional(),
  dailyCost: Joi.number().min(0).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

// EditBedModal.tsx always resends the bed's *current* status verbatim
// (disabled-but-present in the form when the bed is OCCUPIED), even when
// only bedNumber/type is being changed — so OCCUPIED must be an accepted
// value here too, or editing an occupied bed's name/type would be rejected
// outright. The real business rule (can't actually change AWAY from
// OCCUPIED, and can't set anything other than AVAILABLE/MAINTENANCE) is
// already correctly enforced in updateBed() itself.
export const updateBedSchema = Joi.object<any>({
  bedNumber: Joi.string().trim().min(1).max(50).optional(),
  type: Joi.string().trim().max(50).allow('', null).optional(),
  status: Joi.string().valid('AVAILABLE', 'MAINTENANCE', 'OCCUPIED').optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

// ==================== ADMISSIONS ====================

export const admitPatientSchema = Joi.object<any>({
  patientId: Joi.string().uuid().required(),
  bedId: Joi.string().uuid().required(),
  reason: Joi.string().trim().min(1).max(1000).required(),
  notes: Joi.string().trim().max(5000).allow('', null).optional(),
  isolationRequired: Joi.boolean().optional(),
  infectionRisk: Joi.string().trim().max(500).allow('', null).optional(),
  primaryDiagnosisId: Joi.string().uuid().allow(null).optional(),
  admissionType: Joi.string().valid('MEDICAL', 'SURGERY', 'CHILD_BIRTH').optional(),
  showOperationNote: Joi.boolean().optional(),
  showPartograph: Joi.boolean().optional(),
});

export const updateAdmissionSettingsSchema = Joi.object<any>({
  admissionType: Joi.string().valid('MEDICAL', 'SURGERY', 'CHILD_BIRTH').optional(),
  showOperationNote: Joi.boolean().optional(),
  showPartograph: Joi.boolean().optional(),
  showOxygen: Joi.boolean().optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

// DischargeModal.tsx's Duration dropdown (unlike Route/Dosage/Frequency,
// which all have the HTML `required` attribute) has no client-side
// required check, so it can reach the server as an empty string — dosage/
// frequency/duration are validated for type/length but NOT required to be
// non-empty here, matching what the UI actually already permits submitting.
// Only medicationName is truly enforced, matching the client's own filter
// (`prescriptions.filter(p => p.medicationName)`) before submit.
const dischargePrescriptionSchema = Joi.object<any>({
  medicationId: Joi.string().uuid().allow(null).optional(),
  medicationName: Joi.string().trim().min(1).max(200).required(),
  route: Joi.string().valid(...ADMINISTRATION_ROUTES).optional(),
  dosage: Joi.string().trim().max(100).allow('', null).optional(),
  frequency: Joi.string().trim().max(100).allow('', null).optional(),
  duration: Joi.string().trim().max(100).allow('', null).optional(),
  instructions: Joi.string().trim().max(1000).allow('', null).optional(),
  quantity: Joi.number().integer().min(1).optional(),
});

export const dischargePatientSchema = Joi.object<any>({
  notes: Joi.string().trim().max(5000).allow('', null).optional(),
  finalNotes: Joi.string().trim().max(5000).allow('', null).optional(),
  followUpPlan: Joi.string().trim().max(5000).allow('', null).optional(),
  ttoMedications: Joi.any().optional(),
  finalDiagnosisId: Joi.string().uuid().allow(null).optional(),
  prescriptions: Joi.array().items(dischargePrescriptionSchema).max(20).optional(),
});

export const transferPatientSchema = Joi.object<any>({
  toBedId: Joi.string().uuid().required(),
  reason: Joi.string().trim().min(3).max(500).required(),
});

// ==================== WARD ROUNDS & MEDICATIONS ====================

const medicationChangeSchema = Joi.object<any>({
  action: Joi.string().valid('ADD', 'DISCONTINUE').required(),
  prescriptionId: Joi.string().uuid().when('action', { is: 'DISCONTINUE', then: Joi.required(), otherwise: Joi.optional() }),
  medicationId: Joi.string().uuid().allow(null).optional(),
  medicationName: Joi.string().trim().when('action', { is: 'ADD', then: Joi.string().min(1).max(200).required(), otherwise: Joi.string().trim().max(200).allow('', null).optional() }),
  route: Joi.string().valid(...ADMINISTRATION_ROUTES).optional(),
  dosage: Joi.string().trim().max(100).allow('', null).optional(),
  frequency: Joi.string().trim().max(100).allow('', null).optional(),
  duration: Joi.string().trim().max(100).allow('', null).optional(),
  instructions: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const addWardRoundSchema = Joi.object<any>({
  notes: Joi.string().trim().min(1).max(5000).required(),
  plan: Joi.string().trim().max(5000).allow('', null).optional(),
  vitals: Joi.any().optional(),
  medicationChanges: Joi.array().items(medicationChangeSchema).max(20).optional(),
});

export const addMedicationAdministrationSchema = Joi.object<any>({
  medicationName: Joi.string().trim().min(1).max(200).required(),
  dosage: Joi.string().trim().min(1).max(100).required(),
  route: Joi.string().valid(...ADMINISTRATION_ROUTES).optional(),
  notes: Joi.string().trim().max(1000).allow('', null).optional(),
  prescriptionId: Joi.string().uuid().allow(null).optional(),
  status: Joi.string().valid('COMPLETED', 'MISSED', 'REFUSED').optional(),
  omissionReason: Joi.string().trim().max(500).when('status', {
    is: Joi.exist().valid('MISSED', 'REFUSED'),
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null),
  }),
}).messages({
  'any.required': 'An omission reason is required when a dose is missed or refused',
});

// ==================== CHARTS ====================

export const addVitalChartSchema = Joi.object<any>({
  temperature: Joi.number().min(30).max(115).allow(null).optional(),
  systolicBP: Joi.number().integer().min(30).max(300).allow(null).optional(),
  diastolicBP: Joi.number().integer().min(20).max(200).allow(null).optional(),
  bloodPressure: Joi.string().pattern(/^\d{2,3}\/\d{2,3}$/).allow('', null).optional().messages({
    'string.pattern.base': 'Blood pressure must be in format XXX/YYY (e.g., 120/80)',
  }),
  heartRate: Joi.number().integer().min(30).max(250).allow(null).optional(),
  respiratoryRate: Joi.number().integer().min(10).max(100).allow(null).optional(),
  spO2: Joi.number().integer().min(0).max(100).allow(null).optional(),
  painScore: Joi.number().integer().min(0).max(10).allow(null).optional(),
  weight: Joi.number().min(0.5).max(500).allow(null).optional(),
  height: Joi.number().min(20).max(300).allow(null).optional(),
  headCircumference: Joi.number().min(20).max(70).allow(null).optional(),
  muac: Joi.number().min(5).max(50).allow(null).optional(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
});

export const addFluidChartSchema = Joi.object<any>({
  type: Joi.string().valid('INTAKE', 'OUTPUT').required(),
  route: Joi.string().trim().min(1).max(100).required(),
  fluidName: Joi.string().trim().max(200).allow('', null).optional(),
  volumeMl: Joi.number().min(0).max(20000).required(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
});

export const addTransfusionChartSchema = Joi.object<any>({
  bloodGroup: Joi.string().trim().min(1).max(20).required(),
  unitNumber: Joi.string().trim().min(1).max(100).required(),
  productType: Joi.string().trim().min(1).max(100).required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).allow(null).optional().messages({
    'date.greater': 'End time must be after start time',
  }),
  preVitals: Joi.any().optional(),
  duringVitals: Joi.any().optional(),
  postVitals: Joi.any().optional(),
  reaction: Joi.boolean().optional(),
  reactionNotes: Joi.string().trim().max(2000).allow('', null).optional(),
});

export const addBloodSugarChartSchema = Joi.object<any>({
  bloodGlucose: Joi.number().min(0).max(1000).required(),
  unit: Joi.string().valid('mg/dL', 'mmol/L').optional(),
  measurementContext: Joi.string().trim().max(100).allow('', null).optional(),
  insulinGiven: Joi.string().trim().max(200).allow('', null).optional(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
});

// ==================== OPERATION NOTES ====================

// surgicalProcedure/surgeons/plan match OperationNoteTab.tsx's own required
// fields exactly (both an alert() guard and HTML `required` attributes) —
// enforced here too so a direct API call can't skip them.
export const addOperationNoteSchema = Joi.object<any>({
  surgicalProcedure: Joi.string().trim().min(1).max(300).required(),
  indication: Joi.string().trim().max(2000).allow('', null).optional(),
  surgeons: Joi.string().trim().min(1).max(500).required(),
  assistants: Joi.string().trim().max(500).allow('', null).optional(),
  anaesthetics: Joi.string().trim().max(500).allow('', null).optional(),
  anaesthetist: Joi.string().trim().max(200).allow('', null).optional(),
  incision: Joi.string().trim().max(2000).allow('', null).optional(),
  findings: Joi.string().trim().max(5000).allow('', null).optional(),
  procedure: Joi.string().trim().max(5000).allow('', null).optional(),
  plan: Joi.string().trim().min(1).max(5000).required(),
  others: Joi.string().trim().max(2000).allow('', null).optional(),
  operationDate: Joi.date().iso().optional(),
});

// ==================== VOID / CORRECTIONS ====================
// Shared across all six void routes (ward rounds, vitals, fluids,
// transfusions, blood sugar, operation notes) — all take the same body shape.

export const voidRecordSchema = Joi.object<any>({
  reason: Joi.string().trim().min(1).max(500).required().messages({
    'string.empty': 'A reason is required to void a record',
  }),
});
