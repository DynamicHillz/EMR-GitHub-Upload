/**
 * Patient Input Validators
 *
 * Validates incoming request data before it reaches the use cases.
 * Uses Joi for schema validation.
 */

import Joi from 'joi';

/**
 * Validation schema for creating a patient
 */
export const createPatientSchema = Joi.object<any>({
  id: Joi.string().optional().guid(), // client-generated id for offline registration — see register-patient.use-case.ts
  patientId: Joi.string().optional().trim().max(50),
  firstName: Joi.string().required().trim().min(2).max(100).messages({
    'string.empty': 'First name is required',
    'string.min': 'First name must be at least 2 characters',
  }),
  lastName: Joi.string().required().trim().min(2).max(100).messages({
    'string.empty': 'Last name is required',
    'string.min': 'Last name must be at least 2 characters',
  }),
  dateOfBirth: Joi.date().required().iso().max('now').messages({
    'date.max': 'Date of birth cannot be in the future',
    'any.required': 'Date of birth is required',
  }),
  gender: Joi.string().required().valid('MALE', 'FEMALE', 'OTHER').messages({
    'any.only': 'Gender must be MALE, FEMALE, or OTHER',
  }),
  phone: Joi.string().required().trim().pattern(/^\+?[\d\s\-()]+$/).min(10).max(20).messages({
    'string.pattern.base': 'Phone must be a valid international format',
    'string.min': 'Phone number must be at least 10 characters',
    'string.max': 'Phone number cannot exceed 20 characters',
    'any.required': 'Phone number is required',
  }),
  email: Joi.string().optional().email({ tlds: { allow: false } }).trim().allow('', null).messages({
    'string.email': 'Please provide a valid email address',
  }),
  address: Joi.string().optional().trim().max(500).allow('', null),
  city: Joi.string().optional().trim().max(100).allow('', null),
  state: Joi.string().optional().trim().max(100).allow('', null).messages({
    'string.max': 'State cannot exceed 100 characters',
  }),
  lga: Joi.string().optional().trim().max(100).allow('', null),
  country: Joi.string().optional().trim().max(100).default('Nigeria'),
  nationality: Joi.string().optional().trim().max(100).allow('', null),
  occupation: Joi.string().optional().trim().max(100).allow('', null),
  maritalStatus: Joi.string().optional().valid('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED').allow('', null),
  bloodGroup: Joi.string().optional().valid('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE').allow('', null).messages({
    'any.only': 'Blood group must be one of the valid enum values',
  }),
  genotype: Joi.string().optional().valid('AA', 'AS', 'SS', 'AC', 'SC').allow('', null).messages({
    'any.only': 'Genotype must be one of: AA, AS, SS, AC, SC',
  }),
  allergies: Joi.array().optional().items(Joi.string().trim()).default([]),
  patientAllergies: Joi.array().optional().items(
    Joi.object({
      allergen: Joi.string().required().trim().max(100).messages({'any.required': 'Allergen is required'}),
      reactionType: Joi.string().required().trim().max(100).messages({'any.required': 'Reaction type is required'}),
      severity: Joi.string().required().valid('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING').messages({'any.required': 'Severity is required'}),
      onsetDate: Joi.date().iso().optional().max('now').allow(null),
      notes: Joi.string().optional().trim().max(500).allow('', null)
    })
  ).default([]),
  chronicConditions: Joi.array().optional().items(Joi.string().trim()).default([]),
  pastSurgicalHistory: Joi.string().optional().trim().max(2000).allow('', null),
  // FIXED: emergency contact is now optional
  emergencyContact: Joi.object({
    name: Joi.string().required().trim().min(1).max(100).messages({
      'any.required': 'Emergency contact name is required',
    }),
    relationship: Joi.string().required().trim().max(50),
    phone: Joi.string().required().trim().pattern(/^\+?[\d\s\-()]+$/).min(10).max(20).messages({
      'string.pattern.base': 'Emergency contact phone must be a valid international format',
      'string.min': 'Emergency contact phone must be at least 10 characters',
      'string.max': 'Emergency contact phone cannot exceed 20 characters',
    }),
    address: Joi.string().optional().trim().allow('', null),
  }).optional().allow(null),
  nhisNumber: Joi.string().optional().trim().max(50).allow('', null),
  patientType: Joi.string().optional().valid('PRIVATE', 'HMO').default('PRIVATE'),
  hmoProvider: Joi.string().optional().trim().max(100).allow('', null),
  hmoNumber: Joi.string().optional().trim().max(50).allow('', null),
  photoUrl: Joi.string().optional().uri().trim().allow('', null),
  consentGiven: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must give consent to proceed',
    'any.required': 'Consent is required',
  }),
});

/**
 * Validation schema for updating a patient
 */
export const updatePatientSchema = Joi.object({
  // Expected version for optimistic-concurrency conflict detection. Without
  // this, stripUnknown silently dropped any `version` the client sent,
  // making the whole version-check path (patient.repository.ts, the 409
  // conflict UI in PatientDetailView.tsx) dead on the normal online edit
  // path — it only ever worked via offline-sync replay.
  version: Joi.number().integer().optional(),
  firstName: Joi.string().optional().trim().min(2).max(100),
  lastName: Joi.string().optional().trim().min(2).max(100),
  dateOfBirth: Joi.date().optional().iso().max('now'),
  gender: Joi.string().optional().valid('MALE', 'FEMALE', 'OTHER'),
  phone: Joi.string().optional().trim().pattern(/^\+?[\d\s\-()]+$/).min(10).max(20),
  email: Joi.string().optional().email().trim().allow('', null),
  address: Joi.string().optional().trim().max(500).allow('', null),
  city: Joi.string().optional().trim().max(100).allow('', null),
  state: Joi.string().optional().trim().max(100).allow('', null),
  lga: Joi.string().optional().trim().max(100).allow('', null),
  country: Joi.string().optional().trim().max(100),
  nationality: Joi.string().optional().trim().max(100).allow('', null),
  occupation: Joi.string().optional().trim().max(100).allow('', null),
  maritalStatus: Joi.string().optional().valid('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED').allow('', null),
  bloodGroup: Joi.string().optional().valid('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE').allow('', null),
  genotype: Joi.string().optional().valid('AA', 'AS', 'SS', 'AC', 'SC').allow('', null),
  allergies: Joi.array().optional().items(Joi.string().trim()),
  patientAllergies: Joi.array().optional().items(
    Joi.object({
      id: Joi.string().uuid().optional(),
      allergen: Joi.string().required().trim().max(100),
      reactionType: Joi.string().required().trim().max(100),
      severity: Joi.string().required().valid('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'),
      onsetDate: Joi.date().iso().optional().max('now').allow(null),
      notes: Joi.string().optional().trim().max(500).allow('', null)
    })
  ),
  chronicConditions: Joi.array().optional().items(Joi.string().trim()),
  pastSurgicalHistory: Joi.string().optional().trim().max(2000).allow('', null),
  emergencyContact: Joi.object({
    name: Joi.string().required().trim().min(1).max(100),
    relationship: Joi.string().required().trim().max(50),
    phone: Joi.string().required().trim().pattern(/^\+?[\d\s\-()]+$/).min(10).max(20),
    address: Joi.string().optional().trim().allow('', null),
  }).optional().allow(null),
  nhisNumber: Joi.string().optional().trim().max(50).allow('', null),
  patientType: Joi.string().optional().valid('PRIVATE', 'HMO'),
  hmoProvider: Joi.string().optional().trim().max(100).allow('', null),
  hmoNumber: Joi.string().optional().trim().max(50).allow('', null),
  photoUrl: Joi.string().optional().uri().trim().allow('', null),
}).min(1);

/**
 * Validation schema for patient search
 */
export const patientSearchSchema = Joi.object<any>({
  query: Joi.string().optional().trim().min(1).messages({
    'string.min': 'Search query must be at least 1 character',
  }),
  status: Joi.string().optional().valid('ACTIVE', 'INACTIVE', 'DECEASED', 'ALL').default('ACTIVE'),
  gender: Joi.string().optional().valid('MALE', 'FEMALE', 'OTHER'),
  ageMin: Joi.number().optional().min(0).max(150),
  ageMax: Joi.number().optional().min(0).max(150),
  // The controller actually reads page/limit (not skip/take) — these were
  // previously missing here, so validateRequest's stripUnknown silently
  // dropped them before the controller ever saw them, and every search
  // page request quietly fell back to page 1.
  page: Joi.number().optional().min(1).default(1),
  limit: Joi.number().optional().min(1).max(100).default(20),
  skip: Joi.number().optional().min(0).default(0),
  take: Joi.number().optional().min(1).max(100).default(20),
  lite: Joi.boolean().optional().default(false),
});

/**
 * Helper function to validate data against a schema
 */
export const validate = <T>(schema: Joi.ObjectSchema<T>, data: unknown): T => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => detail.message).join(', ');
    throw new Error(`Validation error: ${errors}`);
  }

  return value;
};