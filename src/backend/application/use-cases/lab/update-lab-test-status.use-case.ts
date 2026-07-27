/**
 * Update Lab Test Status Use Case
 *
 * Business logic for lab technicians to update test status
 * REQ-LAB-2: Allow lab technicians to update test status
 */

import { PrismaClient } from '@prisma/client';
import type { LabTestStatus } from '../../../shared/types/prisma-enums.ts';;

export interface UpdateLabTestStatusDto {
  status: LabTestStatus;
}

export class UpdateLabTestStatusUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    labTestId: string,
    dto: UpdateLabTestStatusDto,
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

    // Validate status transition
    this.validateStatusTransition(labTestRecord.status, dto.status);

    // Update status
    // @ts-ignore - Temporary fix for schema alignment
    await this.prisma.labTestRecord.update({
      where: {
        id: labTestId,
      },
      data: {
        status: dto.status,
      },
    });
  }

  /**
   * Validate status transitions
   * Ensures logical flow: PENDING -> IN_PROGRESS -> COMPLETED -> REVIEWED
   */
  private validateStatusTransition(
    currentStatus: LabTestStatus,
    newStatus: LabTestStatus
  ): void {
    // Cannot change status of REVIEWED or REJECTED tests
    if (currentStatus === 'REVIEWED') {
      throw new Error('Cannot change status of reviewed lab test');
    }

    if (currentStatus === 'REJECTED') {
      throw new Error('Cannot change status of rejected lab test');
    }

    // Define valid transitions. REVIEWED is deliberately NOT reachable from
    // here — this generic endpoint is LAB_TECH-gated (lab.routes.ts), and
    // REVIEWED must only ever be set via the DOCTOR-only review-lab-results
    // use-case (POST /tests/:id/review), which also stamps reviewedById/
    // reviewedAt. Allowing it here let a LAB_TECH self-approve their own
    // results, bypassing the doctor-review requirement entirely.
    const validTransitions: Record<LabTestStatus, LabTestStatus[]> = {
      PENDING: ['IN_PROGRESS', 'REJECTED'],
      IN_PROGRESS: ['COMPLETED', 'REJECTED'],
      COMPLETED: [], // -> REVIEWED only via review-lab-results.use-case.ts
      REVIEWED: [], // Cannot transition from REVIEWED
      CANCELLED: [], // Cannot transition from CANCELLED
      REJECTED: [], // Cannot transition from REJECTED
    };

    const allowedStatuses = validTransitions[currentStatus];

    if (!allowedStatuses.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }
}
