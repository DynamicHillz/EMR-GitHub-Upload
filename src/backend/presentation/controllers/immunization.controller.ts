import { Request, Response } from 'express';
import { DismissWorklistItemUseCase } from '../../application/use-cases/worklist/dismiss-worklist-item.use-case';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';
import { prisma } from '../../infrastructure/database/prisma.client';

const dismissWorklistItemUseCase = new DismissWorklistItemUseCase(prisma);

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
  // Combines two sources of "due":
  //   1. Follow-on doses in a series — an existing PatientImmunization row
  //      with nextDueDate set (the only thing this endpoint used to cover).
  //   2. Never-given first doses — computed on read from
  //      ImmunizationSchedule.targetAgeWeeks against each patient's
  //      dateOfBirth, since PatientImmunization requires administeredById/At
  //      (it models a dose actually given, not a placeholder) so there's
  //      nothing to query for a dose that's never been logged. This is what
  //      makes a newborn show up here the day they're born instead of only
  //      after a first dose is manually recorded.
  getOverdueImmunizations: async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const withinDays = req.query.withinDays ? parseInt(req.query.withinDays as string) : 7;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + withinDays);

      const [followOnDoses, schedule, givenDoses, dismissals] = await Promise.all([
        prisma.patientImmunization.findMany({
          where: { tenantId, nextDueDate: { lte: cutoff } },
          orderBy: { nextDueDate: 'asc' },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, patientId: true, dateOfBirth: true } },
            schedule: { select: { id: true, vaccineName: true, diseaseTarget: true } },
          },
        }),
        prisma.immunizationSchedule.findMany({ where: { tenantId } }),
        prisma.patientImmunization.findMany({
          where: { tenantId },
          select: { patientId: true, scheduleId: true },
        }),
        prisma.worklistDismissal.findMany({
          where: { tenantId, worklistType: 'IMMUNIZATION_DUE' },
          select: { patientId: true, scheduleId: true },
        }),
      ]);

      const givenKeys = new Set(givenDoses.map((d) => `${d.patientId}:${d.scheduleId}`));
      const dismissedKeys = new Set(dismissals.map((d) => `${d.patientId}:${d.scheduleId}`));

      // Bounded to patients young enough to plausibly have a missing dose,
      // rather than scanning every patient in the tenant on every page
      // load. ImmunizationSchedule is an EPI/childhood catalog in practice
      // (BCG, OPV, Pentavalent) — this system's own age.utils.ts already
      // treats 5 years as a meaningful clinical cutoff (the "<1"/"1-4"
      // age-group boundary), so it's used here too rather than inventing a
      // new one. Revisit if this catalog is ever used for adult vaccines.
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const patientsNeedingCheck = await prisma.patient.findMany({
        where: { tenantId, isDeleted: false, dateOfBirth: { gte: fiveYearsAgo } },
        select: { id: true, firstName: true, lastName: true, patientId: true, dateOfBirth: true },
      });

      const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
      const neverGivenDue = patientsNeedingCheck.flatMap((patient) =>
        schedule
          .filter((item) => !givenKeys.has(`${patient.id}:${item.id}`) && !dismissedKeys.has(`${patient.id}:${item.id}`))
          .map((item) => {
            const expectedDate = new Date(patient.dateOfBirth.getTime() + item.targetAgeWeeks * MS_PER_WEEK);
            return { patient, item, expectedDate };
          })
          .filter(({ expectedDate }) => expectedDate <= cutoff)
          .map(({ patient: p, item, expectedDate }) => ({
            id: `due-${p.id}-${item.id}`,
            patientId: p.id,
            scheduleId: item.id,
            nextDueDate: expectedDate.toISOString(),
            patient: { id: p.id, firstName: p.firstName, lastName: p.lastName, patientId: p.patientId },
            schedule: { vaccineName: item.vaccineName, diseaseTarget: item.diseaseTarget },
          }))
      );

      const normalizedFollowOn = followOnDoses
        .filter((dose) => !dismissedKeys.has(`${dose.patientId}:${dose.scheduleId}`))
        .map((dose) => ({
          id: dose.id,
          patientId: dose.patientId,
          scheduleId: dose.scheduleId,
          nextDueDate: dose.nextDueDate!.toISOString(),
          patient: {
            id: dose.patient.id,
            firstName: dose.patient.firstName,
            lastName: dose.patient.lastName,
            patientId: dose.patient.patientId,
          },
          schedule: { vaccineName: dose.schedule.vaccineName, diseaseTarget: dose.schedule.diseaseTarget },
        }));

      const dueDoses = [...normalizedFollowOn, ...neverGivenDue].sort(
        (a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
      );

      // The due-list itself is computed in memory (schedule x patient
      // cross-product, not something the DB can page for us), so pagination
      // here is a slice over the already-bounded result rather than a
      // skip/take at the query level — still real pagination from the
      // frontend's point of view, just applied after the computation.
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const start = (page - 1) * limit;
      const paged = dueDoses.slice(start, start + limit);

      res.status(200).json({
        success: true,
        data: paged,
        total: dueDoses.length,
        page,
        totalPages: Math.ceil(dueDoses.length / limit) || 1,
      });
    } catch (error: any) {
      console.error('getOverdueImmunizations error:', error);
      res.status(500).json({ message: 'Failed to fetch overdue immunizations' });
    }
  },

  // Resolves a false-positive due-item (dose given elsewhere, patient
  // declined/transferred/deceased) without fabricating a dose that was
  // never actually given. See WorklistDismissal in schema.prisma.
  dismissDueImmunization: async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      if (!tenantId || !userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const { patientId, scheduleId } = req.params;
      const dismissal = await dismissWorklistItemUseCase.execute(
        tenantId,
        { worklistType: 'IMMUNIZATION_DUE', patientId, scheduleId, reason: req.body.reason, reasonNotes: req.body.reasonNotes },
        userId
      );

      res.status(201).json({ success: true, message: 'Due item dismissed', data: dismissal });
    } catch (error: any) {
      console.error('dismissDueImmunization error:', error);
      res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to dismiss due item') });
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
