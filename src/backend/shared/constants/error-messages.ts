/**
 * Error Messages
 *
 * Centralized error message constants for consistency.
 */

export const ERROR_MESSAGES = {
  // Authentication & Authorization
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'Insufficient permissions',
    TOKEN_EXPIRED: 'Authentication token has expired',
    TOKEN_INVALID: 'Invalid authentication token',
    SESSION_EXPIRED: 'Your session has expired. Please login again.',
  },

  // Validation
  VALIDATION: {
    REQUIRED_FIELD: (field: string) => `${field} is required`,
    INVALID_FORMAT: (field: string) => `Invalid ${field} format`,
    MIN_LENGTH: (field: string, min: number) => `${field} must be at least ${min} characters`,
    MAX_LENGTH: (field: string, max: number) => `${field} must not exceed ${max} characters`,
    INVALID_EMAIL: 'Invalid email address',
    INVALID_PHONE: 'Invalid phone number',
    INVALID_DATE: 'Invalid date format',
    FUTURE_DATE_NOT_ALLOWED: 'Future dates are not allowed',
  },

  // Patient
  PATIENT: {
    NOT_FOUND: 'Patient not found',
    ALREADY_EXISTS: 'Patient with this number already exists',
    INVALID_PATIENT_NUMBER: 'Invalid patient number',
  },

  // Appointment
  APPOINTMENT: {
    NOT_FOUND: 'Appointment not found',
    SLOT_NOT_AVAILABLE: 'This time slot is not available',
    PAST_DATE: 'Cannot book appointment in the past',
  },

  // User
  USER: {
    NOT_FOUND: 'User not found',
    ALREADY_EXISTS: 'User with this email already exists',
    INVALID_PASSWORD: 'Password does not meet requirements',
  },

  // Database
  DATABASE: {
    CONNECTION_ERROR: 'Database connection error',
    QUERY_ERROR: 'Database query error',
    CONSTRAINT_VIOLATION: 'Database constraint violation',
  },

  // Generic
  GENERIC: {
    NOT_FOUND: 'Resource not found',
    INTERNAL_ERROR: 'An internal error occurred',
    BAD_REQUEST: 'Bad request',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  },
} as const;
