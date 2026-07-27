/**
 * Generate Stock Alerts Use Case
 *
 * REQ-PHARM-5: Generate alerts for low stock and near-expiry medications
 */

import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../../services/notification.service';

export interface StockAlertDto {
  id: string;
  medicationName: string;
  alertType: string;
  severity: string;
  message: string;
  createdAt: string;
  batchNumber?: string;
  daysUntilExpiry?: number;
  currentStock?: number;
  threshold?: number;
}

export class GenerateStockAlertsUseCase {
  private notificationService: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.notificationService = new NotificationService(prisma);
  }

  async execute(tenantId: string): Promise<StockAlertDto[]> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const alerts: StockAlertDto[] = [];

    // Low/out-of-stock: stockLevel <= reorderPoint is a same-row column
    // comparison, which Prisma's query builder can't express — $queryRaw
    // is the only way to push this filter into the database instead of
    // fetching every medication and comparing in JS.
    const lowStockMedications = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; stockLevel: number; reorderPoint: number }>
    >`
      SELECT id, name, "stockLevel", "reorderPoint"
      FROM medications
      WHERE "tenantId" = ${tenantId} AND "isDeleted" = false AND "stockLevel" <= "reorderPoint"
    `;

    for (const medication of lowStockMedications) {
      // Check for low stock
      if (medication.stockLevel <= 0) {
        const existingAlert = await this.prisma.stockAlert.findFirst({
          where: {
            tenantId,
            medicationId: medication.id,
            alertType: 'OUT_OF_STOCK',
            status: 'ACTIVE',
          },
        });

        if (!existingAlert) {
          const alert = await this.prisma.stockAlert.create({
            data: {
              tenantId,
              medicationId: medication.id,
              alertType: 'OUT_OF_STOCK',
              severity: 'CRITICAL',
              message: `${medication.name} is out of stock`,
              status: 'ACTIVE',
            },
          });

          alerts.push({
            id: alert.id,
            medicationName: medication.name,
            alertType: alert.alertType,
            severity: alert.severity,
            message: alert.message,
            createdAt: alert.createdAt.toISOString(),
            currentStock: medication.stockLevel,
          });

          await this.notificationService.notifyRole(tenantId, ['PHARMACIST', 'ADMIN'], {
            type: 'STOCK_ALERT',
            title: 'Out of Stock',
            message: alert.message,
            entityType: 'StockAlert',
            entityId: alert.id,
          });
        }
      } else if (medication.stockLevel <= medication.reorderPoint) {
        const existingAlert = await this.prisma.stockAlert.findFirst({
          where: {
            tenantId,
            medicationId: medication.id,
            alertType: 'LOW_STOCK',
            status: 'ACTIVE',
          },
        });

        if (!existingAlert) {
          const alert = await this.prisma.stockAlert.create({
            data: {
              tenantId,
              medicationId: medication.id,
              alertType: 'LOW_STOCK',
              severity: 'WARNING',
              message: `${medication.name} is low in stock (${medication.stockLevel} units remaining)`,
              threshold: medication.reorderPoint,
              status: 'ACTIVE',
            },
          });

          alerts.push({
            id: alert.id,
            medicationName: medication.name,
            alertType: alert.alertType,
            severity: alert.severity,
            message: alert.message,
            createdAt: alert.createdAt.toISOString(),
            currentStock: medication.stockLevel,
            threshold: medication.reorderPoint,
          });

          await this.notificationService.notifyRole(tenantId, ['PHARMACIST', 'ADMIN'], {
            type: 'STOCK_ALERT',
            title: 'Low Stock',
            message: alert.message,
            entityType: 'StockAlert',
            entityId: alert.id,
          });
        }
      }
    }

    // Near-expiry / expired batches — filtered at the database level
    // (status + a date bound), instead of fetching every active batch for
    // every medication and checking expiry in JS.
    const relevantBatches = await this.prisma.medicationBatch.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        expiryDate: { lte: thirtyDaysFromNow },
      },
      include: {
        medication: { select: { id: true, name: true } },
      },
    });

    for (const batch of relevantBatches) {
      const medication = batch.medication;
      const daysUntilExpiry = Math.floor(
        (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Expired batches
      if (batch.expiryDate < now) {
        const existingAlert = await this.prisma.stockAlert.findFirst({
          where: {
            tenantId,
            batchId: batch.id,
            alertType: 'EXPIRED',
            status: 'ACTIVE',
          },
        });

        if (!existingAlert) {
          const alert = await this.prisma.stockAlert.create({
            data: {
              tenantId,
              medicationId: medication.id,
              batchId: batch.id,
              alertType: 'EXPIRED',
              severity: 'CRITICAL',
              message: `${medication.name} batch ${batch.batchNumber} has expired`,
              status: 'ACTIVE',
            },
          });

          alerts.push({
            id: alert.id,
            medicationName: medication.name,
            alertType: alert.alertType,
            severity: alert.severity,
            message: alert.message,
            createdAt: alert.createdAt.toISOString(),
            batchNumber: batch.batchNumber,
            daysUntilExpiry,
          });

          await this.notificationService.notifyRole(tenantId, ['PHARMACIST', 'ADMIN'], {
            type: 'STOCK_ALERT',
            title: 'Batch Expired',
            message: alert.message,
            entityType: 'StockAlert',
            entityId: alert.id,
          });

          // Update batch status to EXPIRED
          await this.prisma.medicationBatch.update({
            where: { id: batch.id },
            data: { status: 'EXPIRED' },
          });
        }
      }
      // Near expiry (within 30 days)
      else {
        const existingAlert = await this.prisma.stockAlert.findFirst({
          where: {
            tenantId,
            batchId: batch.id,
            alertType: 'NEAR_EXPIRY',
            status: 'ACTIVE',
          },
        });

        if (!existingAlert) {
          const alert = await this.prisma.stockAlert.create({
            data: {
              tenantId,
              medicationId: medication.id,
              batchId: batch.id,
              alertType: 'NEAR_EXPIRY',
              severity: daysUntilExpiry <= 7 ? 'CRITICAL' : 'WARNING',
              message: `${medication.name} batch ${batch.batchNumber} expires in ${daysUntilExpiry} days`,
              status: 'ACTIVE',
            },
          });

          alerts.push({
            id: alert.id,
            medicationName: medication.name,
            alertType: alert.alertType,
            severity: alert.severity,
            message: alert.message,
            createdAt: alert.createdAt.toISOString(),
            batchNumber: batch.batchNumber,
            daysUntilExpiry,
          });

          await this.notificationService.notifyRole(tenantId, ['PHARMACIST', 'ADMIN'], {
            type: 'STOCK_ALERT',
            title: 'Near Expiry',
            message: alert.message,
            entityType: 'StockAlert',
            entityId: alert.id,
          });
        }
      }
    }

    return alerts;
  }
}
