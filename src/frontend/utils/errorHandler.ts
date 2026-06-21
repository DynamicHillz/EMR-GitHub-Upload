/**
 * Frontend Error Handling Utilities
 *
 * Provides user-friendly error messages for common errors
 */

/**
 * Extracts a user-friendly error message from an error object
 * @param error - The error object from API call or other source
 * @param defaultMessage - Fallback message if no specific message found
 * @returns User-friendly error message
 */
export const getErrorMessage = (error: any, defaultMessage: string = 'An error occurred. Please try again.'): string => {
  // Check for backend error response (axios format)
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  // Check for error message property
  if (error.message) {
    // Filter out technical/code-related messages
    if (shouldShowMessage(error.message)) {
      return error.message;
    }
  }

  // Check for network errors
  if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  // Check for timeout errors
  if (error.code === 'ECONNREFUSED' || error.message?.includes('timeout')) {
    return 'The request took too long. Please try again.';
  }

  // Return default message
  return defaultMessage;
};

/**
 * Determines if an error message is user-friendly enough to display
 * @param message - The error message to check
 * @returns true if message should be shown to user
 */
const shouldShowMessage = (message: string): boolean => {
  // Don't show messages that look like code/stack traces
  if (message.includes('at ') && message.includes('(')) {
    return false;
  }

  // Don't show messages with technical file paths
  if (message.includes('/') && message.includes('.ts')) {
    return false;
  }

  // Don't show messages with technical error codes that aren't user-friendly
  if (/^[A-Z_]+$/.test(message)) {
    return false;
  }

  return true;
};

/**
 * Maps HTTP status codes to user-friendly messages
 * @param statusCode - HTTP status code
 * @returns User-friendly message for the status code
 */
export const getStatusMessage = (statusCode: number): string => {
  switch (statusCode) {
    case 400:
      return 'The request contains invalid data. Please check your input.';
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested information could not be found.';
    case 409:
      return 'This record already exists or conflicts with existing data.';
    case 422:
      return 'Please check that all fields are filled in correctly.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'A server error occurred. Please try again later.';
    case 502:
    case 503:
      return 'The server is currently unavailable. Please try again later.';
    case 504:
      return 'The request took too long. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

/**
 * Formats validation errors from the backend
 * @param error - Error object potentially containing validation errors
 * @returns Formatted error message
 */
export const formatValidationErrors = (error: any): string => {
  // Check for validation errors array
  if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
    return error.response.data.errors.join(', ');
  }

  // Check for single validation error
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  // Fallback to general error message
  return getErrorMessage(error, 'Please check your input and try again.');
};

/**
 * Creates a user-friendly error object for display
 * @param error - The original error
 * @param context - Additional context about where the error occurred
 * @returns Formatted error object
 */
export interface UserError {
  message: string;
  title?: string;
  canRetry?: boolean;
  statusCode?: number;
}

export const createUserError = (
  error: any,
  context?: string,
  defaultMessage?: string
): UserError => {
  const statusCode = error.response?.status;
  const message = statusCode
    ? getStatusMessage(statusCode)
    : getErrorMessage(error, defaultMessage);

  let title = 'Error';
  let canRetry = true;

  // Customize based on status code
  if (statusCode) {
    if (statusCode === 401) {
      title = 'Session Expired';
      canRetry = false;
    } else if (statusCode === 403) {
      title = 'Access Denied';
      canRetry = false;
    } else if (statusCode === 404) {
      title = 'Not Found';
      canRetry = false;
    } else if (statusCode >= 500) {
      title = 'Server Error';
    } else if (statusCode === 422) {
      title = 'Validation Error';
    }
  }

  // Add context if provided
  const finalMessage = context ? `${context}: ${message}` : message;

  return {
    message: finalMessage,
    title,
    canRetry,
    statusCode,
  };
};
