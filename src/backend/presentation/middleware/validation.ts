/**
 * Validation Middleware
 *
 * Validates incoming requests against Joi schemas
 * Supports body, query, and params validation
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

type ValidationSource = 'body' | 'query' | 'params';

/**
 * Validates request data against a Joi schema
 * @param schema - Joi validation schema
 * @param source - Which part of the request to validate ('body', 'query', 'params')
 * @returns Express middleware function
 */
export const validateRequest = (schema: Joi.Schema, source: ValidationSource = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get the data to validate based on source
    const dataToValidate = req[source];

    // Validate using Joi
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      // Format validation errors
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Replace the request data with validated (and potentially modified) value
    req[source] = value;

    next();
  };
};
