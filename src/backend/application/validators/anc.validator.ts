/**
 * ANC (Antenatal Care) Validators
 *
 * Joi validation schemas for the ANC module — previously had none at all
 * (anc.controller.ts does raw Prisma calls straight from req.body with no
 * Joi and no manual checks). Enums/ranges mirror the actual frontend
 * Dropdown options and Prisma schema comments exactly.
 */

import Joi from 'joi';

const BLOOD_GROUPS = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'UNKNOWN'];

export const createPregnancySchema = Joi.object<any>({
  gravidity: Joi.number().integer().min(1).max(30).required(),
  parity: Joi.number().integer().min(0).max(30).required(),
  lmp: Joi.date().iso().allow(null).optional(),
  edd: Joi.date().iso().allow(null).optional(),
  bloodGroup: Joi.string().valid(...BLOOD_GROUPS).allow('', null).optional(),
  husbandBloodGroup: Joi.string().valid(...BLOOD_GROUPS).allow('', null).optional(),
  livingChildren: Joi.number().integer().min(0).max(30).optional(),
  abortionsMiscarriages: Joi.number().integer().min(0).max(30).optional(),
  historyOfCSection: Joi.boolean().optional(),
  historyOfPPH: Joi.boolean().optional(),
  historyOfPreEclampsia: Joi.boolean().optional(),
  historyOfStillbirth: Joi.boolean().optional(),
  preExistingDiabetes: Joi.boolean().optional(),
  preExistingHypertension: Joi.boolean().optional(),
  cardiacDisease: Joi.boolean().optional(),
  multipleGestation: Joi.boolean().optional(),
});

export const updatePregnancyStatusSchema = Joi.object<any>({
  isActive: Joi.boolean().optional(),
  outcome: Joi.string().trim().max(100).allow('', null).optional(),
  deliveryDate: Joi.date().iso().allow(null).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

export const createAncVisitSchema = Joi.object<any>({
  gestationalAgeWeeks: Joi.number().integer().min(1).max(45).allow(null).optional(),
  weight: Joi.number().min(20).max(300).allow(null).optional(),
  systolicBP: Joi.number().integer().min(30).max(300).allow(null).optional(),
  diastolicBP: Joi.number().integer().min(20).max(200).allow(null).optional(),
  fundalHeight: Joi.number().min(0).max(60).allow(null).optional(),
  fetalHeartRate: Joi.number().integer().min(0).max(300).allow(null).optional(),
  presentation: Joi.string().valid('CEPHALIC', 'BREECH', 'TRANSVERSE', 'UNKNOWN').allow('', null).optional(),
  urineProtein: Joi.string().valid('NEGATIVE', 'TRACE', '1+', '2+', '3+').allow('', null).optional(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
  others: Joi.string().trim().max(2000).allow('', null).optional(),
  ironFolicAcidProvided: Joi.boolean().optional(),
  calciumProvided: Joi.boolean().optional(),
  itnProvided: Joi.boolean().optional(),
  iptpDose: Joi.number().integer().min(1).max(5).allow(null).optional(),
  syphilisTestResult: Joi.string().valid('POSITIVE', 'NEGATIVE').allow('', null).optional(),
  hivTestResult: Joi.string().valid('POSITIVE', 'NEGATIVE', 'KNOWN_POSITIVE').allow('', null).optional(),
  hepBTestResult: Joi.string().valid('POSITIVE', 'NEGATIVE').allow('', null).optional(),
  malariaRdtResult: Joi.string().valid('POSITIVE', 'NEGATIVE').allow('', null).optional(),
  ultrasoundDone: Joi.boolean().optional(),
  counselingDone: Joi.boolean().optional(),
  ttDosesToDate: Joi.number().integer().min(0).max(5).allow(null).optional(),
  ttDoseGivenToday: Joi.boolean().optional(),
  dewormingProvided: Joi.boolean().optional(),
  counseledOnDangerSigns: Joi.boolean().optional(),
  birthPreparednessPlanDiscussed: Joi.boolean().optional(),
  intimatePartnerViolenceScreening: Joi.boolean().optional(),
});
