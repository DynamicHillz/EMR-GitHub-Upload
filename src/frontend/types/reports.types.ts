export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export type ReportPeriod = 'day' | 'week' | 'month';

export interface ReportDateParams {
  startDate?: string;
  endDate?: string;
  period?: ReportPeriod;
}

export interface RankingReportParams {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface PatientVolumeReport {
  series: Array<{ bucket: string; label: string; newRegistrations: number }>;
  summary: { totalNewRegistrations: number; totalActivePatients: number; averagePerBucket: number };
}

export interface RevenueReport {
  series: Array<{ bucket: string; label: string; revenue: number; paymentCount: number }>;
  summary: { totalRevenue: number; totalPayments: number; averagePerBucket: number };
}

export interface DiagnosisTrendsReport {
  topDiagnoses: Array<{
    diagnosisId: string;
    code: string;
    name: string;
    count: number;
    consultationCount: number;
    admissionCount: number;
  }>;
  summary: { totalDiagnosesRecorded: number; startDate: string; endDate: string };
}

export interface StockTurnoverReport {
  medications: Array<{
    medicationId: string;
    name: string;
    category: string | null;
    quantityDispensed: number;
    currentStock: number;
    turnoverRatio: number | null;
  }>;
  summary: { totalDispensed: number; totalMedicationsTracked: number };
}

export interface NoShowReport {
  series: Array<{
    bucket: string;
    label: string;
    noShowCount: number;
    completedCount: number;
    resolvedCount: number;
    noShowRate: number;
  }>;
  summary: { totalNoShows: number; totalResolved: number; overallNoShowRate: number };
}
