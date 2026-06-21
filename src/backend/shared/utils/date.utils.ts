/**
 * Date Utility Functions
 *
 * Common date manipulation and formatting utilities.
 */

import { format, parseISO, isValid, differenceInYears, addDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Format date to readable string
 */
export const formatDate = (date: Date | string, formatString: string = 'yyyy-MM-dd'): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(dateObj)) {
    throw new Error('Invalid date provided');
  }

  return format(dateObj, formatString);
};

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dateOfBirth: Date | string): number => {
  const dob = typeof dateOfBirth === 'string' ? parseISO(dateOfBirth) : dateOfBirth;

  if (!isValid(dob)) {
    throw new Error('Invalid date of birth');
  }

  return differenceInYears(new Date(), dob);
};

/**
 * Check if date is in the past
 */
export const isPastDate = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return dateObj < new Date();
};

/**
 * Check if date is in the future
 */
export const isFutureDate = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return dateObj > new Date();
};

/**
 * Get start of day
 */
export const getStartOfDay = (date: Date | string = new Date()): Date => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return startOfDay(dateObj);
};

/**
 * Get end of day
 */
export const getEndOfDay = (date: Date | string = new Date()): Date => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return endOfDay(dateObj);
};

/**
 * Add days to a date
 */
export const addDaysToDate = (date: Date | string, days: number): Date => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return addDays(dateObj, days);
};

/**
 * Format date for display (e.g., "Jan 15, 2024")
 */
export const formatDisplayDate = (date: Date | string): string => {
  return formatDate(date, 'MMM dd, yyyy');
};

/**
 * Format datetime for display (e.g., "Jan 15, 2024 10:30 AM")
 */
export const formatDisplayDateTime = (date: Date | string): string => {
  return formatDate(date, 'MMM dd, yyyy hh:mm a');
};

/**
 * Parse ISO string to Date safely
 */
export const parseDate = (dateString: string): Date | null => {
  try {
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
};
