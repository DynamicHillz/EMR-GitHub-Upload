/**
 * User Validation Schemas
 * Joi validation schemas for user-related operations
 */

import Joi from 'joi';

// Password validation regex
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// Email validation
const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  });

// Password validation
const passwordSchema = Joi.string()
  .min(8)
  .pattern(passwordRegex)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base':
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'any.required': 'Password is required',
  });

// Role validation
const roleSchema = Joi.string()
  .valid('ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECH', 'PHARMACIST', 'CASHIER', 'RECEPTIONIST')
  .required()
  .messages({
    'any.only': 'Invalid role. Must be one of: ADMIN, DOCTOR, NURSE, LAB_TECH, PHARMACIST, CASHIER, RECEPTIONIST',
    'any.required': 'Role is required',
  });

// Status validation
const statusSchema = Joi.string()
  .valid('ACTIVE', 'INACTIVE', 'SUSPENDED')
  .messages({
    'any.only': 'Invalid status. Must be one of: ACTIVE, INACTIVE, SUSPENDED',
  });

/**
 * Login User Validation
 */
export const loginUserSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
  tenantId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Tenant ID must be a valid UUID',
  }),
  rememberMe: Joi.boolean().optional(),
});

/**
 * Change Password Validation
 */
export const changePasswordSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid user ID format',
    'any.required': 'User ID is required',
  }),
  oldPassword: Joi.string().required().messages({
    'any.required': 'Old password is required',
  }),
  newPassword: passwordSchema,
});

/**
 * Forgot Password Validation
 */
export const forgotPasswordSchema = Joi.object({
  email: emailSchema,
  tenantId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid tenant ID format',
    'any.required': 'Tenant ID is required',
  }),
});

/**
 * Reset Password Validation
 */
export const resetPasswordSchema = Joi.object({
  token: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid reset token format',
    'any.required': 'Reset token is required',
  }),
  newPassword: passwordSchema,
});

/**
 * Create User Validation (Admin)
 */
export const createUserSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'First name must be at least 2 characters',
    'string.max': 'First name cannot exceed 50 characters',
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Last name must be at least 2 characters',
    'string.max': 'Last name cannot exceed 50 characters',
    'any.required': 'Last name is required',
  }),
  phone: Joi.string().pattern(/^\+?[0-9]{7,15}$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number',
  }),
  role: roleSchema,
  tenantId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid tenant ID format',
    'any.required': 'Tenant ID is required',
  }),
  sendWelcomeEmail: Joi.boolean().optional(),
});

/**
 * Update User Validation
 */
export const updateUserSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional().messages({
    'string.min': 'First name must be at least 2 characters',
    'string.max': 'First name cannot exceed 50 characters',
  }),
  lastName: Joi.string().min(2).max(50).optional().messages({
    'string.min': 'Last name must be at least 2 characters',
    'string.max': 'Last name cannot exceed 50 characters',
  }),
  phone: Joi.string().pattern(/^\+?[0-9]{7,15}$/).optional().allow(null, '').messages({
    'string.pattern.base': 'Please provide a valid phone number',
  }),
  role: Joi.string()
    .valid('ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECH', 'PHARMACIST', 'CASHIER', 'RECEPTIONIST')
    .optional()
    .messages({
      'any.only': 'Invalid role',
    }),
  status: statusSchema.optional(),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

/**
 * Refresh Token Validation
 */
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

/**
 * Validation helper functions
 */
export const validateLoginUser = (data: any) => loginUserSchema.validate(data);
export const validateForgotPassword = (data: any) => forgotPasswordSchema.validate(data);
export const validateResetPassword = (data: any) => resetPasswordSchema.validate(data);
export const validateCreateUser = (data: any) => createUserSchema.validate(data);
export const validateUpdateUser = (data: any) => updateUserSchema.validate(data);
