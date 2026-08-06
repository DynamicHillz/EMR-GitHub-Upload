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
    'number.min': 'Pulse rate must be at least 30 bpm',
    'number.max': 'Pulse rate cannot exceed 250 bpm',
  }),

  temperature: Joi.number().optional().min(30).max(115).allow(null).messages({
    'number.min': 'Temperature must be at least 30',
    'number.max': 'Temperature cannot exceed 115',
  }),

  weight: Joi.number().optional().min(0.5).max(500).allow(null).messages({
    'number.min': 'Weight must be at least 0.5 kg',
    'number.max': 'Weight cannot exceed 500 kg',
  }),

  height: Joi.number().optional().min(20).max(300).allow(null).messages({
    'number.min': 'Height must be at least 20 cm',
    'number.max': 'Height cannot exceed 300 cm',
  }),

  respiratoryRate: Joi.number().optional().min(10).max(100).allow(null).messages({
    'number.min': 'Respiratory rate must be at least 10 bpm',
    'number.max': 'Respiratory rate cannot exceed 100 bpm',
  }),

  headCircumference: Joi.number().optional().min(20).max(70).allow(null).messages({
    'number.min': 'Head circumference must be at least 20 cm',
    'number.max': 'Head circumference cannot exceed 70 cm',
  }),

  muac: Joi.number().optional().min(5).max(50).allow(null).messages({
    'number.min': 'MUAC must be at least 5 cm',
    'number.max': 'MUAC cannot exceed 50 cm',
  }),

  spO2: Joi.number().optional().min(0).max(100).integer().allow(null).messages({
    'number.min': 'SpO2 must be at least 0%',
    'number.max': 'SpO2 cannot exceed 100%',
    'number.integer': 'SpO2 must be a whole number',
  }),

  // Diagnoses
  diagnoses: Joi.array()
    .optional()
    .items(
      Joi.object({
        diagnosisId: Joi.string().required(),
        code: Joi.string().optional().allow('', null),
        name: Joi.string().optional().allow('', null),
        type: Joi.string().optional().allow('', null),
        isPrimary: Joi.boolean().default(false),
        certainty: Joi.string().valid('CONFIRMED', 'PRESUMPTIVE', 'DIFFERENTIAL').default('CONFIRMED').optional(),
        notes: Joi.string().max(200).allow('', null).optional()
      })
    )
    .max(10)
    .allow(null)
    .messages({
      'array.max': 'Cannot add more than 10 diagnoses',
    }),
  
  icd10Codes: Joi.array().items(Joi.string()).optional().allow(null),
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
  temperature: Joi.number().optional().min(30).max(115).allow(null),
  weight: Joi.number().optional().min(0.5).max(500).allow(null),
  height: Joi.number().optional().min(20).max(300).allow(null),
  respiratoryRate: Joi.number().optional().min(10).max(100).allow(null),
  headCircumference: Joi.number().optional().min(20).max(70).allow(null),
  muac: Joi.number().optional().min(5).max(50).allow(null),
  spO2: Joi.number().optional().min(0).max(100).integer().allow(null),

  // Diagnoses
  diagnoses: Joi.array()
    .optional()
    .items(
      Joi.object({
        diagnosisId: Joi.string().required(),
        code: Joi.string().optional().allow('', null),
        name: Joi.string().optional().allow('', null),
        type: Joi.string().optional().allow('', null),
        isPrimary: Joi.boolean().default(false),
        certainty: Joi.string().valid('CONFIRMED', 'PRESUMPTIVE', 'DIFFERENTIAL').default('CONFIRMED').optional(),
        notes: Joi.string().max(200).allow('', null).optional()
      })
    )
    .max(10)
    .allow(null),
  
  icd10Codes: Joi.array().items(Joi.string()).optional().allow(null),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

/**
 * Validator for creating a prescription from a consultation
 * (consultationId comes from the URL param, not the body)
 */
export const createPrescriptionSchema = Joi.object<any>({
  patientId: Joi.string().uuid().required().messages({
    'string.empty': 'Patient ID is required',
    'string.guid': 'Patient ID must be a valid UUID',
  }),

  admissionId: Joi.string().uuid().allow(null).optional(),
  ancVisitId: Joi.string().uuid().allow(null).optional(),
  type: Joi.string().valid('OUTPATIENT', 'INPATIENT', 'ANC').optional(),

  medicationId: Joi.string().uuid().allow(null).optional(),
  medicationName: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'Medication name is required',
  }),
  route: Joi.string()
    .valid(
      'ORAL', 'INTRAVENOUS', 'INTRAMUSCULAR', 'SUBCUTANEOUS', 'TOPICAL',
      'RECTAL', 'SUBLINGUAL', 'INHALATION', 'OPHTHALMIC', 'OTIC', 'NASAL',
      'VAGINAL', 'OTHER'
    )
    .required()
    .messages({
      'any.only': 'Invalid administration route',
      'string.empty': 'Route is required',
    }),
  dosage: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Dosage is required',
  }),
  frequency: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Frequency is required',
  }),
  duration: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Duration is required',
  }),
  instructions: Joi.string().max(1000).allow('', null).optional(),
  quantity: Joi.number().integer().min(1).allow(null).optional(),
  isControlledSubstance: Joi.boolean().optional(),
  dispenseRationale: Joi.string().max(500).allow('', null).optional(),
});

/**
 * Validator for ordering a lab test from a consultation
 * (consultationId comes from the URL param, not the body)
 */
export const orderLabTestSchema = Joi.object<any>({
  patientId: Joi.string().uuid().required().messages({
    'string.empty': 'Patient ID is required',
    'string.guid': 'Patient ID must be a valid UUID',
  }),

  admissionId: Joi.string().uuid().allow(null).optional(),
  testId: Joi.string().uuid().allow(null).optional(),
  testName: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'Test name is required',
  }),
  testCode: Joi.string().allow('', null).optional(),
  clinicalIndication: Joi.string().max(1000).allow('', null).optional(),
  urgency: Joi.string().valid('ROUTINE', 'URGENT', 'STAT').optional(),
  specimenType: Joi.string().allow('', null).optional(),
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
