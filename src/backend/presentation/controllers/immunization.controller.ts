import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const immunizationController = {
  // -------------------------
  // SCHEDULE CATALOG
  // -------------------------
  getSchedule: async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const schedule = await prisma.immunizationSchedule.findMany({
        where: { tenantId },
        orderBy: { targetAgeWeeks: 'asc' }
      });
      res.status(200).json(schedule);
    } catch (error: any) {
      console.error('getSchedule error:', error);
      res.status(500).json({ message: 'Failed to fetch immunization schedule' });
    }
  },

  createScheduleItem: async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { vaccineName, diseaseTarget, targetAgeWeeks, route, description } = req.body;

      const item = await prisma.immunizationSchedule.create({
        data: {
          tenantId: tenantId!,
          vaccineName,
          diseaseTarget,
          targetAgeWeeks,
          route,
          description
        }
      });
      res.status(201).json(item);
    } catch (error: any) {
      console.error('createScheduleItem error:', error);
      res.status(500).json({ message: 'Failed to create schedule item' });
    }
  },

  // -------------------------
  // PATIENT IMMUNIZATIONS
  // -------------------------
  getPatientImmunizations: async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const tenantId = req.user?.tenantId;

      const immunizations = await prisma.patientImmunization.findMany({
        where: { tenantId, patientId },
        orderBy: { administeredAt: 'desc' },
        include: {
          schedule: true,
          administeredBy: { select: { firstName: true, lastName: true, role: true } }
        }
      });
      res.status(200).json(immunizations);
    } catch (error: any) {
      console.error('getPatientImmunizations error:', error);
      res.status(500).json({ message: 'Failed to fetch patient immunizations' });
    }
  },

  // -------------------------
  // OVERDUE WORKLIST
  // -------------------------
  getOverdueImmunizations: async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const withinDays = req.query.withinDays ? parseInt(req.query.withinDays as string) : 7;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + withinDays);

      const dueDoses = await prisma.patientImmunization.findMany({
        where: {
          tenantId,
          nextDueDate: { lte: cutoff },
        },
        orderBy: { nextDueDate: 'asc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, patientId: true } },
          schedule: { select: { vaccineName: true, diseaseTarget: true } },
        },
      });

      res.status(200).json({ success: true, data: dueDoses });
    } catch (error: any) {
      console.error('getOverdueImmunizations error:', error);
      res.status(500).json({ message: 'Failed to fetch overdue immunizations' });
    }
  },

  recordImmunization: async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      const { scheduleId, administeredAt, batchNumber, nextDueDate, notes, hasAdverseReaction, reactionNotes } = req.body;

      const record = await prisma.patientImmunization.create({
        data: {
          tenantId: tenantId!,
          patientId,
          scheduleId,
          administeredById: userId!,
          administeredAt: administeredAt ? new Date(administeredAt) : new Date(),
          batchNumber,
          nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
          notes,
          hasAdverseReaction: hasAdverseReaction || false,
          reactionNotes
        },
        include: {
          schedule: true,
          administeredBy: { select: { firstName: true, lastName: true, role: true } }
        }
      });
      res.status(201).json(record);
    } catch (error: any) {
      console.error('recordImmunization error:', error);
      // Prisma unique constraint violation
      if (error.code === 'P2002') {
        return res.status(400).json({ message: 'Patient has already received this vaccine from the schedule.' });
      }
      res.status(500).json({ message: 'Failed to record immunization' });
    }
  }
};
