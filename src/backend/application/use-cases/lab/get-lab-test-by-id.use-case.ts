/**
 * Get Lab Test By ID Use Case
 *
 * Business logic for retrieving a single lab test with full details
 */

import { PrismaClient } from '@prisma/client';

export interface LabTestDetailDto {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientAllergies: string[];
  patientChronicConditions: string[];
  testName: string;
  testCode: string | null;
  clinicalIndication: string | null;
  urgency: string;
  status: string;
  orderedBy: string;
  orderedByName: string;
  consultationId: string | null;
  specimenType: string | null;
  specimenQuality: string | null;
  collectedAt: string | null;
  rejectionReason: string | null;
  results: any;
  resultNotes: string | null;
  abnormalFlags: any;
  referenceRanges: any;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export class GetLabTestByIdUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(labTestId: string, tenantId: string): Promise<LabTestDetailDto> {
    const labTest = await this.prisma.labTest.findFirst({
      where: {
        id: labTestId,
        tenantId,
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            allergies: true,
            chronicConditions: true,
          },
        },
        orderedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        reviewedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!labTest) {
      throw new Error('Lab test not found');
    }

    // Calculate patient age
    const age = this.calculateAge(labTest.patient.dateOfBirth);

    return {
      id: labTest.id,
      patientId: labTest.patientId,
      patientName: `${labTest.patient.firstName} ${labTest.patient.lastName}`,
      patientAge: age,
      patientGender: labTest.patient.gender,
      patientAllergies: labTest.patient.allergies || [],
      patientChronicConditions: labTest.patient.chronicConditions || [],
      testName: labTest.testName,
      testCode: labTest.testCode,
      clinicalIndication: labTest.clinicalIndication,
      urgency: labTest.urgency,
      status: labTest.status,
      orderedBy: labTest.orderedById,
      orderedByName: `${labTest.orderedBy.firstName} ${labTest.orderedBy.lastName}`,
      consultationId: labTest.consultationId,
      specimenType: labTest.specimenType,
      specimenQuality: labTest.specimenQuality,
      collectedAt: labTest.collectedAt?.toISOString() || null,
      rejectionReason: labTest.rejectionReason,
      results: labTest.results ? JSON.parse(labTest.results) : null,
      resultNotes: labTest.resultNotes,
      abnormalFlags: labTest.abnormalFlags ? JSON.parse(labTest.abnormalFlags) : null,
      referenceRanges: labTest.referenceRanges
        ? JSON.parse(labTest.referenceRanges)
        : null,
      reviewedBy: labTest.reviewedById,
      reviewedByName: labTest.reviewedBy
        ? `${labTest.reviewedBy.firstName} ${labTest.reviewedBy.lastName}`
        : null,
      reviewedAt: labTest.reviewedAt?.toISOString() || null,
      reviewNotes: labTest.reviewNotes,
      createdAt: labTest.createdAt.toISOString(),
      updatedAt: labTest.updatedAt.toISOString(),
    };
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
