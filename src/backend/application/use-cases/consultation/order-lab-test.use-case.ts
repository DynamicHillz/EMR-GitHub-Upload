/**
 * Order Lab Test Use Case
 *
 * Business logic for ordering lab tests from consultations
 * REQ-CLIN-4: Lab test ordering with clinical indication
 */

import { PrismaClient } from '@prisma/client';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { NotFoundError } from '../../../shared/errors/AppError';

export interface OrderLabTestDto {
  consultationId: string;
  patientId: string;
  testName: string;
  testCode?: string;
  clinicalIndication?: string;
  urgency?: 'ROUTINE' | 'URGENT' | 'STAT';
  specimenType?: string;
}

export interface LabTestResponseDto {
  id: string;
  consultationId: string | null;
  patientId: string;
  patientName: string;
  testName: string;
  testCode: string | null;
  clinicalIndication: string | null;
  urgency: string;
  specimenType: string | null;
  status: string;
  createdAt: string;
}

export class OrderLabTestUseCase {
  constructor(
    private prisma: PrismaClient,
    private patientRepository: IPatientRepository
  ) {}

  async execute(
    dto: OrderLabTestDto,
    doctorId: string,
    tenantId: string
  ): Promise<LabTestResponseDto> {
    // 1. Verify patient exists
    const patient = await this.patientRepository.findById(dto.patientId, tenantId);

    if (!patient) {
      throw new NotFoundError('Patient', dto.patientId);
    }

    // 2. Create lab test order
    const labTest = await this.prisma.labTest.create({
      data: {
        tenantId,
        patientId: dto.patientId,
        consultationId: dto.consultationId || null,
        orderedById: doctorId,
        testName: dto.testName,
        testCode: dto.testCode,
        clinicalIndication: dto.clinicalIndication,
        urgency: dto.urgency || 'ROUTINE',
        specimenType: dto.specimenType,
        status: 'PENDING',
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // 3. Return response
    return {
      id: labTest.id,
      consultationId: labTest.consultationId,
      patientId: labTest.patientId,
      patientName: `${labTest.patient.firstName} ${labTest.patient.lastName}`,
      testName: labTest.testName,
      testCode: labTest.testCode,
      clinicalIndication: labTest.clinicalIndication,
      urgency: labTest.urgency,
      specimenType: labTest.specimenType,
      status: labTest.status,
      createdAt: labTest.createdAt.toISOString(),
    };
  }
}
