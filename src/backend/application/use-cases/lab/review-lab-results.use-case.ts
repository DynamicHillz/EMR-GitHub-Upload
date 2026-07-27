/**
 * Review Lab Results Use Case
 *
 * Business logic for doctor review and approval of lab results
 * REQ-LAB-5: Require doctor review and approval before finalizing
 */

import { PrismaClient } from '@prisma/client';

export interface ReviewLabResultsDto {
  reviewNotes?: string;
  approved: boolean;
}

export class ReviewLabResultsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    labTestId: string,
    dto: ReviewLabResultsDto,
    doctorId: string,
    tenantId: string
  ): Promise<void> {
    // Verify lab test exists and is in correct status
    // @ts-ignore - Temporary fix for schema alignment
    const labTestRecord = await this.prisma.labTestRecord.findFirst({
      where: {
        id: labTestId,
        tenantId,
      },
      include: {
        resultValues: true
      }
    });

    if (!labTestRecord) {
      throw new Error('Lab test not found');
    }

    if (labTestRecord.status !== 'COMPLETED') {
      throw new Error('Can only review lab tests that are COMPLETED');
    }

    if (labTestRecord.resultValues.length === 0) {
      throw new Error('Cannot review lab test without results');
    }

    // Update lab test with review
    // @ts-ignore - Temporary fix for schema alignment
    await this.prisma.labTestRecord.update({
      where: {
        id: labTestId,
      },
      data: {
        reviewedById: doctorId,
        reviewedAt: new Date(),
        reviewNotes: dto.reviewNotes,
        status: dto.approved ? 'REVIEWED' : 'COMPLETED',
      },
    });
  }
}
