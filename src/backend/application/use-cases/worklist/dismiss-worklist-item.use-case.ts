/**
 * Dismiss Worklist Item Use Case
 *
 * Resolves a false-positive "due" item on either computed worklist
 * (immunization "overdue" or postnatal "due") without fabricating a
 * dose/visit that never happened — see WorklistDismissal in schema.prisma.
 * Shared by immunization.controller.ts (raw-Prisma style) and the
 * postnatal use-case module; the dismissal itself is generic enough that
 * one use-case can serve both call sites.
 */

import { PrismaClient, WorklistDismissalReason, WorklistType, PncContactType } from '@prisma/client';
import { ValidationError } from '../../../shared/errors/AppError';

export interface DismissWorklistItemDto {
  worklistType: WorklistType;
  patientId: string;
  scheduleId?: string;
  pregnancyId?: string;
  contactType?: PncContactType;
  reason: WorklistDismissalReason;
  reasonNotes?: string;
}

export class DismissWorklistItemUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, dto: DismissWorklistItemDto, dismissedById: string) {
    if (dto.worklistType === 'IMMUNIZATION_DUE' && !dto.scheduleId) {
      throw new ValidationError('scheduleId is required to dismiss an immunization due-item');
    }
    if (dto.worklistType === 'POSTNATAL_DUE' && !dto.contactType) {
      throw new ValidationError('contactType is required to dismiss a postnatal due-item');
    }

    return this.prisma.worklistDismissal.create({
      data: {
        tenantId,
        worklistType: dto.worklistType,
        patientId: dto.patientId,
        scheduleId: dto.scheduleId,
        pregnancyId: dto.pregnancyId,
        contactType: dto.contactType,
        reason: dto.reason,
        reasonNotes: dto.reasonNotes,
        dismissedById,
      },
    });
  }
}
