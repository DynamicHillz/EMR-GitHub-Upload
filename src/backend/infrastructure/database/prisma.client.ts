/**
 * Prisma Client Singleton
 *
 * Provides a single instance of Prisma Client throughout the application.
 * This prevents multiple instances and connection pool exhaustion.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

// Log database queries in development
if (process.env.NODE_ENV === 'development') {
  // Note: Event-based logging requires Prisma 4.0+ with specific log configuration
  // For now, using standard log levels
}

// For more advanced logging, you can enable event-based logging:
// https://www.prisma.io/docs/concepts/components/prisma-client/logging

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Connect to database
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

/**
 * Disconnect from database
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
    throw error;
  }
};
