/**
 * Get Prescription Queue Use Case
 *
 * REQ-PHARM-1: Display prescription queue showing pending prescriptions for dispensing
 */

import { PrismaClient } from '@prisma/client';

export interface PrescriptionQueueFilters {
  status?: 'PENDING' | 'DISPENSED' | 'CANCELLED';
  search?: string;
  limit?: number;
  offset?: number;
  patientId?: string;
  billingStatus?: 'UNBILLED' | 'BILLED';
}

export interface PrescriptionQueueItem {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientDob: string;
  allergies: string[];
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  quantity: number | null;
  prescribedBy: string;
  prescribedByName: string;
  prescribedAt: string;
  allergyWarning: boolean;
  interactionWarning: boolean;
  status: string;
  clinicalIndication?: string;
  unitPrice?: number;
}

export class GetPrescriptionQueueUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    filters: PrescriptionQueueFilters,
    tenantId: string
  ): Promise<PrescriptionQueueItem[]> {
    // Build query conditions
    const where: any = {
      tenantId,
    };

    if (filters.status) {
      if (filters.status !== 'ALL' as any) {
        where.status = filters.status;
      }
    } else if (!filters.patientId) {
      // Default to pending prescriptions
      where.status = 'PENDING';
    }

    // Search filter
    if (filters.search) {
      where.OR = [
        {
          medicationName: {
            contains: filters.search,
            },
        },
        {
          patient: {
            OR: [
              {
                firstName: {
                  contains: filters.search,
                  },
              },
              {
                lastName: {
                  contains: filters.search,
                  },
              },
              {
                patientId: {
                  contains: filters.search,
                  },
              },
            ],
          },
        },
      ];
    }

    if (filters.billingStatus) {
      where.billingStatus = filters.billingStatus;
    }
    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    // Fetch prescriptions with patient and doctor info
    const prescriptions = await this.prisma.prescription.findMany({
      where,
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            allergies: true,
          },
        },
        doctor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        medication: {
          select: {
            unitPrice: true,
          },
        },
        consultation: {
          select: {
            subjective: true,
          },
        },
      },
      orderBy: [
        // Allergy warnings first
        { allergyWarning: 'desc' },
        // Interaction warnings next
        { interactionWarning: 'desc' },
        // Then by date (oldest first)
        { createdAt: 'asc' },
      ],
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });

    // Transform to DTO
    return prescriptions.map((prescription) => {
      const age = this.calculateAge(prescription.patient.dateOfBirth);

      return {
        id: prescription.id,
        patientId: prescription.patientId,
        patientName: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
        patientAge: age,
        patientGender: prescription.patient.gender,
        patientDob: prescription.patient.dateOfBirth.toISOString(),
        allergies: prescription.patient.allergies || [],
        medicationName: prescription.medicationName,
        dosage: prescription.dosage,
        frequency: prescription.frequency,
        duration: prescription.duration,
        instructions: prescription.instructions,
        quantity: prescription.quantity,
        prescribedBy: prescription.doctorId,
        prescribedByName: `${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
        prescribedAt: prescription.createdAt.toISOString(),
        allergyWarning: prescription.allergyWarning,
        interactionWarning: prescription.interactionWarning,
        status: prescription.status,
        unitPrice: prescription.medication ? Number(prescription.medication.unitPrice) : 0,
        clinicalIndication: prescription.consultation?.subjective
        ? prescription.consultation.subjective.substring(0, 80) + (prescription.consultation.subjective.length > 80 ? '...' : '')
        : undefined,
      };
    });
  }

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
