/**
 * Lab Validators
 *
 * Joi validation schemas for the laboratory module — previously had none at
 * all (lab.routes.ts had no validateRequest anywhere). Category/specimen
 * options mirror LabTestFormModal.tsx/LabTestDetailsModal.tsx's actual
 * Dropdown options exactly.
 */

import Joi from 'joi';

const LAB_TEST_CATEGORIES = ['Hematology', 'Chemistry', 'Serology', 'Microbiology', 'Hormone', 'Pathology', 'Immunology', 'Other'];

const labParameterSchema = Joi.object<any>({
  id: Joi.string().optional(),
  name: Joi.string().trim().min(1).max(200).required(),
  unit: Joi.string().trim().max(50).allow('', null).optional(),
  refRangeMale: Joi.string().trim().max(100).allow('', null).optional(),
  refRangeFemale: Joi.string().trim().max(100).allow('', null).optional(),
  displayOrder: Joi.number().integer().min(0).optional(),
});

export const createLabDictionaryItemSchema = Joi.object<any>({
  name: Joi.string().trim().min(1).max(200).required(),
  category: Joi.string().valid(...LAB_TEST_CATEGORIES).required(),
  price: Joi.number().min(0).optional(),
  isActive: Joi.boolean().optional(),
  parameters: Joi.array().items(labParameterSchema).max(50).optional(),
});

export const updateLabDictionaryItemSchema = Joi.object<any>({
  name: Joi.string().trim().min(1).max(200).optional(),
  category: Joi.string().valid(...LAB_TEST_CATEGORIES).optional(),
  price: Joi.number().min(0).optional(),
  isActive: Joi.boolean().optional(),
  parameters: Joi.array().items(labParameterSchema).max(50).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

export const updateLabTestStatusSchema = Joi.object<any>({
  status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'CANCELLED', 'REJECTED').required(),
});

const labResultItemSchema = Joi.object<any>({
  parameter: Joi.string().trim().min(1).max(200).required(),
  value: Joi.string().trim().max(500).allow('').required(),
  unit: Joi.string().trim().max(50).allow('', null).optional(),
  referenceMin: Joi.number().optional(),
  referenceMax: Joi.number().optional(),
  referenceRange: Joi.string().trim().max(200).allow('', null).optional(),
  jsonValue: Joi.any().optional(),
});

export const submitLabResultsSchema = Joi.object<any>({
  results: Joi.array().items(labResultItemSchema).min(1).required(),
  resultNotes: Joi.string().trim().max(2000).allow('', null).optional(),
});

export const reviewLabResultsSchema = Joi.object<any>({
  approved: Joi.boolean().required(),
  reviewNotes: Joi.string().trim().max(2000).allow('', null).optional(),
});

export const updateSpecimenDetailsSchema = Joi.object<any>({
  specimenType: Joi.string().trim().max(100).allow('', null).optional(),
  specimenQuality: Joi.string().valid('GOOD', 'ACCEPTABLE', 'POOR', 'REJECTED').allow('', null).optional(),
  collectedAt: Joi.date().iso().optional(),
  rejectionReason: Joi.string().trim().max(1000).allow('', null).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });
