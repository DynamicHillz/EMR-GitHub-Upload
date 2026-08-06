/**
 * Reports Controller
 *
 * Reporting & Analytics endpoints — patient volume, revenue, diagnosis
 * trends, stock turnover, and appointment no-show rate. Admin-only.
 */

import { Request, Response } from 'express';
import { endOfDay } from 'date-fns';
import { prisma } from '../../infrastructure/database/prisma.client';
import { logger } from '../../config/logger';
import { AppError } from '../../shared/errors/AppError';
import { ReportPeriod } from '../../shared/utils/report-bucketing.utils';
import { GetPatientVolumeReportUseCase } from '../../application/use-cases/reports/get-patient-volume-report.use-case';
import { GetRevenueReportUseCase } from '../../application/use-cases/reports/get-revenue-report.use-case';
import { GetAppointmentNoShowReportUseCase } from '../../application/use-cases/reports/get-appointment-noshow-report.use-case';
import { GetDiagnosisTrendsReportUseCase } from '../../application/use-cases/reports/get-diagnosis-trends-report.use-case';
import { GetStockTurnoverReportUseCase } from '../../application/use-cases/reports/get-stock-turnover-report.use-case';
import { GetNhmisMonthlyReturnReportUseCase } from '../../application/use-cases/reports/get-nhmis-monthly-return-report.use-case';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

const getPatientVolumeReportUseCase = new GetPatientVolumeReportUseCase(prisma);
const getRevenueReportUseCase = new GetRevenueReportUseCase(prisma);
const getAppointmentNoShowReportUseCase = new GetAppointmentNoShowReportUseCase(prisma);
const getDiagnosisTrendsReportUseCase = new GetDiagnosisTrendsReportUseCase(prisma);
const getStockTurnoverReportUseCase = new GetStockTurnoverReportUseCase(prisma);
const getNhmisMonthlyReturnReportUseCase = new GetNhmisMonthlyReturnReportUseCase(prisma);

const VALID_PERIODS: ReportPeriod[] = ['day', 'week', 'month'];

function parseReportDateRange(req: Request): { startDate: Date; endDate: Date; period: ReportPeriod } {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : thirtyDaysAgo;
  const endDate = req.query.endDate ? endOfDay(new Date(req.query.endDate as string)) : now;
  const period = (req.query.period as ReportPeriod) || 'day';

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new AppError('Invalid startDate or endDate', 400);
  }
  if (!VALID_PERIODS.includes(period)) {
    throw new AppError('Invalid period — must be day, week, or month', 400);
  }
  if (startDate > endDate) {
    throw new AppError('startDate must be before endDate', 400);
  }

  return { startDate, endDate, period };
}

function parseRankingFilters(req: Request): { startDate: Date; endDate: Date; limit?: number } {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : thirtyDaysAgo;
  const endDate = req.query.endDate ? endOfDay(new Date(req.query.endDate as string)) : now;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new AppError('Invalid startDate or endDate', 400);
  }
  if (startDate > endDate) {
    throw new AppError('startDate must be before endDate', 400);
  }

  return { startDate, endDate, limit };
}

// NHMIS is inherently one calendar month, not a date-range/period pick —
// a dedicated parser rather than reusing the two above.
function parseMonthYear(req: Request): { month: number; year: number } {
  const now = new Date();
  const month = req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1;
  const year = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();

  if (isNaN(month) || month < 1 || month > 12) {
    throw new AppError('Invalid month — must be between 1 and 12', 400);
  }
  if (isNaN(year) || year < 2000 || year > 2100) {
    throw new AppError('Invalid year', 400);
  }

  return { month, year };
}

export const getPatientVolumeReport = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const filters = parseReportDateRange(req);
    const result = await getPatientVolumeReportUseCase.execute(tenantId, filters);

    return res.status(200).json({ success: true, message: 'Patient volume report retrieved successfully', data: result });
  } catch (error: any) {
    logger.error('Error fetching patient volume report:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch patient volume report') });
  }
};

export const getRevenueReport = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const filters = parseReportDateRange(req);
    const result = await getRevenueReportUseCase.execute(tenantId, filters);

    return res.status(200).json({ success: true, message: 'Revenue report retrieved successfully', data: result });
  } catch (error: any) {
    logger.error('Error fetching revenue report:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch revenue report') });
  }
};

export const getNoShowReport = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const filters = parseReportDateRange(req);
    const result = await getAppointmentNoShowReportUseCase.execute(tenantId, filters);

    return res.status(200).json({ success: true, message: 'No-show report retrieved successfully', data: result });
  } catch (error: any) {
    logger.error('Error fetching no-show report:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch no-show report') });
  }
};

export const getDiagnosisTrendsReport = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const filters = parseRankingFilters(req);
    const result = await getDiagnosisTrendsReportUseCase.execute(tenantId, filters);

    return res.status(200).json({ success: true, message: 'Diagnosis trends report retrieved successfully', data: result });
  } catch (error: any) {
    logger.error('Error fetching diagnosis trends report:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch diagnosis trends report') });
  }
};

export const getStockTurnoverReport = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const filters = parseRankingFilters(req);
    const result = await getStockTurnoverReportUseCase.execute(tenantId, filters);

    return res.status(200).json({ success: true, message: 'Stock turnover report retrieved successfully', data: result });
  } catch (error: any) {
    logger.error('Error fetching stock turnover report:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch stock turnover report') });
  }
};

export const getNhmisMonthlyReturnReport = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { month, year } = parseMonthYear(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const result = await getNhmisMonthlyReturnReportUseCase.execute(tenantId, month, year, limit);

    return res.status(200).json({ success: true, message: 'NHMIS monthly return retrieved successfully', data: result });
  } catch (error: any) {
    logger.error('Error fetching NHMIS monthly return:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch NHMIS monthly return') });
  }
};
