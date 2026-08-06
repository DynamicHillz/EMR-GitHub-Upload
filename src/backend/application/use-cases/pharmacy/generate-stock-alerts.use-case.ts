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

    // Collected across both loops below and fired as ONE notifyRole call
    // per non-empty category once everything's been evaluated, instead of
    // one call per affected medication/batch — a scheduler run that finds
    // 30 low-stock items previously meant 30 separate notifications landing
    // in every pharmacist's/admin's list at once. The StockAlert rows
    // themselves (and their own per-alert dedup via the findFirst checks
    // above) are unchanged — only how many *notifications* this fires.
    const outOfStockNames: string[] = [];
    const lowStockNames: string[] = [];
    const expiredNames: string[] = [];
    const nearExpiryNames: string[] = [];
    let nearExpiryHasCritical = false;

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

          outOfStockNames.push(medication.name);
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

          lowStockNames.push(`${medication.name} (${medication.stockLevel} units remaining)`);
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

          expiredNames.push(`${medication.name} batch ${batch.batchNumber}`);

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

          nearExpiryNames.push(`${medication.name} batch ${batch.batchNumber} (${daysUntilExpiry}d)`);
          if (daysUntilExpiry <= 7) nearExpiryHasCritical = true;
        }
      }
    }

    await Promise.all([
      outOfStockNames.length > 0 &&
        this.notificationService.notifyRole(tenantId, ['PHARMACIST', 'ADMIN'], {
          type: 'STOCK_ALERT',
          severity: 'CRITICAL',
          title: 'Out of Stock',
          message: `${outOfStockNames.length} medication(s) out of stock: ${outOfStockNames.join(', ')}`,
          entityType: 'Tenant',
          entityId: tenantId,
        }),
      lowStockNames.length > 0 &&
        this.notificationService.notifyRole(tenantId, ['PHARMACIST', 'ADMIN'], {
          type: 'STOCK_ALERT',
          severity: 'WARNING',
          title: 'Low Stock',
          message: `${lowStockNames.length} medication(s) low in stock: ${lowStockNames.join(', ')}`,
          entityType: 'Tenant',
          entityId: tenantId,
        }),
      expiredNames.length > 0 &&
        this.notificationService.notifyRole(tenantId, ['PHARMACIST', 'ADMIN'], {
          type: 'STOCK_ALERT',
          severity: 'CRITICAL',
          title: 'Batch Expired',
          message: `${expiredNames.length} batch(es) expired: ${expiredNames.join(', ')}`,
          entityType: 'Tenant',
          entityId: tenantId,
        }),
      nearExpiryNames.length > 0 &&
        this.notificationService.notifyRole(tenantId, ['PHARMACIST', 'ADMIN'], {
          type: 'STOCK_ALERT',
          severity: nearExpiryHasCritical ? 'CRITICAL' : 'WARNING',
          title: 'Near Expiry',
          message: `${nearExpiryNames.length} batch(es) near expiry: ${nearExpiryNames.join(', ')}`,
          entityType: 'Tenant',
          entityId: tenantId,
        }),
    ]);

    return alerts;
  }
}
