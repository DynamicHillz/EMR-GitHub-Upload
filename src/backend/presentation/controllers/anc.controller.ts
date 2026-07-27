import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

const prisma = new PrismaClient();

export const ancController = {
  // -------------------------
  // ANC PREGNANCIES
  // -------------------------
  getActivePregnancies: async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

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
      const { isActive, outcome, deliveryDate } = req.body;

      const updated = await prisma.ancPregnancy.update({
        where: { id: pregnancyId, tenantId },
        data: {
          isActive,
          outcome,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null
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

      res.status(201).json(visit);
    } catch (error: any) {
      console.error('createVisit error:', error);
      res.status(500).json({ message: getSafeErrorMessage(error, 'Failed to record ANC visit') });
    }
  }
};
