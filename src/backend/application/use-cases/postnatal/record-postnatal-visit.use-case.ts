/**
 * Record Postnatal Visit Use Case
 *
 * Records one WHO/Nigeria postnatal (PNC) contact — 24h / day 3 / week 1 /
 * week 6 — for the mother, with a folded-in set of newborn observations
 * (same flat-fields convention LaborRecord/PartographObservation already
 * use rather than routing through a separate newborn-visit model).
 *
 * Fires a staff notification on danger signs — mirrors
 * record-partograph-observation.use-case.ts's alerting pattern.
 */

import { PncContactType, PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { NotificationService } from '../../services/notification.service';

export interface RecordPostnatalVisitDto {
  pregnancyId?: string;
  // The PNC follow-up appointment this visit fulfills, if booked as one
  // (e.g. via 'Postnatal Follow-up' in BookAppointmentModal.tsx) — optional,
  // most visits today are still recorded ad hoc from the pregnancy view.
  appointmentId?: string;
  contactType: PncContactType;
  visitDate?: Date;
  maternalTemperature?: number;
  maternalSystolicBP?: number;
  maternalDiastolicBP?: number;
  lochiaStatus?: string;
  uterineInvolutionNormal?: boolean;
  perinealWoundStatus?: string;
  breastfeedingStatus?: string;
  moodScreeningConcern?: boolean;
  newbornWeightGrams?: number;
  newbornTemperature?: number;
  newbornFeedingWell?: boolean;
  cordConditionNormal?: boolean;
  jaundiceObserved?: boolean;
  newbornDangerSigns?: string[];
  familyPlanningCounselingDone?: boolean;
  notes?: string;
}

function getPostnatalDangerSigns(dto: RecordPostnatalVisitDto): string[] {
  const signs: string[] = [];
  if ((dto.maternalSystolicBP != null && dto.maternalSystolicBP >= 140) || (dto.maternalDiastolicBP != null && dto.maternalDiastolicBP >= 90)) {
    signs.push('maternal blood pressure is elevated');
  }
  if (dto.lochiaStatus === 'HEAVY' || dto.lochiaStatus === 'OFFENSIVE') {
    signs.push(`lochia is ${dto.lochiaStatus.toLowerCase()} — possible PPH/infection`);
  }
  if (dto.uterineInvolutionNormal === false) signs.push('uterine involution is not progressing normally');
  if (dto.perinealWoundStatus === 'INFECTED' || dto.perinealWoundStatus === 'BREAKDOWN') {
    signs.push(`perineal wound is ${dto.perinealWoundStatus.toLowerCase()}`);
  }
  if (dto.moodScreeningConcern) signs.push('mood screening flagged a concern');
  if (dto.newbornFeedingWell === false) signs.push('newborn is not feeding well');
  if (dto.jaundiceObserved) signs.push('jaundice observed in the newborn');
  if (dto.cordConditionNormal === false) signs.push('newborn cord condition is abnormal');
  if (dto.newbornDangerSigns && dto.newbornDangerSigns.length > 0) {
    signs.push(`newborn danger sign(s): ${dto.newbornDangerSigns.join(', ')}`);
  }
  return signs;
}

export class RecordPostnatalVisitUseCase {
  private notificationService: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.notificationService = new NotificationService(prisma);
  }

  async execute(tenantId: string, patientId: string, dto: RecordPostnatalVisitDto, recordedById: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { tenantId, id: patientId, isDeleted: false },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!patient) throw new NotFoundError('Patient', patientId);

    if (dto.pregnancyId) {
      const pregnancy = await this.prisma.ancPregnancy.findFirst({
        where: { tenantId, id: dto.pregnancyId, patientId },
      });
      if (!pregnancy) throw new ValidationError('Pregnancy not found for this patient');
    }

    const visit = await this.prisma.postnatalVisit.create({
      data: {
        tenantId,
        patientId,
        pregnancyId: dto.pregnancyId,
        appointmentId: dto.appointmentId,
        contactType: dto.contactType,
        visitDate: dto.visitDate || new Date(),
        recordedById,
        maternalTemperature: dto.maternalTemperature,
        maternalSystolicBP: dto.maternalSystolicBP,
        maternalDiastolicBP: dto.maternalDiastolicBP,
        lochiaStatus: dto.lochiaStatus,
        uterineInvolutionNormal: dto.uterineInvolutionNormal,
        perinealWoundStatus: dto.perinealWoundStatus,
        breastfeedingStatus: dto.breastfeedingStatus,
        moodScreeningConcern: dto.moodScreeningConcern,
        newbornWeightGrams: dto.newbornWeightGrams,
        newbornTemperature: dto.newbornTemperature,
        newbornFeedingWell: dto.newbornFeedingWell,
        cordConditionNormal: dto.cordConditionNormal,
        jaundiceObserved: dto.jaundiceObserved,
        newbornDangerSigns: dto.newbornDangerSigns || [],
        familyPlanningCounselingDone: dto.familyPlanningCounselingDone,
        notes: dto.notes,
      },
    });

    const dangerSigns = getPostnatalDangerSigns(dto);
    if (dangerSigns.length > 0) {
      const patientName = `${patient.firstName} ${patient.lastName}`;
      await this.notificationService.notifyRole(tenantId, ['DOCTOR', 'NURSE'], {
        type: 'POSTNATAL_VISIT_ALERT',
        severity: 'WARNING',
        title: 'Postnatal Visit Alert',
        message: `${patientName} — ${dangerSigns.join('; ')}`,
        entityType: 'PostnatalVisit',
        entityId: visit.id,
      });
    }

    return visit;
  }
}
