/**
 * Get Lab Test Queue Use Case
 *
 * Business logic for retrieving pending lab test requests
 * REQ-LAB-1: Display pending lab tests sorted by urgency
 */

import { PrismaClient } from '@prisma/client';
import type { LabTestStatus, TestUrgency } from '../../../shared/types/prisma-enums.ts';;

export interface LabTestQueueDto {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  testName: string;
  testCode: string | null;
  clinicalIndication: string | null;
  urgency: TestUrgency;
  status: LabTestStatus;
  orderedBy: string;
  orderedByName: string;
  consultationId: string | null;
  specimenType: string | null;
  specimenQuality: string | null;
  collectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface LabTestQueueFilters {
  status?: LabTestStatus;
  urgency?: TestUrgency;
  limit?: number;
}

export class GetLabTestQueueUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    tenantId: string,
    filters?: LabTestQueueFilters
  ): Promise<LabTestQueueDto[]> {
    // Build where clause
    const where: any = {
      tenantId,
    };

    // Apply status filter
    if (filters?.status) {
      where.status = filters.status;
    } else {
      // By default, show PENDING and IN_PROGRESS tests
      where.status = {
        in: ['PENDING', 'IN_PROGRESS'],
      };
    }

    // Apply urgency filter
    if (filters?.urgency) {
      where.urgency = filters.urgency;
    }

    // Fetch lab tests
    const labTests = await this.prisma.labTest.findMany({
      where,
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        orderedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        // STAT (immediate) first, then URGENT, then ROUTINE
        {
          urgency: 'desc',
        },
        // Older tests first within same urgency
        {
          createdAt: 'asc',
        },
      ],
      take: filters?.limit,
    });

    // Calculate patient age and format response
    return labTests.map((test) => {
      const age = this.calculateAge(test.patient.dateOfBirth);

      return {
        id: test.id,
        patientId: test.patientId,
        patientName: `${test.patient.firstName} ${test.patient.lastName}`,
        patientAge: age,
        patientGender: test.patient.gender,
        testName: test.testName,
        testCode: test.testCode,
        clinicalIndication: test.clinicalIndication,
        urgency: test.urgency,
        status: test.status,
        orderedBy: test.orderedById,
        orderedByName: `${test.orderedBy.firstName} ${test.orderedBy.lastName}`,
        consultationId: test.consultationId,
        specimenType: test.specimenType,
        specimenQuality: test.specimenQuality,
        collectedAt: test.collectedAt?.toISOString() || null,
        rejectionReason: test.rejectionReason,
        createdAt: test.createdAt.toISOString(),
      };
    });
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }
}
