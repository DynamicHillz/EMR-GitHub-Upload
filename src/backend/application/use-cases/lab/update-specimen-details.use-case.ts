/**
 * Update Specimen Details Use Case
 *
 * Business logic for tracking specimen collection, quality, and rejection
 * REQ-LAB-7: Track specimen collection, quality, and rejection reasons
 */

import { PrismaClient } from '@prisma/client';

export interface UpdateSpecimenDetailsDto {
  specimenType?: string;
  specimenQuality?: 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'REJECTED';
  collectedAt?: Date;
  rejectionReason?: string;
}

export class UpdateSpecimenDetailsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    labTestId: string,
    dto: UpdateSpecimenDetailsDto,
    tenantId: string
  ): Promise<void> {
    // Verify lab test exists
    // @ts-ignore - Temporary fix for schema alignment
    const labTestRecord = await this.prisma.labTestRecord.findFirst({
      where: {
        id: labTestId,
        tenantId,
      },
    });

    if (!labTestRecord) {
      throw new Error('Lab test not found');
    }

    // Validate that we're not updating a finalized test
    if (labTestRecord.status === 'REVIEWED') {
      throw new Error('Cannot update specimen details for reviewed lab test');
    }

    // Prepare update data
    const updateData: any = {};

    if (dto.specimenType !== undefined) {
      updateData.specimenType = dto.specimenType;
    }

    if (dto.specimenQuality !== undefined) {
      updateData.specimenQuality = dto.specimenQuality;

      // If specimen is rejected, update status and require rejection reason
      if (dto.specimenQuality === 'REJECTED') {
        if (!dto.rejectionReason) {
          throw new Error('Rejection reason is required when rejecting specimen');
        }
        updateData.status = 'REJECTED';
        updateData.rejectionReason = dto.rejectionReason;
      }
    }

    if (dto.collectedAt !== undefined) {
      updateData.collectedAt = dto.collectedAt;
    }

    if (dto.rejectionReason !== undefined) {
      updateData.rejectionReason = dto.rejectionReason;
    }

    // Update specimen details
    // @ts-ignore - Temporary fix for schema alignment
    await this.prisma.labTestRecord.update({
      where: {
        id: labTestId,
      },
      data: updateData,
    });
  }
}
