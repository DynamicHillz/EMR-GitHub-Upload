/**
 * Discontinue Labor Use Case
 *
 * Closes out a labor record as TRANSFERRED (patient moved to another
 * facility mid-labor) or DISCONTINUED (labor stopped for another clinical
 * reason) without a delivery outcome. These LaborStatus values existed in
 * the schema with no use-case ever setting them — the only way to close a
 * labor record was DELIVERED. That made discharging the admission a
 * dead end for the entirely normal scenario of a mid-labor transfer.
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface DiscontinueLaborDto {
  status: 'TRANSFERRED' | 'DISCONTINUED';
  reason: string;
}

export class DiscontinueLaborUseCase {
  constructor(private prisma: PrismaClient) {}

  // actorId isn't persisted — LaborRecord has no "closed out by" column, unlike
  // deliveredById for an actual delivery — kept in the signature only for
  // consistency with the other labor use-cases' execute(...) shape.
  async execute(tenantId: string, laborRecordId: string, dto: DiscontinueLaborDto, _actorId: string) {
    const laborRecord = await this.prisma.laborRecord.findFirst({
      where: { tenantId, id: laborRecordId, isDeleted: false },
    });
    if (!laborRecord) throw new NotFoundError('LaborRecord', laborRecordId);
    if (laborRecord.status !== 'IN_LABOR') {
      throw new ValidationError('Cannot discontinue — this labor record is not currently in progress');
    }

    return this.prisma.laborRecord.update({
      where: { id: laborRecordId },
      data: {
        status: dto.status,
        deliveryNotes: dto.reason,
      },
    });
  }
}
