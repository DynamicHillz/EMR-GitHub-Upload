/**
 * Get Stock Alerts Use Case
 *
 * REQ-PHARM-5: Retrieve current stock alerts
 */

import { PrismaClient } from '@prisma/client';

export interface GetStockAlertsDto {
  status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  alertType?: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NEAR_EXPIRY' | 'EXPIRED' | 'REORDER_POINT';
}

export interface StockAlertResponse {
  id: string;
  medicationId: string;
  medicationName: string;
  batchId?: string;
  batchNumber?: string;
  alertType: string;
  severity: string;
  message: string;
  status: string;
  threshold?: number;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export class GetStockAlertsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    filters: GetStockAlertsDto,
    tenantId: string
  ): Promise<StockAlertResponse[]> {
    const where: any = { tenantId };

    if (filters.status) {
      where.status = filters.status;
    } else {
      where.status = 'ACTIVE'; // Default to active alerts
    }

    if (filters.severity) {
      where.severity = filters.severity;
    }

    if (filters.alertType) {
      where.alertType = filters.alertType;
    }

    const alerts = await this.prisma.stockAlert.findMany({
      where,
      include: {
        medication: {
          select: {
            name: true,
          },
        },
        batch: {
          select: {
            batchNumber: true,
          },
        },
      },
      orderBy: [
        { severity: 'desc' }, // Critical first
        { createdAt: 'desc' }, // Newest first
      ],
    });

    return alerts.map((alert) => ({
      id: alert.id,
      medicationId: alert.medicationId,
      medicationName: alert.medication.name,
      batchId: alert.batchId || undefined,
      batchNumber: alert.batch?.batchNumber || undefined,
      alertType: alert.alertType,
      severity: alert.severity,
      message: alert.message,
      status: alert.status,
      threshold: alert.threshold || undefined,
      createdAt: alert.createdAt.toISOString(),
      acknowledgedAt: alert.acknowledgedAt?.toISOString(),
      resolvedAt: alert.resolvedAt?.toISOString(),
    }));
  }
}
