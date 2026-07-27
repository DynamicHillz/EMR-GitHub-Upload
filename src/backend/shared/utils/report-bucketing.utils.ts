/**
 * Report Bucketing Utilities
 *
 * Groups dated records into day/week/month buckets for time-series reports.
 * Pure functions — no Prisma dependency.
 */

import { format, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';

export type ReportPeriod = 'day' | 'week' | 'month';

/**
 * Bucket key for a given date + period.
 * day -> 'yyyy-MM-dd', week -> ISO week start (Mon) 'yyyy-MM-dd', month -> 'yyyy-MM'
 */
export const getBucketKey = (date: Date, period: ReportPeriod): string => {
  switch (period) {
    case 'week':
      return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    case 'month':
      return format(startOfMonth(date), 'yyyy-MM');
    case 'day':
    default:
      return format(date, 'yyyy-MM-dd');
  }
};

/**
 * Human-readable label for a bucket key, e.g. 'Jul 24' (day/week) or 'Jul 2026' (month)
 */
export const getBucketLabel = (bucketKey: string, period: ReportPeriod): string => {
  if (period === 'month') {
    return format(new Date(`${bucketKey}-01`), 'MMM yyyy');
  }
  return format(new Date(bucketKey), 'MMM d');
};

/**
 * Zero-filled ordered list of bucket keys spanning [startDate, endDate] — ensures charts
 * show a flat zero point instead of a gap on buckets with no activity.
 */
export const generateBucketRange = (startDate: Date, endDate: Date, period: ReportPeriod): string[] => {
  switch (period) {
    case 'week':
      return eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 }).map((d) => getBucketKey(d, period));
    case 'month':
      return eachMonthOfInterval({ start: startDate, end: endDate }).map((d) => getBucketKey(d, period));
    case 'day':
    default:
      return eachDayOfInterval({ start: startDate, end: endDate }).map((d) => getBucketKey(d, period));
  }
};
