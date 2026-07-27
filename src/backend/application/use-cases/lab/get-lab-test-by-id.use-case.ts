/**
 * Get Lab Test By ID Use Case
 *
 * Business logic for retrieving a single lab test with full details
 */

import { PrismaClient } from '@prisma/client';
import { parseNumericRange } from '../../../shared/utils/lab-range.utils';

export interface LabTestDetailDto {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientAllergies: string[];
  patientChronicConditions: string[];
  testName: string;
  testCode: string;
  testCategory: string;
  clinicalIndication: string | null;
  urgency: string;
  status: string;
  orderedBy: string;
  orderedByName: string;
  consultationId: string | null;
  accessionNumber: string | null;
  unitPrice: number;
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
    // @ts-ignore - Temporary fix for schema alignment
    const labTestRecord = await this.prisma.labTestRecord.findFirst({
      where: {
        id: labTestId,
        tenantId,
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
          }
        },
        test: {
          include: {
            parameters: {
              include: {
                parameter: true
              },
              orderBy: {
                displayOrder: 'asc'
              }
            }
          }
        },
        resultValues: {
          include: {
            parameter: true
          }
        },
        reviewedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!labTestRecord) {
      throw new Error('Lab test not found');
    }

    // Calculate patient age
    const age = this.calculateAge(labTestRecord.order.patient.dateOfBirth);

    const isFemale = labTestRecord.order.patient.gender === 'FEMALE';

    // Format results to match frontend expectations
    const results = labTestRecord.resultValues.length > 0
      // @ts-ignore - Temporary fix for schema alignment
      ? labTestRecord.resultValues.map(rv => {
          const rawRange = isFemale ? rv.parameter.refRangeFemale : rv.parameter.refRangeMale;
          const { min, max } = parseNumericRange(rawRange);
          return {
            parameter: rv.parameter.name,
            loincCode: rv.parameter.loincCode,
            value: rv.textValue || (rv.numericValue !== null ? String(rv.numericValue) : ''),
            unit: rv.parameter.unit || '',
            jsonValue: rv.jsonValue || null,
            hasDeltaAlert: rv.hasDeltaAlert || false,
            deltaAlertNotes: rv.deltaAlertNotes || null,
            referenceMin: min,
            referenceMax: max,
            referenceRange: rawRange,
            severity: rv.flagType || null,
          };
        })
      : labTestRecord.test.parameters.map(tp => {
          const rawRange = isFemale ? tp.parameter.refRangeFemale : tp.parameter.refRangeMale;
          const { min, max } = parseNumericRange(rawRange);
          return {
            parameter: tp.parameter.name,
            loincCode: tp.parameter.loincCode,
            value: '',
            unit: tp.parameter.unit || '',
            jsonValue: null,
            hasDeltaAlert: false,
            deltaAlertNotes: null,
            referenceMin: min,
            referenceMax: max,
            referenceRange: rawRange,
          };
        });

    // @ts-ignore - Temporary fix for schema alignment
    const abnormalFlags = labTestRecord.resultValues
      .filter(rv => rv.isAbnormal)
      .map(rv => {
        const rawRange = isFemale ? rv.parameter.refRangeFemale : rv.parameter.refRangeMale;
        return {
          parameter: rv.parameter.name,
          value: rv.textValue || (rv.numericValue !== null ? String(rv.numericValue) : ''),
          referenceRange: rawRange || 'N/A',
          severity: rv.flagType || 'ABNORMAL',
        };
      });

    return {
      id: labTestRecord.id,
      patientId: labTestRecord.order.patientId,
      patientName: `${labTestRecord.order.patient.firstName} ${labTestRecord.order.patient.lastName}`,
      patientAge: age,
      patientGender: labTestRecord.order.patient.gender,
      patientAllergies: labTestRecord.order.patient.allergies || [],
      patientChronicConditions: labTestRecord.order.patient.chronicConditions || [],
      testName: labTestRecord.test.name,
      testCode: labTestRecord.test.loincCode || labTestRecord.test.name,
      testCategory: labTestRecord.test.category,
      clinicalIndication: labTestRecord.order.clinicalNotes,
      urgency: labTestRecord.order.urgency,
      status: labTestRecord.status,
      orderedBy: labTestRecord.order.orderedById,
      orderedByName: `${labTestRecord.order.orderedBy.firstName} ${labTestRecord.order.orderedBy.lastName}`,
      consultationId: labTestRecord.order.consultationId,
      accessionNumber: labTestRecord.accessionNumber,
      unitPrice: labTestRecord.unitPrice,
      specimenType: labTestRecord.specimenType,
      specimenQuality: labTestRecord.specimenQuality,
      collectedAt: labTestRecord.collectedAt?.toISOString() || null,
      rejectionReason: labTestRecord.rejectionReason,
      results: results,
      resultNotes: labTestRecord.reviewNotes,
      abnormalFlags: abnormalFlags.length > 0 ? abnormalFlags : null,
      referenceRanges: null,
      reviewedBy: labTestRecord.reviewedById,
      reviewedByName: labTestRecord.reviewedBy
        ? `${labTestRecord.reviewedBy.firstName} ${labTestRecord.reviewedBy.lastName}`
        : null,
      reviewedAt: labTestRecord.reviewedAt?.toISOString() || null,
      reviewNotes: labTestRecord.reviewNotes,
      createdAt: labTestRecord.createdAt.toISOString(),
      updatedAt: labTestRecord.updatedAt.toISOString(),
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
