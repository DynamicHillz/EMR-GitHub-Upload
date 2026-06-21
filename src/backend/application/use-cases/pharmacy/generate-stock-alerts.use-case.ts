/**
 * Generate Stock Alerts Use Case
 *
 * REQ-PHARM-5: Generate alerts for low stock and near-expiry medications
 */

import { PrismaClient } from '@prisma/client';

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
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<StockAlertDto[]> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const alerts: StockAlertDto[] = [];

    // Get all medications with their batches
    const medications = await this.prisma.medication.findMany({
      where: { tenantId },
      include: {
        batches: {
          where: {
            status: 'ACTIVE',
          },
        },
      },
    });

    for (const medication of medications) {
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
        }
      }

      // Check for near-expiry batches
      for (const batch of medication.batches) {
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

            // Update batch status to EXPIRED
            await this.prisma.medicationBatch.update({
              where: { id: batch.id },
              data: { status: 'EXPIRED' },
            });
          }
        }
        // Near expiry (within 30 days)
        else if (batch.expiryDate <= thirtyDaysFromNow) {
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
          }
        }
      }
    }

    return alerts;
  }
}
