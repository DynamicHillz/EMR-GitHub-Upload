import { TriageCategory } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.client';
import { ConflictError } from '../../shared/errors/AppError';

export class TriageService {
  async getTriageQueue(tenantId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const records = await prisma.triage.findMany({
      where: { 
        tenantId,
        seenByDoctorAt: null,
        triageTime: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        patient: true,
        triageNurse: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: [
        { category: 'asc' }, // Assuming EMERGENCY < PRIORITY < QUEUE in enum definition or we sort in memory
        { triageTime: 'asc' }
      ]
    });

    return records.map(record => {
      const p = record.patient as any;
      if (p && p.dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(p.dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        p.age = Math.max(0, age);
      }
      return record;
    });
  }

  async getTriageRecord(tenantId: string, id: string) {
    const record = await prisma.triage.findUnique({
      where: { id },
      include: {
        patient: true,
        triageNurse: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    if (!record || record.tenantId !== tenantId) {
      throw new Error('Triage record not found');
    }

    const p = record.patient as any;
    if (p && p.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(p.dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      p.age = Math.max(0, age);
    }

    return record;
  }

  async getPatientTriageHistory(tenantId: string, patientId: string) {
    return prisma.triage.findMany({
      where: { tenantId, patientId },
      orderBy: { triageTime: 'desc' },
      include: {
        triageNurse: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
  }

  async createTriageRecord(tenantId: string, nurseId: string, data: any) {
    return prisma.triage.create({
      data: {
        // Honor a client-generated id when present (the offline queue relies
        // on this — see sync.controller.ts's applyCreate — so the id used if
        // this request gets queued and replayed later matches what would
        // have been created had it succeeded immediately).
        id: data.id || undefined,
        tenantId,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        chiefComplaint: data.chiefComplaint,
        category: data.category as TriageCategory,
        triageNurseId: nurseId,
        
        systolicBP: data.systolicBP,
        diastolicBP: data.diastolicBP,
        heartRate: data.heartRate,
        temperature: data.temperature,
        respiratoryRate: data.respiratoryRate,
        spO2: data.spO2,
        weight: data.weight,
        painScore: data.painScore,
        glucoseLevel: data.glucoseLevel,
        consciousnessLevel: data.consciousnessLevel,
        
        muac: data.muac,
        isDehydrated: data.isDehydrated,
      },
      include: {
        patient: true
      }
    });
  }

  async updateTriageRecord(tenantId: string, id: string, data: any) {
    const record = await this.getTriageRecord(tenantId, id);

    const updateData = {
      category: data.category,
      systolicBP: data.systolicBP,
      diastolicBP: data.diastolicBP,
      heartRate: data.heartRate,
      temperature: data.temperature,
      respiratoryRate: data.respiratoryRate,
      spO2: data.spO2,
      weight: data.weight,
      painScore: data.painScore,
      glucoseLevel: data.glucoseLevel,
      consciousnessLevel: data.consciousnessLevel,
      dispositionNotes: data.dispositionNotes,
    };

    // Two nurses can otherwise both load the same record and blind-write —
    // guard on version the same way Consultation/Patient/Invoice already do.
    if (data.version !== undefined) {
      const result = await prisma.triage.updateMany({
        where: { id: record.id, tenantId, version: data.version },
        data: { ...updateData, version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw new ConflictError('This triage record was changed by someone else. Please reload and try again.');
      }
      return this.getTriageRecord(tenantId, id);
    }

    return prisma.triage.update({
      where: { id: record.id },
      data: { ...updateData, version: { increment: 1 } },
    });
  }

  async markAsSeen(tenantId: string, id: string) {
    const record = await this.getTriageRecord(tenantId, id);
    const now = new Date();
    const waitingTimeMinutes = Math.floor((now.getTime() - record.triageTime.getTime()) / 60000);

    return prisma.triage.update({
      where: { id: record.id },
      data: {
        seenByDoctorAt: now,
        waitingTimeMinutes,
      }
    });
  }
}
