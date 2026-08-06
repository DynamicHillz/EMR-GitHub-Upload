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
  orderId: string;
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
  accessionNumber: string | null;
  unitPrice: number;
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
  skip?: number;
  patientId?: string;
  billingStatus?: 'UNBILLED' | 'BILLED';
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
      if (filters.status !== 'ALL' as any) {
        where.status = filters.status;
      }
    } else if (!filters?.patientId) {
      // By default, show PENDING and IN_PROGRESS tests
      where.status = {
        in: ['PENDING', 'IN_PROGRESS'],
      };
    }

    // Apply urgency filter
    if (filters?.urgency) {
      where.urgency = filters.urgency;
    }

    // Apply patientId filter
    if (filters?.patientId) {
      where.patientId = filters.patientId;
    }

    // Apply billingStatus filter
    if (filters?.billingStatus) {
      where.billingStatus = filters.billingStatus;
    }

    // Fetch lab tests
    // @ts-ignore - Temporary fix for schema alignment
    const labTestRecords = await this.prisma.labTestRecord.findMany({
      where: {
        tenantId,
        ...(filters?.status && filters.status !== 'ALL' as any ? { status: filters.status } : !filters?.patientId ? { status: { in: ['PENDING', 'IN_PROGRESS'] } } : {}),
        order: {
          ...(filters?.urgency ? { urgency: filters.urgency } : {}),
          ...(filters?.patientId ? { patientId: filters.patientId } : {}),
          ...(filters?.billingStatus ? { billingStatus: filters.billingStatus } : {})
        }
      },
      include: {
        order: {
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
          }
        },
        test: true
      },
      orderBy: [
        { order: { urgency: 'desc' } },
        { createdAt: 'asc' },
      ],
      take: filters?.limit,
      skip: filters?.skip,
    });

    // Calculate patient age and format response
    // @ts-ignore - Temporary fix for schema alignment
    return labTestRecords.map((record) => {
      const age = this.calculateAge(record.order.patient.dateOfBirth);

      return {
        id: record.id,
        orderId: record.orderId,
        patientId: record.order.patientId,
        patientName: `${record.order.patient.firstName} ${record.order.patient.lastName}`,
        patientAge: age,
        patientGender: record.order.patient.gender,
        testName: record.test.name,
        testCode: record.test.loincCode || record.test.name,
        clinicalIndication: record.order.clinicalNotes,
        urgency: record.order.urgency,
        status: record.status,
        orderedBy: record.order.orderedById,
        orderedByName: `${record.order.orderedBy.firstName} ${record.order.orderedBy.lastName}`,
        consultationId: record.order.consultationId,
        accessionNumber: record.accessionNumber,
        unitPrice: record.unitPrice,
        specimenType: record.specimenType,
        specimenQuality: record.specimenQuality,
        collectedAt: record.collectedAt?.toISOString() || null,
        rejectionReason: record.rejectionReason,
        createdAt: record.createdAt.toISOString(),
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
