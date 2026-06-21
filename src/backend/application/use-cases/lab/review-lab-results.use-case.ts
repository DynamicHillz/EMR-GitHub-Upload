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
    const labTest = await this.prisma.labTest.findFirst({
      where: {
        id: labTestId,
        tenantId,
      },
    });

    if (!labTest) {
      throw new Error('Lab test not found');
    }

    if (labTest.status !== 'COMPLETED') {
      throw new Error('Can only review lab tests that are COMPLETED');
    }

    if (!labTest.results) {
      throw new Error('Cannot review lab test without results');
    }

    // Update lab test with review
    await this.prisma.labTest.update({
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
