/**
 * Record Delivery Outcome Use Case
 *
 * Closes out a labor record with delivery details. If the labor record is
 * linked to an AncPregnancy, this also closes that pregnancy out
 * (isActive: false, deliveryDate, outcome) — the first real writer of those
 * fields outside the previously orphaned raw PUT /api/anc/pregnancies/:id.
 *
 * On a live birth, also (unless explicitly opted out):
 * - Registers the newborn as their own Patient record, linked back via
 *   `motherPatientId` (self-relation) and `LaborRecord.newbornPatientId`, so
 *   immunization due-dates and future visits have somewhere to attach.
 *   `Patient.phone` is required + unique per tenant and a newborn has none,
 *   so a synthetic placeholder (`NEWBORN-XXXXXXXX`) is used — the same
 *   real-world workaround hospitals use ("Baby of Jane Doe") before formal
 *   birth registration; firstName/lastName/phone are all expected to be
 *   corrected later once the baby is named and registered.
 * - Creates a NextOfKin row on the newborn pointing at the mother.
 *
 * Singleton-birth assumption: every field here (babySex, birth weight,
 * APGAR, outcome) is single-valued. Twin/multiple-gestation deliveries would
 * need a one-row-per-baby redesign — out of scope for this model.
 *
 * Fires a staff notification on delivery danger signs (possible PPH,
 * stillbirth, low 5-minute APGAR, resuscitation required) — mirrors
 * record-partograph-observation.use-case.ts's alerting pattern. The on-screen
 * banner shown in DeliveryOutcomeModal is informational only and doesn't
 * reach anyone not looking at that screen; this notification is what does.
 */

import { randomBytes } from 'crypto';
import { Gender, PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors/AppError';
import { NotificationService } from '../../services/notification.service';
import { getPatientIdGenerator } from '../../../infrastructure/generators/patient-id.generator';

export interface RecordDeliveryOutcomeDto {
  deliveredAt?: Date;
  modeOfDelivery?: string;
  perineumStatus?: string;
  estimatedBloodLossMl?: number;
  babyOutcome?: string;
  babySex?: Gender;
  babyBirthWeightGrams?: number;
  apgarScore1Min?: number;
  apgarScore5Min?: number;
  resuscitationRequired?: boolean;
  deliveryNotes?: string;
  // Defaults to true on a live birth — pass false to skip newborn registration.
  registerNewbornAsPatient?: boolean;
}

const LOW_APGAR_THRESHOLD = 7;
const STILLBIRTH_OUTCOMES = ['STILLBIRTH_FRESH', 'STILLBIRTH_MACERATED'];

// WHO defines PPH as >=500mL for vaginal delivery but >=1000mL for cesarean
// — a flat 500mL threshold would false-alarm on every normal C-section.
function getPphThresholdMl(modeOfDelivery: string | undefined): number {
  return modeOfDelivery === 'CESAREAN_SECTION' ? 1000 : 500;
}

export interface NewbornPatientSummary {
  id: string;
  patientId: string;
}

export class RecordDeliveryOutcomeUseCase {
  private notificationService: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.notificationService = new NotificationService(prisma);
  }

  async execute(tenantId: string, laborRecordId: string, dto: RecordDeliveryOutcomeDto, deliveredById: string) {
    const laborRecord = await this.prisma.laborRecord.findFirst({
      where: { tenantId, id: laborRecordId, isDeleted: false },
      include: { patient: true },
    });
    if (!laborRecord) throw new NotFoundError('LaborRecord', laborRecordId);
    if (laborRecord.status !== 'IN_LABOR') {
      throw new ValidationError('Cannot record a delivery outcome — this labor record is not currently in progress');
    }

    const shouldRegisterNewborn = dto.babyOutcome === 'LIVE_BIRTH' && dto.registerNewbornAsPatient !== false;
    if (shouldRegisterNewborn && !dto.babySex) {
      throw new ValidationError('babySex is required to register the newborn as a patient');
    }

    const deliveredAt = dto.deliveredAt || new Date();

    // Generated ahead of the transaction, same non-transactional pattern
    // RegisterPatientUseCase already uses for MRN generation + uniqueness.
    const newbornMrn = shouldRegisterNewborn
      ? await getPatientIdGenerator(this.prisma).generatePatientId(tenantId)
      : undefined;
    const newbornPlaceholderPhone = shouldRegisterNewborn
      ? `NEWBORN-${randomBytes(4).toString('hex').toUpperCase()}`
      : undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      // Guarded update runs first, before any newborn registration, so a
      // genuine double-submit can't register two newborn Patient records
      // for one birth — the pre-transaction status check above is
      // non-atomic and can't prevent two concurrent requests both passing it.
      const laborUpdateResult = await tx.laborRecord.updateMany({
        where: { id: laborRecordId, tenantId, status: 'IN_LABOR' },
        data: {
          status: 'DELIVERED',
          deliveredAt,
          deliveredById,
          modeOfDelivery: dto.modeOfDelivery,
          perineumStatus: dto.perineumStatus,
          estimatedBloodLossMl: dto.estimatedBloodLossMl,
          babyOutcome: dto.babyOutcome,
          babySex: dto.babySex,
          babyBirthWeightGrams: dto.babyBirthWeightGrams,
          apgarScore1Min: dto.apgarScore1Min,
          apgarScore5Min: dto.apgarScore5Min,
          resuscitationRequired: dto.resuscitationRequired || false,
          deliveryNotes: dto.deliveryNotes,
        },
      });
      if (laborUpdateResult.count === 0) {
        throw new ConflictError('This delivery outcome was already recorded — please refresh and check its current status.');
      }

      let newbornPatient: NewbornPatientSummary | undefined;

      if (shouldRegisterNewborn) {
        const newborn = await tx.patient.create({
          data: {
            tenantId,
            patientId: newbornMrn!,
            firstName: 'Baby',
            lastName: laborRecord.patient.lastName,
            dateOfBirth: deliveredAt,
            gender: dto.babySex!,
            phone: newbornPlaceholderPhone!,
            address: laborRecord.patient.address,
            city: laborRecord.patient.city,
            state: laborRecord.patient.state,
            lga: laborRecord.patient.lga,
            motherPatientId: laborRecord.patientId,
          },
        });
        newbornPatient = { id: newborn.id, patientId: newborn.patientId };

        await tx.nextOfKin.create({
          data: {
            tenantId,
            patientId: newborn.id,
            fullName: `${laborRecord.patient.firstName} ${laborRecord.patient.lastName}`,
            relationship: 'MOTHER',
            phoneNumber: laborRecord.patient.phone,
            address: laborRecord.patient.address,
            priority: 1,
          },
        });

        // Inherit the mother's active insurance as a starting point — real
        // insurers often require the dependent to be separately registered
        // on the policy, so billing/front-desk should still verify this;
        // there's no notes field on PatientInsurance to flag that inline.
        const motherInsurances = await tx.patientInsurance.findMany({
          where: { tenantId, patientId: laborRecord.patientId, isActive: true, validTo: { gte: deliveredAt } },
        });
        for (const insurance of motherInsurances) {
          await tx.patientInsurance.create({
            data: {
              tenantId,
              patientId: newborn.id,
              providerId: insurance.providerId,
              policyNumber: insurance.policyNumber,
              groupNumber: insurance.groupNumber,
              planType: insurance.planType,
              copayPercentage: insurance.copayPercentage,
              validFrom: deliveredAt,
              validTo: insurance.validTo,
              isActive: true,
            },
          });
        }
      }

      const updatedLaborRecord = newbornPatient
        ? await tx.laborRecord.update({
            where: { id: laborRecordId },
            data: { newbornPatientId: newbornPatient.id },
          })
        : await tx.laborRecord.findUniqueOrThrow({ where: { id: laborRecordId } });

      if (laborRecord.pregnancyId) {
        await tx.ancPregnancy.update({
          where: { id: laborRecord.pregnancyId },
          data: {
            isActive: false,
            deliveryDate: deliveredAt,
            outcome: dto.babyOutcome,
          },
        });
      }

      return { laborRecord: updatedLaborRecord, newbornPatient };
    });

    const reasons: string[] = [];
    const pphThresholdMl = getPphThresholdMl(dto.modeOfDelivery);
    if (dto.estimatedBloodLossMl != null && dto.estimatedBloodLossMl >= pphThresholdMl) {
      reasons.push(`estimated blood loss ${dto.estimatedBloodLossMl}ml — possible PPH (threshold ${pphThresholdMl}ml for this delivery mode)`);
    }
    if (dto.babyOutcome && STILLBIRTH_OUTCOMES.includes(dto.babyOutcome)) {
      reasons.push('stillbirth outcome recorded');
    }
    if (dto.apgarScore5Min != null && dto.apgarScore5Min < LOW_APGAR_THRESHOLD) {
      reasons.push(`5-minute APGAR score ${dto.apgarScore5Min} is low`);
    }
    if (dto.resuscitationRequired) {
      reasons.push('neonatal resuscitation was required');
    }
    if (reasons.length > 0) {
      const patientName = `${laborRecord.patient.firstName} ${laborRecord.patient.lastName}`;
      await this.notificationService.notifyRole(tenantId, ['DOCTOR', 'NURSE'], {
        type: 'DELIVERY_ALERT',
        severity: 'CRITICAL',
        title: 'Delivery Outcome Alert',
        message: `${patientName} — ${reasons.join('; ')}`,
        entityType: 'LaborRecord',
        entityId: laborRecordId,
      });
    }

    return {
      laborRecord: result.laborRecord,
      pregnancyClosed: !!laborRecord.pregnancyId,
      newbornPatient: result.newbornPatient,
    };
  }
}
