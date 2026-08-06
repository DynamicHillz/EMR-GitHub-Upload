/**
 * Generate Invoice Use Case
 *
 * REQ-BILL-1: Automatically generate itemized invoices from completed services
 */

import { PrismaClient } from '@prisma/client';
import type { ServiceCategory } from '../../../shared/types/prisma-enums.ts';;
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface GenerateInvoiceDto {
  patientId: string;
  consultationIds?: string[];
  labTestIds?: string[];
  prescriptionIds?: string[];
  admissionIds?: string[];
  consumableUsageIds?: string[];
  transfusionChartIds?: string[];
  operationNoteIds?: string[];
  laborRecordIds?: string[];
  postnatalVisitIds?: string[];
  additionalItems?: {
    serviceName: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }[];
  discount?: number;
  notes?: string;
}

interface LineItem {
  serviceCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  subtotal: number;
  insuranceCoverage: number;
  patientOutOfPocket: number;
  consultationId?: string;
  prescriptionId?: string;
  labOrderId?: string;
  admissionId?: string;
  consumableUsageId?: string;
  transfusionChartId?: string;
  operationNoteId?: string;
  laborRecordId?: string;
  postnatalVisitId?: string;
}

// Shared "not already billed, not cancelled/deleted" guard for every billing
// source query below — keeps the four sub-queries from drifting out of sync
// with each other as new billing sources get added.
function notYetBilled(extra?: Record<string, any>) {
  return { isDeleted: false, ...extra };
}

export class GenerateInvoiceUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: GenerateInvoiceDto, tenantId: string, issuedById: string) {
    // Validate patient exists
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId }
    });

    if (!patient) {
      throw new NotFoundError('Patient', dto.patientId);
    }

    const lineItems: LineItem[] = [];

    // Get service catalog for pricing
    const serviceCatalog = await this.prisma.serviceCatalog.findMany({
      where: { tenantId, isActive: true }
    });

    const getServicePrice = (category: ServiceCategory, serviceName: string) => {
      const service = serviceCatalog.find(
        s => s.category === category && s.serviceName.toLowerCase().includes(serviceName.toLowerCase())
      );
      return service || null;
    };

    // HMO full coverage — this clinic doesn't enroll patients in a
    // copay-percentage plan; HMO membership is established once at
    // registration (Patient.hmoProviderId), and an HMO patient never pays
    // out of pocket at all. Checked first, ahead of exemptions/legacy
    // copay insurance, since whoever is actually responsible for payment
    // (the HMO) should always win.
    const hmoProvider = patient.hmoProviderId
      ? await this.prisma.insuranceProvider.findFirst({
          where: { id: patient.hmoProviderId, tenantId, isActive: true }
        })
      : null;
    const isHmoCovered = patient.patientType === 'HMO' && !!hmoProvider;

    // Legacy: a genuine partial-copay private insurer, tracked via a manual
    // PatientInsurance enrollment. Kept as a secondary path — never
    // auto-applied for an HMO-covered patient, since isHmoCovered above
    // already takes precedence.
    const activeInsurance = await this.prisma.patientInsurance.findFirst({
      where: {
        patientId: dto.patientId,
        tenantId,
        isActive: true,
        validFrom: { lte: new Date() },
        validTo: { gte: new Date() }
      }
    });

    // Check for Active Exemption Policies based on Age or Gender
    const exemptionPolicies = await this.prisma.exemptionPolicy.findMany({
      where: { tenantId, isActive: true }
    });

    // Calculate Age
    const ageInYears = patient.dateOfBirth ? (new Date().getTime() - new Date(patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 30;

    // Only check for an active pregnancy record if a PREGNANT exemption policy actually exists —
    // avoids the query on every invoice for tenants that don't use this exemption type.
    const hasPregnancyPolicy = exemptionPolicies.some(
      p => p.criteriaType === 'CONDITION' && p.criteriaValue === 'PREGNANT'
    );
    const activePregnancy = hasPregnancyPolicy
      ? await this.prisma.ancPregnancy.findFirst({
          where: { patientId: dto.patientId, tenantId, isActive: true }
        })
      : null;

    let applicableExemption: any = null;
    for (const policy of exemptionPolicies) {
      if (policy.criteriaType === 'AGE') {
        if (policy.criteriaValue === '<5' && ageInYears < 5) applicableExemption = policy;
        else if (policy.criteriaValue === '>65' && ageInYears > 65) applicableExemption = policy;
      } else if (policy.criteriaType === 'CONDITION') {
        if (policy.criteriaValue === 'PREGNANT' && activePregnancy) {
          applicableExemption = policy;
        }
      }
    }

    const calculateCoverage = (subtotal: number) => {
      let insuranceCoverage = 0;
      let patientOutOfPocket = subtotal;

      if (isHmoCovered) {
        // Full coverage — the HMO is billed for everything, the patient
        // pays nothing out of pocket.
        insuranceCoverage = subtotal;
        patientOutOfPocket = 0;
      } else if (applicableExemption) {
        insuranceCoverage = subtotal * (Number(applicableExemption.discountPercentage) / 100);
        patientOutOfPocket = subtotal - insuranceCoverage;
      } else if (activeInsurance) {
        // Legacy partial-copay path — copay percentage is what patient pays.
        const copay = subtotal * (Number(activeInsurance.copayPercentage) / 100);
        patientOutOfPocket = copay;
        insuranceCoverage = subtotal - copay;
      }
      return { insuranceCoverage, patientOutOfPocket };
    };

    // Add consultation services
    if (dto.consultationIds && dto.consultationIds.length > 0) {
      const consultations = await this.prisma.consultation.findMany({
        where: notYetBilled({
          id: { in: dto.consultationIds },
          tenantId,
          patientId: dto.patientId,
          status: 'COMPLETED'
        })
      });

      for (const consultation of consultations) {
        const service = getServicePrice('CONSULTATION', 'consultation');
        const unitPrice = Number(service?.basePrice || 5000); // Default price
        const taxRate = Number(service?.taxRate || 0);

        const subtotal = unitPrice + (unitPrice * (taxRate / 100));
        const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(subtotal);

        lineItems.push({
          serviceCode: 'CONSULTATION',
          // Invoice is a billing/financial document handed to the patient —
          // the treating doctor's identity doesn't belong on it (also keeps
          // this consistent with every other line item type, none of which
          // name a staff member).
          description: 'Consultation',
          quantity: 1,
          unitPrice,
          discount: 0,
          tax: unitPrice * (taxRate / 100),
          subtotal,
          insuranceCoverage,
          patientOutOfPocket,
          consultationId: consultation.id
        });
      }
    }

    // Add lab test services
    if (dto.labTestIds && dto.labTestIds.length > 0) {
      const labOrders = await this.prisma.labOrder.findMany({
        where: notYetBilled({
          id: { in: dto.labTestIds },
          tenantId,
          patientId: dto.patientId,
          billingStatus: 'UNBILLED',
          status: { not: 'CANCELLED' }
        }),
        include: {
          testRecords: {
            include: {
              test: true
            }
          }
        }
      });

      for (const order of labOrders) {
        for (const record of order.testRecords) {
          const serviceName = record.test.name;
          const service = getServicePrice('LAB_TEST', serviceName);
          const unitPrice = Number(service?.basePrice || 2000); // Default price
          const taxRate = Number(service?.taxRate || 0);

          const subtotal = unitPrice + (unitPrice * (taxRate / 100));
          const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(subtotal);

          lineItems.push({
            serviceCode: 'LAB_TEST',
            description: `Lab Test: ${serviceName}`,
            quantity: 1,
            unitPrice,
            discount: 0,
            tax: unitPrice * (taxRate / 100),
            subtotal,
            insuranceCoverage,
            patientOutOfPocket,
            labOrderId: order.id
          });
        }
      }
    }

    // Add medication services
    if (dto.prescriptionIds && dto.prescriptionIds.length > 0) {
      const prescriptions = await this.prisma.prescription.findMany({
        where: notYetBilled({
          id: { in: dto.prescriptionIds },
          tenantId,
          patientId: dto.patientId,
          status: { not: 'CANCELLED' },
          billingStatus: 'UNBILLED'
        }),
        include: {
          dispensingRecord: {
            include: {
              batch: {
                select: { sellingPrice: true }
              }
            }
          },
          medication: {
            select: { unitPrice: true }
          }
        }
      });

      for (const prescription of prescriptions) {
        const quantity = prescription.quantity || 1;
        let unitPrice = Number(prescription.dispensingRecord?.batch?.sellingPrice);
        if (!unitPrice || isNaN(unitPrice)) {
          unitPrice = prescription.medication?.unitPrice ? Number(prescription.medication.unitPrice) : 1000;
        }
        const taxRate = 0; // Medications typically tax-exempt in Nigeria
        const tax = unitPrice * (taxRate / 100);

        const subtotal = (unitPrice * quantity) + tax;
        const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(subtotal);

        lineItems.push({
          serviceCode: 'MEDICATION',
          description: `${prescription.medicationName} (${prescription.dosage} - ${prescription.frequency})`,
          quantity,
          unitPrice,
          discount: 0,
          tax: 0,
          subtotal,
          insuranceCoverage,
          patientOutOfPocket,
          prescriptionId: prescription.id
        });
      }
    }

    // Add consumable usage (syringes, gloves, gauze, cannula, etc.)
    if (dto.consumableUsageIds && dto.consumableUsageIds.length > 0) {
      const usageRecords = await this.prisma.consumableUsage.findMany({
        where: notYetBilled({
          id: { in: dto.consumableUsageIds },
          tenantId,
          patientId: dto.patientId,
          billingStatus: 'UNBILLED'
        }),
        include: {
          consumable: { select: { name: true, unitPrice: true } },
          batch: { select: { sellingPrice: true } }
        }
      });

      for (const usage of usageRecords) {
        const quantity = usage.quantityUsed;
        let unitPrice = Number(usage.batch?.sellingPrice);
        if (!unitPrice || isNaN(unitPrice)) {
          unitPrice = Number(usage.consumable.unitPrice);
        }
        const taxRate = 0;
        const tax = unitPrice * (taxRate / 100);

        const subtotal = (unitPrice * quantity) + tax;
        const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(subtotal);

        lineItems.push({
          serviceCode: 'CONSUMABLE',
          description: usage.consumable.name,
          quantity,
          unitPrice,
          discount: 0,
          tax: 0,
          subtotal,
          insuranceCoverage,
          patientOutOfPocket,
          consumableUsageId: usage.id
        });
      }
    }

    // Add blood transfusions — each row is already one blood unit/bag, so no
    // separate quantity field to multiply by (unlike consumables).
    if (dto.transfusionChartIds && dto.transfusionChartIds.length > 0) {
      const transfusions = await this.prisma.transfusionChart.findMany({
        where: notYetBilled({
          id: { in: dto.transfusionChartIds },
          tenantId,
          admission: { patientId: dto.patientId },
          billingStatus: 'UNBILLED'
        })
      });

      for (const transfusion of transfusions) {
        const service = getServicePrice('PROCEDURE', 'Blood Transfusion');
        const unitPrice = Number(service?.basePrice || 15000); // Default price
        const taxRate = Number(service?.taxRate || 0);

        const subtotal = unitPrice + (unitPrice * (taxRate / 100));
        const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(subtotal);

        lineItems.push({
          serviceCode: 'PROCEDURE',
          description: `Blood Transfusion — ${transfusion.productType} (Unit ${transfusion.unitNumber})`,
          quantity: 1,
          unitPrice,
          discount: 0,
          tax: unitPrice * (taxRate / 100),
          subtotal,
          insuranceCoverage,
          patientOutOfPocket,
          transfusionChartId: transfusion.id
        });
      }
    }

    // Add surgeries — priced by fuzzy-matching the recorded procedure name
    // against the Service Catalog, same mechanism already used for
    // consultations/lab tests, so cataloging named procedures (e.g.
    // "Appendectomy") gets them real pricing automatically.
    if (dto.operationNoteIds && dto.operationNoteIds.length > 0) {
      const operations = await this.prisma.operationNote.findMany({
        where: notYetBilled({
          id: { in: dto.operationNoteIds },
          tenantId,
          admission: { patientId: dto.patientId },
          billingStatus: 'UNBILLED'
        })
      });

      for (const operation of operations) {
        const service = getServicePrice('PROCEDURE', operation.surgicalProcedure);
        const unitPrice = Number(service?.basePrice || 50000); // Default price
        const taxRate = Number(service?.taxRate || 0);

        const subtotal = unitPrice + (unitPrice * (taxRate / 100));
        const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(subtotal);

        lineItems.push({
          serviceCode: 'PROCEDURE',
          description: `Surgery: ${operation.surgicalProcedure}`,
          quantity: 1,
          unitPrice,
          discount: 0,
          tax: unitPrice * (taxRate / 100),
          subtotal,
          insuranceCoverage,
          patientOutOfPocket,
          operationNoteId: operation.id
        });
      }
    }

    // Add labour & delivery — only billable once delivery is actually
    // recorded (mirrors Consultation requiring status COMPLETED). Cesarean
    // section is priced/matched separately from vaginal delivery since the
    // real-world cost difference is large.
    if (dto.laborRecordIds && dto.laborRecordIds.length > 0) {
      const laborRecords = await this.prisma.laborRecord.findMany({
        where: notYetBilled({
          id: { in: dto.laborRecordIds },
          tenantId,
          patientId: dto.patientId,
          status: 'DELIVERED',
          billingStatus: 'UNBILLED'
        })
      });

      for (const labor of laborRecords) {
        const isCesarean = labor.modeOfDelivery === 'CESAREAN_SECTION';
        const lookupName = isCesarean ? 'Cesarean Section' : 'Vaginal Delivery';
        const service = getServicePrice('PROCEDURE', lookupName);
        const unitPrice = Number(service?.basePrice || (isCesarean ? 40000 : 15000)); // Default price
        const taxRate = Number(service?.taxRate || 0);

        const subtotal = unitPrice + (unitPrice * (taxRate / 100));
        const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(subtotal);

        lineItems.push({
          serviceCode: 'PROCEDURE',
          description: `Labour & Delivery: ${labor.modeOfDelivery}`,
          quantity: 1,
          unitPrice,
          discount: 0,
          tax: unitPrice * (taxRate / 100),
          subtotal,
          insuranceCoverage,
          patientOutOfPocket,
          laborRecordId: labor.id
        });
      }
    }

    // Add postnatal (PNC) follow-up visits — same "only billable once
    // recorded, unbilled" gate as labor/delivery above.
    if (dto.postnatalVisitIds && dto.postnatalVisitIds.length > 0) {
      const postnatalVisits = await this.prisma.postnatalVisit.findMany({
        where: notYetBilled({
          id: { in: dto.postnatalVisitIds },
          tenantId,
          patientId: dto.patientId,
          billingStatus: 'UNBILLED'
        })
      });

      for (const visit of postnatalVisits) {
        const service = getServicePrice('PROCEDURE', 'postnatal');
        const unitPrice = Number(service?.basePrice || 5000); // Default price
        const taxRate = Number(service?.taxRate || 0);

        const subtotal = unitPrice + (unitPrice * (taxRate / 100));
        const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(subtotal);

        lineItems.push({
          serviceCode: 'PROCEDURE',
          description: `Postnatal Follow-up: ${visit.contactType}`,
          quantity: 1,
          unitPrice,
          discount: 0,
          tax: unitPrice * (taxRate / 100),
          subtotal,
          insuranceCoverage,
          patientOutOfPocket,
          postnatalVisitId: visit.id
        });
      }
    }

    // Add admission services (room charge + administered medications) — kept
    // in sync with InpatientService.getBillableAdmissions' pricing so the
    // billable-admissions preview and the actual invoice never disagree.
    if (dto.admissionIds && dto.admissionIds.length > 0) {
      // @ts-ignore - Temporary fix for schema alignment
      const admissions: any[] = await this.prisma.admission.findMany({
        where: notYetBilled({
          id: { in: dto.admissionIds },
          tenantId,
          patientId: dto.patientId,
          billingStatus: 'UNBILLED'
        }),
        include: {
          bed: {
            include: { ward: true }
          },
          medicationAdministrations: {
            where: { status: 'COMPLETED' }
          }
        }
      });

      const tenantForGrace = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { overstayGraceDays: true }
      });
      const graceDays = tenantForGrace?.overstayGraceDays ?? 2;

      for (const admission of admissions) {
        const msPerDay = 1000 * 60 * 60 * 24;
        const start = new Date(admission.admissionDate).getTime();
        const dischargeTime = admission.dischargeDate ? new Date(admission.dischargeDate).getTime() : null;
        // Bed-hold aware end boundary: for a discharged admission whose bed
        // is still held (Admission.bedClearedAt still null), billing must
        // reach all the way to now, not stop at the discharge date — that's
        // the whole point of overstay billing.
        const endBoundary = dischargeTime
          ? (admission.bedClearedAt ? new Date(admission.bedClearedAt).getTime() : Date.now())
          : Date.now();
        const unitPrice = admission.bed.ward.dailyCost || 0;

        if (unitPrice > 0) {
          if (dischargeTime && endBoundary > dischargeTime) {
            // Discharged, and the bed has been held past the discharge date
            // (possibly past the grace period too) — split into a normal
            // stay line (unchanged, capped at discharge) and a separately
            // labeled overstay line so the patient/cashier can see why the
            // bill grew after discharge, not just a bigger unexplained total.
            const normalDays = Math.max(1, Math.ceil((dischargeTime - start) / msPerDay));
            const graceCutoff = dischargeTime + graceDays * msPerDay;
            const overstayDays = endBoundary > graceCutoff
              ? Math.max(1, Math.ceil((endBoundary - graceCutoff) / msPerDay))
              : 0;

            const normalSubtotal = normalDays * unitPrice;
            const normalCoverage = calculateCoverage(normalSubtotal);
            lineItems.push({
              serviceCode: 'ACCOMMODATION',
              description: `Ward: ${admission.bed.ward.name} (Bed: ${admission.bed.bedNumber}) - ${normalDays} day(s) stay`,
              quantity: normalDays,
              unitPrice,
              discount: 0,
              tax: 0,
              subtotal: normalSubtotal,
              insuranceCoverage: normalCoverage.insuranceCoverage,
              patientOutOfPocket: normalCoverage.patientOutOfPocket,
              admissionId: admission.id
            });

            if (overstayDays > 0) {
              const overstaySubtotal = overstayDays * unitPrice;
              const overstayCoverage = calculateCoverage(overstaySubtotal);
              lineItems.push({
                serviceCode: 'ACCOMMODATION_OVERSTAY',
                description: `Overstay — bed held after discharge past ${graceDays}-day grace period - ${overstayDays} day(s)`,
                quantity: overstayDays,
                unitPrice,
                discount: 0,
                tax: 0,
                subtotal: overstaySubtotal,
                insuranceCoverage: overstayCoverage.insuranceCoverage,
                patientOutOfPocket: overstayCoverage.patientOutOfPocket,
                admissionId: admission.id
              });
            }
          } else {
            // Still admitted (ongoing stay) — unchanged from before.
            const days = Math.max(1, Math.ceil((endBoundary - start) / msPerDay));
            const subtotal = days * unitPrice;
            const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(subtotal);

            lineItems.push({
              serviceCode: 'ACCOMMODATION',
              description: `Ward: ${admission.bed.ward.name} (Bed: ${admission.bed.bedNumber}) - ${days} day(s) stay`,
              quantity: days,
              unitPrice,
              discount: 0,
              tax: 0,
              subtotal,
              insuranceCoverage,
              patientOutOfPocket,
              admissionId: admission.id
            });
          }
        }

        for (const medAdmin of admission.medicationAdministrations) {
          const medication = await this.prisma.medication.findFirst({
            where: { tenantId, name: medAdmin.medicationName }
          });
          const medUnitPrice = medication ? Number(medication.unitPrice) : 0;
          if (medUnitPrice <= 0) continue;

          const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(medUnitPrice);

          lineItems.push({
            serviceCode: 'MEDICATION',
            description: `Administered: ${medAdmin.medicationName} (${medAdmin.dosage})`,
            quantity: 1,
            unitPrice: medUnitPrice,
            discount: 0,
            tax: 0,
            subtotal: medUnitPrice,
            insuranceCoverage,
            patientOutOfPocket,
            admissionId: admission.id
          });
        }
      }
    }

    // Add additional manual items
    if (dto.additionalItems && dto.additionalItems.length > 0) {
      for (const item of dto.additionalItems) {
        const taxRate = item.taxRate || 0;
        const baseSubtotal = item.unitPrice * item.quantity;
        const taxAmount = baseSubtotal * (taxRate / 100);
        const subtotal = baseSubtotal + taxAmount;
        const { insuranceCoverage, patientOutOfPocket } = calculateCoverage(subtotal);

        lineItems.push({
          serviceCode: 'MISC',
          description: item.serviceName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: 0,
          tax: taxAmount,
          subtotal,
          insuranceCoverage,
          patientOutOfPocket
        });
      }
    }

    if (lineItems.length === 0) {
      throw new ValidationError('No billable services found');
    }

    // Calculate totals
    const taxAmount = lineItems.reduce((sum, item) => sum + item.tax, 0);
    const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0) - taxAmount; // back out tax for raw subtotal
    const discount = dto.discount || 0;
    const totalAmount = Number(subtotal) + Number(taxAmount) - Number(discount);
    
    // Balance is only what the patient owes out of pocket, OR total if no insurance
    const totalPatientOutOfPocket = lineItems.reduce((sum, item) => sum + item.patientOutOfPocket, 0);
    const totalInsuranceCoverage = lineItems.reduce((sum, item) => sum + item.insuranceCoverage, 0);
    
    // If there's a global discount, we subtract it from patient's out of pocket
    const balance = Math.max(0, totalPatientOutOfPocket - Number(discount));

    // A fully HMO-covered (or fully exempted) invoice has nothing left for
    // the patient to pay right from generation — it should read as PAID
    // immediately, not sit as UNPAID/ISSUED and clutter Outstanding
    // Balances for money nobody owes.
    const initialPaymentStatus: 'UNPAID' | 'PAID' = balance === 0 ? 'PAID' : 'UNPAID';
    const initialInvoiceStatus: 'ISSUED' | 'PAID' = balance === 0 ? 'PAID' : 'ISSUED';

    // Which provider is actually responsible for the insurance-covered
    // portion of this invoice, if any — the HMO tier takes the patient's
    // linked provider; the legacy copay tier takes the enrollment's provider.
    const coverageProviderId = isHmoCovered ? hmoProvider!.id : activeInsurance?.providerId;

    // Concurrency control: Execute updates and creation atomically
    const invoice = await this.prisma.$transaction(async (tx) => {
      // 1. Lock and Update statuses. Ensure they are still UNBILLED.
      if (dto.consultationIds?.length) {
        const updateResult = await tx.consultation.updateMany({
          where: { id: { in: dto.consultationIds }, tenantId, billingStatus: 'UNBILLED' },
          data: { billingStatus: 'BILLED' }
        });
        if (updateResult.count !== dto.consultationIds.length) {
          throw new ValidationError('One or more consultations have already been billed.');
        }
      }

      if (dto.labTestIds?.length) {
        const updateResult = await tx.labOrder.updateMany({
          where: { id: { in: dto.labTestIds }, tenantId, billingStatus: 'UNBILLED' },
          data: { billingStatus: 'BILLED' }
        });
        if (updateResult.count !== dto.labTestIds.length) {
          throw new ValidationError('One or more lab tests have already been billed.');
        }
      }

      if (dto.prescriptionIds?.length) {
        const updateResult = await tx.prescription.updateMany({
          where: { id: { in: dto.prescriptionIds }, tenantId, billingStatus: 'UNBILLED' },
          data: { billingStatus: 'BILLED' }
        });
        if (updateResult.count !== dto.prescriptionIds.length) {
          throw new ValidationError('One or more prescriptions have already been billed.');
        }
      }

      if (dto.consumableUsageIds?.length) {
        const updateResult = await tx.consumableUsage.updateMany({
          where: { id: { in: dto.consumableUsageIds }, tenantId, billingStatus: 'UNBILLED' },
          data: { billingStatus: 'BILLED' }
        });
        if (updateResult.count !== dto.consumableUsageIds.length) {
          throw new ValidationError('One or more consumable usage records have already been billed.');
        }
      }

      if (dto.admissionIds?.length) {
        const updateResult = await tx.admission.updateMany({
          where: { id: { in: dto.admissionIds }, tenantId, billingStatus: 'UNBILLED' },
          data: { billingStatus: 'BILLED' }
        });
        if (updateResult.count !== dto.admissionIds.length) {
          throw new ValidationError('One or more admissions have already been billed.');
        }
      }

      if (dto.transfusionChartIds?.length) {
        const updateResult = await tx.transfusionChart.updateMany({
          where: { id: { in: dto.transfusionChartIds }, tenantId, billingStatus: 'UNBILLED' },
          data: { billingStatus: 'BILLED' }
        });
        if (updateResult.count !== dto.transfusionChartIds.length) {
          throw new ValidationError('One or more transfusions have already been billed.');
        }
      }

      if (dto.operationNoteIds?.length) {
        const updateResult = await tx.operationNote.updateMany({
          where: { id: { in: dto.operationNoteIds }, tenantId, billingStatus: 'UNBILLED' },
          data: { billingStatus: 'BILLED' }
        });
        if (updateResult.count !== dto.operationNoteIds.length) {
          throw new ValidationError('One or more surgeries have already been billed.');
        }
      }

      if (dto.laborRecordIds?.length) {
        const updateResult = await tx.laborRecord.updateMany({
          where: { id: { in: dto.laborRecordIds }, tenantId, billingStatus: 'UNBILLED' },
          data: { billingStatus: 'BILLED' }
        });
        if (updateResult.count !== dto.laborRecordIds.length) {
          throw new ValidationError('One or more labor records have already been billed.');
        }
      }

      if (dto.postnatalVisitIds?.length) {
        const updateResult = await tx.postnatalVisit.updateMany({
          where: { id: { in: dto.postnatalVisitIds }, tenantId, billingStatus: 'UNBILLED' },
          data: { billingStatus: 'BILLED' }
        });
        if (updateResult.count !== dto.postnatalVisitIds.length) {
          throw new ValidationError('One or more postnatal visits have already been billed.');
        }
      }

      // 2. Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(tenantId);

      // 3. Create invoice with nested line items and audit log
      const createdInvoice = await tx.invoice.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          issuedById,
          invoiceNumber,
          invoiceDate: new Date(),
          subtotal,
          taxAmount,
          discount,
          totalAmount,
          paidAmount: 0,
          balance,
          paymentStatus: initialPaymentStatus,
          status: initialInvoiceStatus,
          notes: dto.notes,
          items: {
            create: lineItems as any
          },
          auditLogs: {
            create: {
              tenantId,
              userId: issuedById,
              action: 'CREATED',
              notes: 'Invoice generated',
              newValues: { totalAmount, balance, status: initialInvoiceStatus } as any
            }
          }
        },
        include: {
          items: true
        }
      });

      // 4. Auto-create Insurance Claim if coverage > 0 — against whichever
      // provider was actually responsible (HMO tier or legacy copay tier).
      if (totalInsuranceCoverage > 0 && coverageProviderId) {
        await tx.insuranceClaim.create({
          data: {
            tenantId,
            invoiceId: createdInvoice.id,
            insuranceId: coverageProviderId,
            amountClaimed: totalInsuranceCoverage,
            status: 'DRAFT'
          }
        });
      }

      return createdInvoice;
    });

    return invoice;
  }

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `INV-${year}${month}${day}`;

    // Count invoices created today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await this.prisma.invoice.count({
      where: {
        tenantId,
        invoiceDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${datePrefix}-${sequence}`;
  }
}
