/**
 * Consultation Validators
 *
 * Joi validation schemas for consultation operations
 */

import Joi from 'joi';

/**
 * Validator for creating a new consultation
 */
export const createConsultationSchema = Joi.object<any>({
  patientId: Joi.string().uuid().required().messages({
    'string.empty': 'Patient ID is required',
    'string.guid': 'Patient ID must be a valid UUID',
  }),

  doctorId: Joi.string().uuid().required().messages({
    'string.empty': 'Doctor ID is required',
    'string.guid': 'Doctor ID must be a valid UUID',
  }),

  // SOAP Notes - all optional but should be trimmed
  subjective: Joi.string().optional().max(5000).trim().allow('', null).messages({
    'string.max': 'Subjective notes cannot exceed 5000 characters',
  }),

  objective: Joi.string().optional().max(5000).trim().allow('', null).messages({
    'string.max': 'Objective notes cannot exceed 5000 characters',
  }),

  assessment: Joi.string().optional().max(5000).trim().allow('', null).messages({
    'string.max': 'Assessment notes cannot exceed 5000 characters',
  }),

  plan: Joi.string().optional().max(5000).trim().allow('', null).messages({
    'string.max': 'Plan notes cannot exceed 5000 characters',
  }),

  // Vital Signs with specific ranges
  bloodPressure: Joi.string()
    .optional()
    .pattern(/^\d{2,3}\/\d{2,3}$/)
    .allow('', null)
    .messages({
      'string.pattern.base': 'Blood pressure must be in format XXX/YYY (e.g., 120/80)',
    }),

  heartRate: Joi.number().optional().min(30).max(250).allow(null).messages({
    'number.min': 'Heart rate must be at least 30 bpm',
    'number.max': 'Heart rate cannot exceed 250 bpm',
  }),

  temperature: Joi.number().optional().min(30).max(45).allow(null).messages({
    'number.min': 'Temperature must be at least 30°C',
    'number.max': 'Temperature cannot exceed 45°C',
  }),

  weight: Joi.number().optional().min(0.5).max(500).allow(null).messages({
    'number.min': 'Weight must be at least 0.5 kg',
    'number.max': 'Weight cannot exceed 500 kg',
  }),

  height: Joi.number().optional().min(20).max(300).allow(null).messages({
    'number.min': 'Height must be at least 20 cm',
    'number.max': 'Height cannot exceed 300 cm',
  }),

  spO2: Joi.number().optional().min(0).max(100).integer().allow(null).messages({
    'number.min': 'SpO2 must be at least 0%',
    'number.max': 'SpO2 cannot exceed 100%',
    'number.integer': 'SpO2 must be a whole number',
  }),

  // ICD-10 Codes
  icd10Codes: Joi.array()
    .optional()
    .items(Joi.string().trim().max(20))
    .max(10)
    .allow(null)
    .messages({
      'array.max': 'Cannot add more than 10 ICD-10 codes',
      'string.max': 'Each ICD-10 code cannot exceed 20 characters',
    }),
});

/**
 * Validator for updating a consultation
 * Similar to create but all fields are optional
 */
export const updateConsultationSchema = Joi.object<any>({
  // SOAP Notes
  subjective: Joi.string().optional().max(5000).trim().allow('', null),
  objective: Joi.string().optional().max(5000).trim().allow('', null),
  assessment: Joi.string().optional().max(5000).trim().allow('', null),
  plan: Joi.string().optional().max(5000).trim().allow('', null),

  // Vital Signs
  bloodPressure: Joi.string()
    .optional()
    .pattern(/^\d{2,3}\/\d{2,3}$/)
    .allow('', null)
    .messages({
      'string.pattern.base': 'Blood pressure must be in format XXX/YYY (e.g., 120/80)',
    }),

  heartRate: Joi.number().optional().min(30).max(250).allow(null),
  temperature: Joi.number().optional().min(30).max(45).allow(null),
  weight: Joi.number().optional().min(0.5).max(500).allow(null),
  height: Joi.number().optional().min(20).max(300).allow(null),
  spO2: Joi.number().optional().min(0).max(100).integer().allow(null),

  // ICD-10 Codes
  icd10Codes: Joi.array()
    .optional()
    .items(Joi.string().trim().max(20))
    .max(10)
    .allow(null),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

/**
 * Validator for consultation query parameters
 */
export const getConsultationsSchema = Joi.object<any>({
  patientId: Joi.string().uuid().optional(),
  doctorId: Joi.string().uuid().optional(),
  status: Joi.string().optional().valid('DRAFT', 'FINALIZED', 'LOCKED'),
  skip: Joi.number().optional().min(0).integer().default(0),
  take: Joi.number().optional().min(1).max(100).integer().default(20),
});
