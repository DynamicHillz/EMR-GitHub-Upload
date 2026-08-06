import { Request, Response } from 'express';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';
import { NotificationService } from '../../application/services/notification.service';
import { prisma } from '../../infrastructure/database/prisma.client';

const notificationService = new NotificationService(prisma);

// Mirrors RecordAncVisitModal.tsx's getAncDangerSigns() thresholds — the
// on-screen banner there is informational only and doesn't reach anyone not
// looking at that screen, so this is what actually alerts staff (same
// notifyRole pattern record-partograph-observation.use-case.ts already uses).
function getAncVisitDangerSigns(data: {
  systolicBP?: number;
  diastolicBP?: number;
  urineProtein?: string;
  fetalHeartRate?: number;
}): string[] {
  const signs: string[] = [];
  if (data.systolicBP != null && data.systolicBP >= 140) signs.push(`elevated systolic BP (${data.systolicBP} mmHg)`);
  if (data.diastolicBP != null && data.diastolicBP >= 90) signs.push(`elevated diastolic BP (${data.diastolicBP} mmHg)`);
  if (data.urineProtein === '2+' || data.urineProtein === '3+') signs.push(`significant proteinuria (${data.urineProtein})`);
  if (data.fetalHeartRate != null && (data.fetalHeartRate < 110 || data.fetalHeartRate > 160)) {
    signs.push(`fetal heart rate outside normal range (${data.fetalHeartRate} bpm)`);
  }
  return signs;
}

export const ancController = {
  // -------------------------
  // ANC PREGNANCIES
  // -------------------------
  getActivePregnancies: async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ message: 'Unauthorized' });

      const activePregnancies = await prisma.ancPregnancy.findMany({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              patientId: true,
              dateOfBirth: true,
            }
          }
        }
      });

      res.status(200).json(activePregnancies);
    } catch (error: any) {
      console.error('getActivePregnancies error:', error);
      res.status(500).json({ message: getSafeErrorMessage(error, 'Failed to fetch active ANC pregnancies') });
    }
  },
  getPregnanciesByPatient: async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ message: 'Unauthorized' });

      const pregnancies = await prisma.ancPregnancy.findMany({
        where: { tenantId, patientId },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json(pregnancies);
    } catch (error: any) {
      console.error('getPregnanciesByPatient error:', error);
      res.status(500).json({ message: getSafeErrorMessage(error, 'Failed to fetch ANC pregnancies') });
    }
  },

  createPregnancy: async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ message: 'Unauthorized' });
      const {
        gravidity, parity, lmp, edd, bloodGroup, husbandBloodGroup,
        livingChildren, abortionsMiscarriages, historyOfCSection, historyOfPPH, historyOfPreEclampsia, historyOfStillbirth,
        preExistingDiabetes, preExistingHypertension, cardiacDisease, multipleGestation
      } = req.body;

      // Close any active pregnancies for this patient
      await prisma.ancPregnancy.updateMany({
        where: { tenantId, patientId, isActive: true },
        data: { isActive: false }
      });

      const newPregnancy = await prisma.ancPregnancy.create({
        data: {
          tenantId: tenantId!,
          patientId,
          gravidity,
          parity,
          lmp: lmp ? new Date(lmp) : null,
          edd: edd ? new Date(edd) : null,
          bloodGroup,
          husbandBloodGroup,
          livingChildren, abortionsMiscarriages, historyOfCSection, historyOfPPH, historyOfPreEclampsia, historyOfStillbirth,
          preExistingDiabetes, preExistingHypertension, cardiacDisease, multipleGestation,
          isActive: true
        }
      });

      res.status(201).json(newPregnancy);
    } catch (error: any) {
      console.error('createPregnancy error:', error);
      res.status(500).json({ message: getSafeErrorMessage(error, 'Failed to create ANC pregnancy') });
    }
  },

  updatePregnancyStatus: async (req: Request, res: Response) => {
    try {
      const { pregnancyId } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ message: 'Unauthorized' });
      const { isActive, outcome, deliveryDate } = req.body;

      const existing = await prisma.ancPregnancy.findFirst({ where: { id: pregnancyId, tenantId } });
      if (!existing) return res.status(404).json({ message: 'Pregnancy not found' });

      // Reactivating must close out any other active pregnancy for the same
      // patient first — createPregnancy already maintains this "only one
      // active pregnancy at a time" invariant; this is the only other writer
      // of isActive and must not be able to silently violate it.
      if (isActive === true) {
        await prisma.ancPregnancy.updateMany({
          where: { tenantId, patientId: existing.patientId, isActive: true, id: { not: pregnancyId } },
          data: { isActive: false }
        });
      }

      const updated = await prisma.ancPregnancy.update({
        where: { id: pregnancyId, tenantId },
        data: {
          ...(isActive !== undefined ? { isActive } : {}),
          ...(outcome !== undefined ? { outcome } : {}),
          ...(deliveryDate !== undefined ? { deliveryDate: deliveryDate ? new Date(deliveryDate) : null } : {}),
        }
      });

      res.status(200).json(updated);
    } catch (error: any) {
      console.error('updatePregnancyStatus error:', error);
      res.status(500).json({ message: getSafeErrorMessage(error, 'Failed to update pregnancy') });
    }
  },

  // -------------------------
  // ANC VISITS
  // -------------------------
  getVisitsByPregnancy: async (req: Request, res: Response) => {
    try {
      const { pregnancyId } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ message: 'Unauthorized' });

      const visits = await prisma.ancVisit.findMany({
        where: { tenantId, pregnancyId },
        orderBy: { createdAt: 'desc' },
        include: {
          recordedBy: { select: { firstName: true, lastName: true, role: true } }
        }
      });

      res.status(200).json(visits);
    } catch (error: any) {
      console.error('getVisitsByPregnancy error:', error);
      res.status(500).json({ message: getSafeErrorMessage(error, 'Failed to fetch ANC visits') });
    }
  },

  createVisit: async (req: Request, res: Response) => {
    try {
      const { pregnancyId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      if (!tenantId || !userId) return res.status(401).json({ message: 'Unauthorized' });

      // The FK alone only proves pregnancyId exists somewhere, not that it
      // belongs to this tenant — verify before attaching a visit to it.
      const pregnancy = await prisma.ancPregnancy.findFirst({
        where: { id: pregnancyId, tenantId },
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      if (!pregnancy) return res.status(404).json({ message: 'Pregnancy not found' });

      const {
        gestationalAgeWeeks,
        weight,
        systolicBP,
        diastolicBP,
        fundalHeight,
        fetalHeartRate,
        presentation,
        urineProtein,
        notes,
        others,
        ironFolicAcidProvided,
        calciumProvided,
        itnProvided,
        iptpDose,
        syphilisTestResult,
        hivTestResult,
        hepBTestResult,
        malariaRdtResult,
        ultrasoundDone,
        counselingDone,
        ttDosesToDate,
        ttDoseGivenToday,
        dewormingProvided,
        counseledOnDangerSigns,
        birthPreparednessPlanDiscussed,
        intimatePartnerViolenceScreening
      } = req.body;

      const visit = await prisma.ancVisit.create({
        data: {
          tenantId: tenantId!,
          pregnancyId,
          recordedById: userId!,
          gestationalAgeWeeks,
          weight,
          systolicBP,
          diastolicBP,
          fundalHeight,
          fetalHeartRate,
          presentation,
          urineProtein,
          notes,
          others,
          ironFolicAcidProvided,
          calciumProvided,
          itnProvided,
          iptpDose,
          syphilisTestResult,
          hivTestResult,
          hepBTestResult,
          malariaRdtResult,
          ultrasoundDone,
          counselingDone,
          ttDosesToDate,
          ttDoseGivenToday,
          dewormingProvided,
          counseledOnDangerSigns,
          birthPreparednessPlanDiscussed,
          intimatePartnerViolenceScreening
        },
        include: {
          recordedBy: { select: { firstName: true, lastName: true, role: true } }
        }
      });

      const dangerSigns = getAncVisitDangerSigns({ systolicBP, diastolicBP, urineProtein, fetalHeartRate });
      if (dangerSigns.length > 0) {
        const patientName = `${pregnancy.patient.firstName} ${pregnancy.patient.lastName}`;
        await notificationService.notifyRole(tenantId, ['DOCTOR', 'NURSE'], {
          type: 'ANC_VISIT_ALERT',
          severity: 'WARNING',
          title: 'ANC Visit Alert',
          message: `${patientName} — ${dangerSigns.join('; ')}`,
          entityType: 'AncVisit',
          entityId: visit.id,
        });
      }

      res.status(201).json(visit);
    } catch (error: any) {
      console.error('createVisit error:', error);
      res.status(500).json({ message: getSafeErrorMessage(error, 'Failed to record ANC visit') });
    }
  }
};
