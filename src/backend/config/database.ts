/**
 * Database Configuration
 *
 * Database connection and configuration settings.
 */

import { prisma, connectDatabase, disconnectDatabase } from '../infrastructure/database/prisma.client';
import { logger } from './logger';

/**
 * Initialize database connection
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    await connectDatabase();
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

/**
 * Close database connection
 */
export const closeDatabase = async (): Promise<void> => {
  try {
    await disconnectDatabase();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Failed to close database connection:', error);
    throw error;
  }
};

/**
 * Health check for database
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

export { prisma };
