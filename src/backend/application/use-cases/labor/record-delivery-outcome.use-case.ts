/**
 * Record Delivery Outcome Use Case
 *
 * Closes out a labor record with delivery details. If the labor record is
 * linked to an AncPregnancy, this also closes that pregnancy out
 * (isActive: false, deliveryDate, outcome) — the first real writer of those
 * fields outside the previously orphaned raw PUT /api/anc/pregnancies/:id.
 */

import { Gender, PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface RecordDeliveryOutcomeDto {
  deliveredAt?: Date;
  modeOfDelivery?: string;
  perineumStatus?: string;
  estimatedBloodLossMl?: number;
  babyOutcome?: string;
  babySex?: Gender;
  babyBirthWeightGrams?: number;
  apgarScore1Min?: number;
  apgarScore5Min?: number;
  resuscitationRequired?: boolean;
  deliveryNotes?: string;
}

export class RecordDeliveryOutcomeUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, laborRecordId: string, dto: RecordDeliveryOutcomeDto, deliveredById: string) {
    const laborRecord = await this.prisma.laborRecord.findFirst({
      where: { tenantId, id: laborRecordId, isDeleted: false },
    });
    if (!laborRecord) throw new NotFoundError('LaborRecord', laborRecordId);
    if (laborRecord.status !== 'IN_LABOR') {
      throw new ValidationError('Cannot record a delivery outcome — this labor record is not currently in progress');
    }

    const deliveredAt = dto.deliveredAt || new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.laborRecord.update({
        where: { id: laborRecordId },
        data: {
          status: 'DELIVERED',
          deliveredAt,
          deliveredById,
          modeOfDelivery: dto.modeOfDelivery,
          perineumStatus: dto.perineumStatus,
          estimatedBloodLossMl: dto.estimatedBloodLossMl,
          babyOutcome: dto.babyOutcome,
          babySex: dto.babySex,
          babyBirthWeightGrams: dto.babyBirthWeightGrams,
          apgarScore1Min: dto.apgarScore1Min,
          apgarScore5Min: dto.apgarScore5Min,
          resuscitationRequired: dto.resuscitationRequired || false,
          deliveryNotes: dto.deliveryNotes,
        },
      }),
      ...(laborRecord.pregnancyId
        ? [
            this.prisma.ancPregnancy.update({
              where: { id: laborRecord.pregnancyId },
              data: {
                isActive: false,
                deliveryDate: deliveredAt,
                outcome: dto.babyOutcome,
              },
            }),
          ]
        : []),
    ]);

    return { laborRecord: updated, pregnancyClosed: !!laborRecord.pregnancyId };
  }
}
