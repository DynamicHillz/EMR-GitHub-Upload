/**
 * Start Labor Use Case
 *
 * Begins labor/partograph tracking for an active admission. Auto-links the
 * patient's currently active AncPregnancy when one exists on file — a
 * walk-in delivery with no antenatal record simply gets pregnancyId: null.
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface StartLaborDto {
  laborOnsetAt?: Date;
  onsetType?: string;
  romAt?: Date;
  romType?: string;
  liquorAtRom?: string;
  pregnancyId?: string;
}

export class StartLaborUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, admissionId: string, dto: StartLaborDto, startedById: string) {
    const admission = await this.prisma.admission.findFirst({
      where: { tenantId, id: admissionId },
    });
    if (!admission) throw new NotFoundError('Admission', admissionId);
    if (admission.status !== 'ADMITTED') {
      throw new ValidationError('Cannot start labor tracking on an admission that is not currently active');
    }

    const existing = await this.prisma.laborRecord.findFirst({
      where: { tenantId, admissionId, isDeleted: false },
    });
    if (existing) {
      throw new ValidationError('Labor tracking has already been started for this admission');
    }

    let pregnancyId = dto.pregnancyId;
    if (!pregnancyId) {
      const activePregnancy = await this.prisma.ancPregnancy.findFirst({
        where: { tenantId, patientId: admission.patientId, isActive: true },
        select: { id: true },
      });
      pregnancyId = activePregnancy?.id;
    }

    return this.prisma.laborRecord.create({
      data: {
        tenantId,
        admissionId,
        patientId: admission.patientId,
        pregnancyId,
        startedById,
        laborOnsetAt: dto.laborOnsetAt || new Date(),
        onsetType: dto.onsetType,
        romAt: dto.romAt,
        romType: dto.romType,
        liquorAtRom: dto.liquorAtRom,
        status: 'IN_LABOR',
      },
      include: { pregnancy: { select: { id: true } } },
    });
  }
}
