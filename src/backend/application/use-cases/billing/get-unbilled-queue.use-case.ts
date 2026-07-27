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

export class GetUnbilledQueueUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<{ patients: UnbilledQueuePatient[]; totalPatients: number; totalItems: number }> {
    const patientSelect = {
      select: {
        id: true,
        patientId: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    };

    const [prescriptions, labOrders, consultations] = await Promise.all([
      this.prisma.prescription.findMany({
        where: { tenantId, status: 'DISPENSED', billingStatus: 'UNBILLED' },
        select: { createdAt: true, patient: patientSelect },
      }),
      this.prisma.labOrder.findMany({
        where: { tenantId, billingStatus: 'UNBILLED', isDeleted: false },
        select: { createdAt: true, patient: patientSelect },
      }),
      this.prisma.consultation.findMany({
        where: { tenantId, status: 'COMPLETED', billingStatus: 'UNBILLED', isDeleted: false },
        select: { createdAt: true, finalizedAt: true, patient: patientSelect },
      }),
    ]);

    const groups = new Map<string, UnbilledQueuePatient>();

    const upsert = (
      patient: { id: string; patientId: string; firstName: string; lastName: string; phone: string },
      type: 'PRESCRIPTION' | 'LAB_ORDER' | 'CONSULTATION',
      date: Date
    ) => {
      const isoDate = date.toISOString();
      let entry = groups.get(patient.id);
      if (!entry) {
        entry = {
          patientDbId: patient.id,
          patientId: patient.patientId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          patientPhone: patient.phone,
          prescriptionCount: 0,
          labOrderCount: 0,
          consultationCount: 0,
          itemCount: 0,
          oldestItemDate: isoDate,
        };
        groups.set(patient.id, entry);
      }
      if (type === 'PRESCRIPTION') entry.prescriptionCount++;
      if (type === 'LAB_ORDER') entry.labOrderCount++;
      if (type === 'CONSULTATION') entry.consultationCount++;
      entry.itemCount++;
      if (isoDate < entry.oldestItemDate) entry.oldestItemDate = isoDate;
    };

    prescriptions.forEach((p) => upsert(p.patient, 'PRESCRIPTION', p.createdAt));
    labOrders.forEach((l) => upsert(l.patient, 'LAB_ORDER', l.createdAt));
    consultations.forEach((c) => upsert(c.patient, 'CONSULTATION', c.finalizedAt || c.createdAt));

    const patients = Array.from(groups.values()).sort((a, b) => a.oldestItemDate.localeCompare(b.oldestItemDate));

    return {
      patients,
      totalPatients: patients.length,
      totalItems: patients.reduce((sum, p) => sum + p.itemCount, 0),
    };
  }
}
