/**
 * Postnatal Validators
 *
 * Joi validation schemas for the postnatal (PNC) module — mirrors
 * labor.validator.ts's conventions exactly.
 */

import Joi from 'joi';

export const recordPostnatalVisitSchema = Joi.object<any>({
  pregnancyId: Joi.string().uuid().optional(),
  appointmentId: Joi.string().uuid().optional(),
  contactType: Joi.string().valid('PNC_24H', 'PNC_DAY3', 'PNC_WEEK1', 'PNC_WEEK6', 'OTHER').required(),
  visitDate: Joi.date().iso().optional(),
  maternalTemperature: Joi.number().min(30).max(115).allow(null).optional(),
  maternalSystolicBP: Joi.number().integer().min(0).max(300).allow(null).optional(),
  maternalDiastolicBP: Joi.number().integer().min(0).max(200).allow(null).optional(),
  lochiaStatus: Joi.string().valid('NORMAL', 'HEAVY', 'OFFENSIVE').allow('', null).optional(),
  uterineInvolutionNormal: Joi.boolean().allow(null).optional(),
  perinealWoundStatus: Joi.string().valid('NORMAL', 'INTACT', 'INFECTED', 'BREAKDOWN').allow('', null).optional(),
  breastfeedingStatus: Joi.string().valid('EXCLUSIVE', 'MIXED', 'NOT_BREASTFEEDING').allow('', null).optional(),
  moodScreeningConcern: Joi.boolean().allow(null).optional(),
  newbornWeightGrams: Joi.number().integer().min(0).max(10000).allow(null).optional(),
  newbornTemperature: Joi.number().min(30).max(115).allow(null).optional(),
  newbornFeedingWell: Joi.boolean().allow(null).optional(),
  cordConditionNormal: Joi.boolean().allow(null).optional(),
  jaundiceObserved: Joi.boolean().allow(null).optional(),
  newbornDangerSigns: Joi.array().items(Joi.string().trim().max(200)).optional(),
  familyPlanningCounselingDone: Joi.boolean().allow(null).optional(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
});
