/**
 * Order Lab Test Use Case
 *
 * Business logic for ordering lab tests from consultations
 * REQ-CLIN-4: Lab test ordering with clinical indication
 */

import { PrismaClient } from '@prisma/client';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface OrderLabTestDto {
  consultationId?: string;
  admissionId?: string;
  patientId: string;
  testId?: string;
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
  accessionNumber: string | null;
  unitPrice: number;
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

    // 1.5 Verify the consultation (when linked) actually belongs to this
    // tenant and this patient — the FK alone only proves the row exists
    // somewhere, not that it's the right one.
    if (dto.consultationId) {
      const consultation = await this.prisma.consultation.findFirst({
        where: { id: dto.consultationId, tenantId, isDeleted: false },
        select: { id: true, patientId: true },
      });
      if (!consultation) {
        throw new NotFoundError('Consultation', dto.consultationId);
      }
      if (consultation.patientId !== dto.patientId) {
        throw new ValidationError('Consultation does not belong to the specified patient');
      }
    }

    // 2. Find Lab Test — prefer the real catalog row by ID (set when the
    // clinician picked a panel from the Quick Select dropdown, which is the
    // only way to reliably land on a test that already has parameters/
    // reference ranges linked via LabTestParameter). Falling back to a
    // name match (not testCode, which is a LOINC code and won't match
    // LabTest.name) covers a manually-retyped exact name; only create a
    // brand-new ad-hoc entry for a genuinely custom, uncatalogued test.
    let labTest = null;
    if (dto.testId) {
      labTest = await this.prisma.labTest.findFirst({
        where: { tenantId, id: dto.testId }
      });
    }

    if (!labTest && dto.testName) {
      labTest = await this.prisma.labTest.findFirst({
        where: { tenantId, name: dto.testName }
      });
    }

    if (!labTest) {
      // Create a fallback test entry if it's a completely custom test not in catalog
      labTest = await this.prisma.labTest.create({
        data: {
          tenantId,
          name: dto.testName || dto.testCode || `CUSTOM-${Date.now()}`,
          category: 'Other',
        }
      });
    }

    // 3. Create lab test order and record in a transaction. accessionNumber
    // is a 4-digit random suffix on a globally-@unique column — a same-day
    // collision is non-trivial odds at real clinic volume, so retry once
    // with a freshly generated number rather than losing the whole order to
    // a generic 500. The retry re-runs the entire transaction (not just the
    // insert): a P2002 aborts the whole transaction, so the order created
    // earlier in the same failed attempt is already rolled back with it —
    // safe to just try again from scratch.
    const MAX_ACCESSION_ATTEMPTS = 2;
    let order: any;
    let record: any;
    for (let attempt = 1; attempt <= MAX_ACCESSION_ATTEMPTS; attempt++) {
      try {
        [order, record] = await this.prisma.$transaction(async (tx) => {
          // @ts-ignore - Temporary fix for schema alignment
          const newOrder = await tx.labOrder.create({
            data: {
              tenantId,
              patientId: dto.patientId,
              consultationId: dto.consultationId || null,
              admissionId: dto.admissionId || null,
              orderedById: doctorId,
              clinicalNotes: dto.clinicalIndication,
              urgency: dto.urgency || 'ROUTINE',
              status: 'PENDING',
              totalAmount: labTest.price || 0,
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

          // Generate unique Accession Number
          const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
          const randomPart = Math.floor(1000 + Math.random() * 9000);
          const accessionNumber = `LAB-${datePart}-${randomPart}`;

          // @ts-ignore - Temporary fix for schema alignment
          const newRecord = await tx.labTestRecord.create({
            data: {
              tenantId,
              orderId: newOrder.id,
              testId: labTest.id,
              specimenType: dto.specimenType,
              status: 'PENDING',
              accessionNumber: accessionNumber,
              unitPrice: labTest.price || 0,
            }
          });

          return [newOrder, newRecord];
        });
        break;
      } catch (err: any) {
        if (err.code === 'P2002' && attempt < MAX_ACCESSION_ATTEMPTS) {
          continue;
        }
        throw err;
      }
    }

    // 4. Return response matching frontend expectations
    return {
      id: record.id,
      consultationId: order.consultationId,
      patientId: order.patientId,
      patientName: `${order.patient.firstName} ${order.patient.lastName}`,
      testName: labTest.name,
      testCode: labTest.name,
      clinicalIndication: order.clinicalNotes,
      urgency: order.urgency,
      specimenType: record.specimenType,
      status: record.status,
      accessionNumber: record.accessionNumber,
      unitPrice: record.unitPrice,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
