/**
 * Worklist Dismissal Validators
 */

import Joi from 'joi';

export const dismissImmunizationDueSchema = Joi.object<any>({
  reason: Joi.string().valid('GIVEN_ELSEWHERE', 'DECLINED', 'TRANSFERRED_OUT', 'DECEASED', 'OTHER').required(),
  reasonNotes: Joi.string().trim().max(500).allow('', null).optional(),
});

export const dismissPostnatalDueSchema = Joi.object<any>({
  pregnancyId: Joi.string().uuid().optional(),
  contactType: Joi.string().valid('PNC_24H', 'PNC_DAY3', 'PNC_WEEK1', 'PNC_WEEK6', 'OTHER').required(),
  reason: Joi.string().valid('GIVEN_ELSEWHERE', 'DECLINED', 'TRANSFERRED_OUT', 'DECEASED', 'OTHER').required(),
  reasonNotes: Joi.string().trim().max(500).allow('', null).optional(),
});
