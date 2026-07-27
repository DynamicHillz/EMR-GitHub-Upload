/**
 * Safe Error Message Utility
 *
 * Prevents raw technical errors (Prisma exceptions, unhandled TypeErrors,
 * etc.) from ever reaching the client as a response message. Only errors
 * deliberately thrown with a hand-written, already-human-readable message
 * (any AppError subclass — ValidationError, NotFoundError, ConflictError,
 * ForbiddenError, UnauthorizedError from shared/errors/AppError.ts, or the
 * separate AppError in presentation/middleware/errorHandler.ts — both set
 * `isOperational: true`) are passed through as-is. Anything else — a raw
 * Prisma error, a null-pointer bug, a third-party library throwing whatever
 * it wants — falls back to the caller-supplied, already-friendly message,
 * except for a short list of well-understood Prisma error codes (duplicate/
 * missing/related record) where a slightly more specific message is both
 * safe to reveal and more useful than the generic fallback.
 *
 * Codes reference: https://www.prisma.io/docs/orm/reference/error-reference
 */
const PRISMA_ERROR_MAP: Record<string, { statusCode: number; message: string }> = {
  P2002: { statusCode: 409, message: 'A record with this value already exists.' },
  P2025: { statusCode: 404, message: 'The requested record could not be found.' },
  P2003: { statusCode: 409, message: 'This action refers to a related record that does not exist.' },
  P2014: { statusCode: 409, message: 'This action would violate a required relationship between records.' },
};

export function mapPrismaError(error: unknown): { statusCode: number; message: string } | null {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' && PRISMA_ERROR_MAP[code]) {
    return PRISMA_ERROR_MAP[code];
  }
  return null;
}

export function getSafeErrorMessage(error: unknown, fallback: string): string {
  const err = error as { isOperational?: boolean; message?: unknown };
  if (err?.isOperational === true && typeof err.message === 'string') {
    return err.message;
  }
  return mapPrismaError(error)?.message ?? fallback;
}
