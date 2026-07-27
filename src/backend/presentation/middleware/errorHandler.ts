import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';
import { mapPrismaError } from '../../shared/utils/error-message.util';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Maps common error messages to user-friendly messages
 */
const getUserFriendlyMessage = (message: string): string => {
  // Common database errors
  if (message.includes('Unique constraint') || message.includes('unique constraint')) {
    if (message.includes('email')) {
      return 'This email address is already registered. Please use a different email or try logging in.';
    }
    if (message.includes('phone')) {
      return 'This phone number is already registered.';
    }
    return 'This record already exists in the system.';
  }

  // Authentication errors
  if (message.includes('Invalid credentials') || message.includes('incorrect')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (message.includes('token') && message.includes('invalid')) {
    return 'Your session has expired. Please log in again.';
  }
  if (message.includes('Unauthorized') || message.includes('not authorized')) {
    return 'You do not have permission to perform this action.';
  }

  // Validation errors
  if (message.includes('required')) {
    return 'Please fill in all required fields.';
  }
  if (message.includes('invalid format') || message.includes('must be')) {
    return 'Please check that all fields are filled in correctly.';
  }

  // Not found errors
  if (message.includes('not found')) {
    return 'The requested information could not be found.';
  }

  // Connection errors
  if (message.includes('network') || message.includes('ECONNREFUSED')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  // Default: return original message if it's already user-friendly
  return message;
};

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  } else {
    const prismaMapping = mapPrismaError(error);
    if (prismaMapping) {
      statusCode = prismaMapping.statusCode;
      message = prismaMapping.message;
      // Safe to mark operational: these are well-understood, non-sensitive
      // cases (duplicate/missing/related-record), not an unexpected bug —
      // this is what lets the specific message survive prod's masking below.
      isOperational = true;
    }
  }

  // Log error (full technical details)
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    statusCode,
  });

  // Get user-friendly message
  let userMessage = getUserFriendlyMessage(message);

  // Don't leak error details in production for non-operational errors
  if (process.env.NODE_ENV === 'production' && !isOperational) {
    userMessage = 'Something went wrong. Please try again or contact support if the problem persists.';
  }

  // Send user-friendly response
  res.status(statusCode).json({
    success: false,
    message: userMessage,
    ...(process.env.NODE_ENV === 'development' && {
      error: {
        technical: message,
        stack: error.stack,
      },
    }),
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
