/**
 * Triage Input Validators
 *
 * Previously triage.routes.ts had no request validation at all — req.body
 * flowed straight into triage.service.ts's create/update calls, so an
 * out-of-range vital (e.g. spO2: 150, painScore: -5) reached the DB
 * unvalidated, and a bad/invalid category enum value only surfaced as a
 * generic Prisma error.
 */

import Joi from 'joi';

const CONSCIOUSNESS_LEVELS = ['Alert', 'Voice', 'Pain', 'Unresponsive'];

// Vitals bounds are deliberately generous (not tight clinical alarm
// thresholds — those live in triageAcuity.ts) — this is a data-sanity net,
// not a second copy of the danger-sign logic.
const vitalsSchema = {
  systolicBP: Joi.number().integer().min(0).max(300).optional(),
  diastolicBP: Joi.number().integer().min(0).max(200).optional(),
  heartRate: Joi.number().integer().min(0).max(300).optional(),
  temperature: Joi.number().min(20).max(45).optional(), // Celsius
  respiratoryRate: Joi.number().integer().min(0).max(100).optional(),
  spO2: Joi.number().integer().min(0).max(100).optional(),
  weight: Joi.number().min(0).max(500).optional(), // kg
  painScore: Joi.number().integer().min(0).max(10).optional(),
  glucoseLevel: Joi.number().min(0).max(1000).optional(), // unit varies by device (mmol/L or mg/dL)
  consciousnessLevel: Joi.string().valid(...CONSCIOUSNESS_LEVELS).optional(),
  muac: Joi.number().min(0).max(60).optional(), // cm
  isDehydrated: Joi.boolean().optional(),
};

export const createTriageSchema = Joi.object({
  // Client-generated id for offline registration — see triage.service.ts's
  // createTriageRecord and sync.controller.ts's applyCreate.
  id: Joi.string().guid().optional(),
  patientId: Joi.string().guid().required(),
  appointmentId: Joi.string().guid().optional().allow(null),
  chiefComplaint: Joi.string().trim().min(1).max(1000).required(),
  category: Joi.string()
    .valid('RESUSCITATION', 'EMERGENT', 'URGENT', 'SEMI_URGENT', 'NON_URGENT', 'EMERGENCY', 'PRIORITY', 'QUEUE', 'DEAD')
    .required(),
  ...vitalsSchema,
});

export const updateTriageSchema = Joi.object({
  category: Joi.string()
    .valid('RESUSCITATION', 'EMERGENT', 'URGENT', 'SEMI_URGENT', 'NON_URGENT', 'EMERGENCY', 'PRIORITY', 'QUEUE', 'DEAD')
    .optional(),
  dispositionNotes: Joi.string().trim().max(2000).optional().allow('', null),
  // Expected version for optimistic-concurrency conflict detection.
  version: Joi.number().integer().optional(),
  ...vitalsSchema,
}).min(1);
