/**
 * Labor Validators
 *
 * Joi validation schemas for the labor module — previously had none at all
 * (no Joi, no validateRequest), same gap as the inpatient module before it
 * was fixed. Ranges/enums mirror the actual Dropdown options and Prisma
 * schema comments in LaborRecord/PartographObservation exactly.
 */

import Joi from 'joi';

export const startLaborSchema = Joi.object<any>({
  laborOnsetAt: Joi.date().iso().optional(),
  onsetType: Joi.string().valid('SPONTANEOUS', 'INDUCED', 'AUGMENTED').optional(),
  romAt: Joi.date().iso().optional(),
  romType: Joi.string().valid('SPONTANEOUS', 'ARTIFICIAL').optional(),
  liquorAtRom: Joi.string().valid('CLEAR', 'MECONIUM_STAINED', 'BLOOD_STAINED').optional(),
  pregnancyId: Joi.string().uuid().optional(),
});

export const recordObservationSchema = Joi.object<any>({
  recordedAt: Joi.date().iso().optional(),
  cervicalDilation: Joi.number().integer().min(0).max(10).allow(null).optional(),
  fetalHeartRate: Joi.number().integer().min(0).max(300).allow(null).optional(),
  descentOfHead: Joi.string().trim().max(20).allow('', null).optional(),
  liquor: Joi.string().valid('CLEAR', 'MECONIUM_LIGHT', 'MECONIUM_THICK', 'BLOOD_STAINED', 'ABSENT').allow('', null).optional(),
  moulding: Joi.string().valid('0', '+1', '+2', '+3').allow('', null).optional(),
  contractionsFrequencyPer10Min: Joi.number().integer().min(0).max(20).allow(null).optional(),
  contractionsDurationSeconds: Joi.number().integer().min(0).max(600).allow(null).optional(),
  maternalPulse: Joi.number().integer().min(0).max(300).allow(null).optional(),
  maternalSystolicBP: Joi.number().integer().min(0).max(300).allow(null).optional(),
  maternalDiastolicBP: Joi.number().integer().min(0).max(200).allow(null).optional(),
  maternalTemperature: Joi.number().min(30).max(115).allow(null).optional(),
  urineProtein: Joi.string().valid('NEGATIVE', 'TRACE', '1+', '2+', '3+').allow('', null).optional(),
  urineAcetone: Joi.string().valid('NEGATIVE', 'TRACE', '1+', '2+', '3+').allow('', null).optional(),
  urineVolumeMl: Joi.number().min(0).max(5000).allow(null).optional(),
  oxytocinDose: Joi.string().trim().max(100).allow('', null).optional(),
  drugsGiven: Joi.string().trim().max(500).allow('', null).optional(),
  ivFluids: Joi.string().trim().max(500).allow('', null).optional(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
});

// modeOfDelivery/babyOutcome match the frontend Dropdowns exactly — both
// have `required` HTML attributes and no empty placeholder option, so a
// legitimate submission always carries a real value for both.
export const recordDeliveryOutcomeSchema = Joi.object<any>({
  deliveredAt: Joi.date().iso().optional(),
  modeOfDelivery: Joi.string().valid('SVD', 'ASSISTED_VACUUM', 'ASSISTED_FORCEPS', 'CESAREAN_SECTION', 'BREECH').required(),
  perineumStatus: Joi.string().valid('INTACT', 'EPISIOTOMY', 'FIRST_DEGREE_TEAR', 'SECOND_DEGREE_TEAR', 'THIRD_DEGREE_TEAR', 'FOURTH_DEGREE_TEAR').allow('', null).optional(),
  estimatedBloodLossMl: Joi.number().min(0).max(10000).allow(null).optional(),
  babyOutcome: Joi.string().valid('LIVE_BIRTH', 'STILLBIRTH_FRESH', 'STILLBIRTH_MACERATED').required(),
  babySex: Joi.string().valid('MALE', 'FEMALE').allow('', null).optional(),
  babyBirthWeightGrams: Joi.number().integer().min(0).max(10000).allow(null).optional(),
  apgarScore1Min: Joi.number().integer().min(0).max(10).allow(null).optional(),
  apgarScore5Min: Joi.number().integer().min(0).max(10).allow(null).optional(),
  resuscitationRequired: Joi.boolean().optional(),
  deliveryNotes: Joi.string().trim().max(2000).allow('', null).optional(),
  // Defaults to true on a live birth in the use-case — only meaningful to send false.
  registerNewbornAsPatient: Joi.boolean().optional(),
});

export const discontinueLaborSchema = Joi.object<any>({
  status: Joi.string().valid('TRANSFERRED', 'DISCONTINUED').required(),
  reason: Joi.string().trim().min(1).max(2000).required(),
});
