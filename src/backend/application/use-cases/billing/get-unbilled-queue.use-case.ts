/**
 * Get Unbilled Queue Use Case
 *
 * Clinic-wide worklist of patients with billable items (dispensed
 * prescriptions, lab orders, finalized consultations) not yet invoiced —
 * grouped by patient so cashiers can work through the backlog without
 * having to already know which patient to search for.
 */

import { PrismaClient } from '@prisma/client';

export interface UnbilledQueuePatient {
  patientDbId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  prescriptionCount: number;
  labOrderCount: number;
  consultationCount: number;
  itemCount: number;
  oldestItemDate: string;
}

interface UnbilledQueueRow {
  patientDbId: string;
  patientId: string;
  firstName: string;
  lastName: string;
  phone: string;
  prescriptionCount: bigint | number;
  labOrderCount: bigint | number;
  consultationCount: bigint | number;
  itemCount: bigint | number;
  oldestItemDate: Date;
}

export class GetUnbilledQueueUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<{ patients: UnbilledQueuePatient[]; totalPatients: number; totalItems: number }> {
    // Previously 3 unbounded findMany calls (prescriptions/labOrders/
    // consultations) fetched into memory and grouped by patient via a JS
    // Map — Prisma's query builder can't UNION across three tables or
    // express a per-type COUNT FILTER, so this pushes the grouping into one
    // SQL query instead (same $queryRaw justification as
    // generate-stock-alerts.use-case.ts).
    const rows = await this.prisma.$queryRaw<UnbilledQueueRow[]>`
      WITH items AS (
        SELECT "patientId" AS patient_id, "createdAt" AS item_date, 'PRESCRIPTION' AS item_type
        FROM prescriptions
        WHERE "tenantId" = ${tenantId} AND status = 'DISPENSED' AND "billingStatus" = 'UNBILLED'
        UNION ALL
        SELECT "patientId" AS patient_id, "createdAt" AS item_date, 'LAB_ORDER' AS item_type
        FROM lab_orders
        WHERE "tenantId" = ${tenantId} AND "billingStatus" = 'UNBILLED' AND "isDeleted" = false
        UNION ALL
        SELECT "patientId" AS patient_id, COALESCE("finalizedAt", "createdAt") AS item_date, 'CONSULTATION' AS item_type
        FROM consultations
        WHERE "tenantId" = ${tenantId} AND status = 'COMPLETED' AND "billingStatus" = 'UNBILLED' AND "isDeleted" = false
      )
      SELECT
        p.id AS "patientDbId",
        p."patientId" AS "patientId",
        p."firstName" AS "firstName",
        p."lastName" AS "lastName",
        p.phone AS "phone",
        COUNT(*) FILTER (WHERE i.item_type = 'PRESCRIPTION') AS "prescriptionCount",
        COUNT(*) FILTER (WHERE i.item_type = 'LAB_ORDER') AS "labOrderCount",
        COUNT(*) FILTER (WHERE i.item_type = 'CONSULTATION') AS "consultationCount",
        COUNT(*) AS "itemCount",
        MIN(i.item_date) AS "oldestItemDate"
      FROM items i
      JOIN patients p ON p.id = i.patient_id
      GROUP BY p.id, p."patientId", p."firstName", p."lastName", p.phone
      ORDER BY "oldestItemDate" ASC
    `;

    const patients: UnbilledQueuePatient[] = rows.map((row) => ({
      patientDbId: row.patientDbId,
      patientId: row.patientId,
      patientName: `${row.firstName} ${row.lastName}`,
      patientPhone: row.phone,
      prescriptionCount: Number(row.prescriptionCount),
      labOrderCount: Number(row.labOrderCount),
      consultationCount: Number(row.consultationCount),
      itemCount: Number(row.itemCount),
      oldestItemDate: row.oldestItemDate.toISOString(),
    }));

    return {
      patients,
      totalPatients: patients.length,
      totalItems: patients.reduce((sum, p) => sum + p.itemCount, 0),
    };
  }
}
