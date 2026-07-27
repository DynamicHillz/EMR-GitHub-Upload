/**
 * Record Partograph Observation Use Case
 *
 * Records one timestamped labor observation. Stamps activePhaseOnsetAt the
 * first time cervical dilation reaches 4cm, and checks the observation
 * against the WHO action line plus fetal-heart-rate/maternal-BP thresholds —
 * firing a role-wide notification when any of them trip. The clinician who
 * needs to act is whoever's covering Labor Ward right now, not necessarily
 * the admitting doctor, so this uses notifyRole() (like stock alerts) rather
 * than notify() on a single named recipient (like a lab result).
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { NotificationService } from '../../services/notification.service';

export interface RecordObservationDto {
  recordedAt?: Date;
  cervicalDilation?: number;
  fetalHeartRate?: number;
  descentOfHead?: string;
  liquor?: string;
  moulding?: string;
  contractionsFrequencyPer10Min?: number;
  contractionsDurationSeconds?: number;
  maternalPulse?: number;
  maternalSystolicBP?: number;
  maternalDiastolicBP?: number;
  maternalTemperature?: number;
  urineProtein?: string;
  urineAcetone?: string;
  urineVolumeMl?: number;
  oxytocinDose?: string;
  drugsGiven?: string;
  ivFluids?: string;
  notes?: string;
}

const MS_PER_HOUR = 60 * 60 * 1000;

// WHO partograph active-phase reference lines: alert line rises 1cm/hour from
// 4cm at active-phase onset; action line is parallel, 4 hours behind.
function computeActionLineCrossing(
  activePhaseOnsetAt: Date | null,
  observationTime: Date,
  dilation: number | undefined
): boolean {
  if (!activePhaseOnsetAt || dilation == null) return false;
  const elapsedHours = (observationTime.getTime() - activePhaseOnsetAt.getTime()) / MS_PER_HOUR;
  if (elapsedHours < 4) return false;
  const actionLineDilation = Math.min(10, 4 + (elapsedHours - 4) * 1);
  return dilation < actionLineDilation;
}

export class RecordPartographObservationUseCase {
  private notificationService: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.notificationService = new NotificationService(prisma);
  }

  async execute(tenantId: string, laborRecordId: string, dto: RecordObservationDto, recordedById: string) {
    const laborRecord = await this.prisma.laborRecord.findFirst({
      where: { tenantId, id: laborRecordId, isDeleted: false },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    if (!laborRecord) throw new NotFoundError('LaborRecord', laborRecordId);
    if (laborRecord.status !== 'IN_LABOR') {
      throw new ValidationError('Cannot record observations — labor is not currently in progress for this record');
    }

    const recordedAt = dto.recordedAt || new Date();

    const shouldStampActivePhase =
      !laborRecord.activePhaseOnsetAt && dto.cervicalDilation != null && dto.cervicalDilation >= 4;

    const crossesActionLine = computeActionLineCrossing(
      shouldStampActivePhase ? recordedAt : laborRecord.activePhaseOnsetAt,
      recordedAt,
      dto.cervicalDilation
    );
    const isAbnormalFHR = dto.fetalHeartRate != null && (dto.fetalHeartRate < 110 || dto.fetalHeartRate > 160);
    const isAbnormalBP =
      (dto.maternalSystolicBP != null && dto.maternalSystolicBP >= 140) ||
      (dto.maternalDiastolicBP != null && dto.maternalDiastolicBP >= 90);

    const [observation] = await this.prisma.$transaction([
      this.prisma.partographObservation.create({
        data: {
          tenantId,
          laborRecordId,
          recordedById,
          recordedAt,
          cervicalDilation: dto.cervicalDilation,
          fetalHeartRate: dto.fetalHeartRate,
          descentOfHead: dto.descentOfHead,
          liquor: dto.liquor,
          moulding: dto.moulding,
          contractionsFrequencyPer10Min: dto.contractionsFrequencyPer10Min,
          contractionsDurationSeconds: dto.contractionsDurationSeconds,
          maternalPulse: dto.maternalPulse,
          maternalSystolicBP: dto.maternalSystolicBP,
          maternalDiastolicBP: dto.maternalDiastolicBP,
          maternalTemperature: dto.maternalTemperature,
          urineProtein: dto.urineProtein,
          urineAcetone: dto.urineAcetone,
          urineVolumeMl: dto.urineVolumeMl,
          oxytocinDose: dto.oxytocinDose,
          drugsGiven: dto.drugsGiven,
          ivFluids: dto.ivFluids,
          notes: dto.notes,
        },
      }),
      ...(shouldStampActivePhase
        ? [this.prisma.laborRecord.update({ where: { id: laborRecordId }, data: { activePhaseOnsetAt: recordedAt } })]
        : []),
    ]);

    if (crossesActionLine || isAbnormalFHR || isAbnormalBP) {
      const patientName = `${laborRecord.patient.firstName} ${laborRecord.patient.lastName}`;
      const reasons: string[] = [];
      if (crossesActionLine) reasons.push('dilation has crossed the action line');
      if (isAbnormalFHR) reasons.push(`fetal heart rate ${dto.fetalHeartRate}bpm is outside normal range`);
      if (isAbnormalBP) reasons.push('maternal BP is elevated');

      await this.notificationService.notifyRole(tenantId, ['DOCTOR', 'NURSE'], {
        type: 'PARTOGRAPH_ALERT',
        title: 'Partograph Alert',
        message: `${patientName} — ${reasons.join('; ')}`,
        entityType: 'LaborRecord',
        entityId: laborRecordId,
      });
    }

    return observation;
  }
}
