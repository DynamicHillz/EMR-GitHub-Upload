import { prisma } from '../../infrastructure/database/prisma.client';
import { NotificationService } from '../../application/services/notification.service';
import { checkDrugInteractions, checkDuplicateTherapy } from '../../application/services/drug-interaction-checker.service';
import { checkForAllergies, findMatchingAllergies } from '../../application/services/allergy-checker.service';

// Mirrors VitalChartTab.tsx's VITAL_THRESHOLDS — kept in sync so a value the
// UI already flags in red also reaches an on-call notification, not just the
// screen the recorder happens to be looking at.
const VITAL_ALERT_THRESHOLDS: { label: string; test: (r: any) => boolean }[] = [
  { label: 'Low SpO2', test: (r) => r.spO2 != null && r.spO2 < 92 },
  { label: 'High Temp', test: (r) => r.temperature != null && r.temperature > 39 },
  { label: 'Low Temp', test: (r) => r.temperature != null && r.temperature < 35 },
  { label: 'High HR', test: (r) => r.heartRate != null && r.heartRate > 120 },
  { label: 'Low HR', test: (r) => r.heartRate != null && r.heartRate < 50 },
  { label: 'Low BP', test: (r) => r.systolicBP != null && r.systolicBP < 90 },
  { label: 'High BP', test: (r) => r.systolicBP != null && r.systolicBP > 180 },
];

export class InpatientService {
  private notificationService = new NotificationService(prisma);

  // Defaults to ACTIVE (matches every existing caller, including the
  // admission/transfer bed pickers) — pass status: 'INACTIVE' to list
  // deleted wards instead, so they're not permanently invisible once
  // deleteWard() soft-deletes them.
  async getWards(tenantId: string, status: string = 'ACTIVE') {
    // @ts-ignore - Temporary fix for schema alignment
    return prisma.ward.findMany({
      where: { tenantId, status },
      include: {
        beds: {
          include: {
            admissions: {
              where: { status: 'ADMITTED' },
              include: {
                patient: true
              }
            }
          }
        }
      }
    });
  }

  // Inverse of deleteWard — the missing half of that soft delete. Without
  // this, an INACTIVE ward had no path back to ACTIVE anywhere in the app.
  async reactivateWard(tenantId: string, wardId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    const ward = await prisma.ward.findFirst({ where: { tenantId, id: wardId } });
    if (!ward) throw new Error('Ward not found');
    // @ts-ignore - Temporary fix for schema alignment
    if (ward.status !== 'INACTIVE') throw new Error('Only a deleted (inactive) ward can be reactivated');

    // @ts-ignore - Temporary fix for schema alignment
    return prisma.ward.update({
      where: { id: wardId },
      data: { status: 'ACTIVE' }
    });
  }

  async createWard(tenantId: string, data: any) {
    return prisma.$transaction(async (tx) => {
      // @ts-ignore - Temporary fix for schema alignment
      const ward = await tx.ward.create({
        data: {
          tenantId,
          name: data.name,
          type: data.type,
          capacity: data.capacity,
          dailyCost: data.dailyCost,
        }
      });

      const bedsData = Array.from({ length: data.capacity }).map((_, i) => ({
        tenantId,
        wardId: ward.id,
        bedNumber: `Bed ${i + 1}`,
        status: 'AVAILABLE'
      }));

      // @ts-ignore - Temporary fix for schema alignment
      await tx.bed.createMany({ data: bedsData });
      return ward;
    });
  }

  async updateWard(tenantId: string, wardId: string, data: any) {
    return prisma.$transaction(async (tx) => {
      // @ts-ignore - Temporary fix for schema alignment
      const ward = await tx.ward.findFirst({ where: { tenantId, id: wardId }, include: { beds: true } });
      if (!ward) throw new Error('Ward not found');

      if (data.capacity && data.capacity !== ward.capacity) {
        if (data.capacity < ward.capacity) {
          const diff = ward.capacity - data.capacity;
          const bedsToDelete = [...ward.beds].sort((a, b) => b.bedNumber.localeCompare(a.bedNumber, undefined, { numeric: true })).slice(0, diff);
          for (const b of bedsToDelete) {
            if (b.status === 'OCCUPIED') throw new Error('Cannot reduce capacity: a bed to be removed is occupied.');
          }

          // A bed can be AVAILABLE right now yet still have historical
          // Admission/BedTransferHistory rows pointing at it — deleting it
          // would otherwise hit an unhandled FK-constraint error instead of
          // a clean message, since neither relation cascades on delete.
          const bedIdsToDelete = bedsToDelete.map(b => b.id);
          // @ts-ignore - Temporary fix for schema alignment
          const admissionHistoryCount = await tx.admission.count({ where: { bedId: { in: bedIdsToDelete } } });
          if (admissionHistoryCount > 0) {
            throw new Error('Cannot reduce capacity: one or more beds to be removed have admission history and cannot be deleted. Mark them as MAINTENANCE instead.');
          }
          // @ts-ignore - Temporary fix for schema alignment
          const transferHistoryCount = await tx.bedTransferHistory.count({
            where: { OR: [{ fromBedId: { in: bedIdsToDelete } }, { toBedId: { in: bedIdsToDelete } }] }
          });
          if (transferHistoryCount > 0) {
            throw new Error('Cannot reduce capacity: one or more beds to be removed have transfer history and cannot be deleted. Mark them as MAINTENANCE instead.');
          }

          // @ts-ignore - Temporary fix for schema alignment
          await tx.bed.deleteMany({ where: { id: { in: bedIdsToDelete } } });
        } else {
          const diff = data.capacity - ward.capacity;
          const currentCount = ward.capacity;
          const newBeds = Array.from({ length: diff }).map((_, i) => ({
            tenantId,
            wardId: ward.id,
            bedNumber: `Bed ${currentCount + i + 1}`,
            status: 'AVAILABLE'
          }));
          // @ts-ignore - Temporary fix for schema alignment
          await tx.bed.createMany({ data: newBeds });
        }
      }

      // @ts-ignore - Temporary fix for schema alignment
      return tx.ward.update({
        where: { id: wardId },
        data: {
          name: data.name,
          type: data.type,
          capacity: data.capacity,
          dailyCost: data.dailyCost
        }
      });
    });
  }

  async deleteWard(tenantId: string, wardId: string) {
    return prisma.$transaction(async (tx) => {
      // @ts-ignore - Temporary fix for schema alignment
      const ward = await tx.ward.findFirst({ where: { tenantId, id: wardId }, include: { beds: true } });
      if (!ward) throw new Error('Ward not found');

      // @ts-ignore - Temporary fix for schema alignment
      const hasOccupied = ward.beds.some(b => b.status === 'OCCUPIED');
      if (hasOccupied) throw new Error('Cannot delete ward with occupied beds.');

      // @ts-ignore - Temporary fix for schema alignment
      return tx.ward.update({
        where: { id: wardId },
        data: { status: 'INACTIVE' }
      });
    });
  }

  async getAdmissions(tenantId: string, status?: string) {
    const where: any = { tenantId, isDeleted: false };
    if (status) where.status = status;

    // @ts-ignore - Temporary fix for schema alignment
    return prisma.admission.findMany({
      where,
      include: {
        patient: true,
        bed: {
          include: { ward: true }
        },
        diagnoses: {
          include: { diagnosis: true }
        },
        dischargeSummary: true,
        admittedBy: { select: { firstName: true, lastName: true, role: true } },
        wardRounds: {
          where: { isDeleted: false },
          orderBy: { roundDate: 'desc' },
          take: 1,
          select: { roundDate: true }
        }
      },
      orderBy: { admissionDate: 'desc' }
    });
  }

  async getAdmissionById(tenantId: string, admissionId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({
      where: { tenantId, id: admissionId, isDeleted: false },
      include: {
        patient: true,
        bed: {
          include: { ward: true }
        },
        admittedBy: { select: { firstName: true, lastName: true, role: true } },
        wardRounds: {
          where: { isDeleted: false },
          orderBy: { roundDate: 'desc' },
          include: {
            conductedBy: { select: { firstName: true, lastName: true, role: true } }
          }
        },
        medicationAdministrations: {
          orderBy: { administeredAt: 'desc' },
          include: {
            administeredBy: { select: { firstName: true, lastName: true, role: true } },
            prescription: true
          }
        },
        // The actual orders (not the dosing log above) — needed so the
        // Overview tab can flag a medication that was just started/stopped,
        // not just show what's been administered.
        prescriptions: {
          orderBy: { createdAt: 'desc' }
        },
        diagnoses: {
          include: { diagnosis: true }
        },
        dischargeSummary: true,
        transferHistory: {
          orderBy: { transferDate: 'desc' },
          include: {
            fromBed: { include: { ward: true } },
            toBed: { include: { ward: true } },
            transferredBy: { select: { firstName: true, lastName: true, role: true } }
          }
        },
        vitalCharts: {
          where: { isDeleted: false },
          orderBy: { recordedAt: 'desc' },
          take: 1
        }
      }
    });

    if (!admission) throw new Error('Admission not found');
    return admission;
  }

  async getAdmissionsByPatientId(tenantId: string, patientId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    return prisma.admission.findMany({
      where: { tenantId, patientId, isDeleted: false },
      include: {
        bed: {
          include: { ward: true }
        },
        admittedBy: { select: { firstName: true, lastName: true, role: true } },
        wardRounds: {
          where: { isDeleted: false },
          orderBy: { roundDate: 'desc' },
          include: {
            conductedBy: { select: { firstName: true, lastName: true, role: true } }
          }
        },
        medicationAdministrations: {
          orderBy: { administeredAt: 'desc' },
          include: {
            administeredBy: { select: { firstName: true, lastName: true, role: true } },
            prescription: true
          }
        }
      },
      orderBy: { admissionDate: 'desc' }
    });
  }

  async updateBed(tenantId: string, bedId: string, data: any) {
    // @ts-ignore - Temporary fix for schema alignment
    const bed = await prisma.bed.findFirst({
      where: { tenantId, id: bedId }
    });
    if (!bed) throw new Error('Bed not found');

    let status = bed.status;
    if (data.status && data.status !== bed.status) {
      if (bed.status === 'OCCUPIED') {
        throw new Error('Cannot change status of an occupied bed — discharge or transfer the patient first');
      }
      // AVAILABLE/OCCUPIED are only ever set by the admit/discharge/transfer
      // workflow itself — this endpoint only toggles the maintenance flag.
      if (data.status !== 'AVAILABLE' && data.status !== 'MAINTENANCE') {
        throw new Error('Bed status can only be set to AVAILABLE or MAINTENANCE here');
      }
      status = data.status;
    }

    // @ts-ignore - Temporary fix for schema alignment
    return prisma.bed.update({
      where: { id: bedId },
      data: {
        bedNumber: data.bedNumber,
        type: data.type,
        status
      }
    });
  }

  async admitPatient(tenantId: string, data: any, userId: string) {
    const {
      patientId,
      bedId,
      reason,
      notes,
      isolationRequired,
      infectionRisk,
      primaryDiagnosisId,
      admissionType,
      showOperationNote,
      showPartograph,
    } = data;

    // Check if patient already admitted
    // @ts-ignore - Temporary fix for schema alignment
    const existing = await prisma.admission.findFirst({
      where: { tenantId, patientId, status: 'ADMITTED' }
    });
    if (existing) throw new Error('Patient is already admitted to a bed');

    // Check if bed is available — and that its ward hasn't been deleted.
    // Unreachable through the normal admission picker (it only ever lists
    // ACTIVE wards' beds), but a direct API call with a stale bed ID from a
    // deleted ward should still be rejected rather than silently admitting
    // into it.
    // @ts-ignore - Temporary fix for schema alignment
    const bed = await prisma.bed.findFirst({
      where: { tenantId, id: bedId },
      include: { ward: { select: { status: true } } }
    });
    if (!bed || bed.status !== 'AVAILABLE') throw new Error('Bed is not available');
    // @ts-ignore - Temporary fix for schema alignment
    if (bed.ward.status !== 'ACTIVE') throw new Error('Bed belongs to a ward that is no longer active');

    // Create admission transaction
    const admission = await prisma.$transaction(async (tx) => {
      // @ts-ignore - Temporary fix for schema alignment
      const newAdmission = await tx.admission.create({
        data: {
          tenantId,
          patientId,
          bedId,
          admittedById: userId,
          reason,
          notes,
          status: 'ADMITTED',
          isolationRequired: !!isolationRequired,
          infectionRisk,
          admissionType: admissionType || 'MEDICAL',
          showOperationNote: !!showOperationNote,
          showPartograph: !!showPartograph
        }
      });

      // Re-check availability inside the transaction, not just before it —
      // closes the race where two concurrent admissions both pass the
      // earlier check and both try to claim the same bed.
      // @ts-ignore - Temporary fix for schema alignment
      const bedUpdateResult = await tx.bed.updateMany({
        where: { id: bedId, tenantId, status: 'AVAILABLE' },
        data: { status: 'OCCUPIED' }
      });
      if (bedUpdateResult.count === 0) {
        throw new Error('Bed is no longer available — it may have just been assigned to another patient');
      }

      if (primaryDiagnosisId) {
        // Either owned by this tenant, or a shared/global reference row
        // (tenantId: null — see seed-icd10-catalog.ts) usable by every tenant.
        // @ts-ignore - Temporary fix for schema alignment
        const diagnosis = await tx.diagnosisCatalog.findFirst({
          where: { id: primaryDiagnosisId, OR: [{ tenantId }, { tenantId: null }] }
        });
        if (!diagnosis) throw new Error('Selected diagnosis not found');

        // @ts-ignore - Temporary fix for schema alignment
        await tx.admissionDiagnosis.create({
          data: {
            tenantId,
            admissionId: newAdmission.id,
            diagnosisId: primaryDiagnosisId,
            isPrimary: true,
            isAdmission: true
          }
        });
      }

      return newAdmission;
    });

    return admission;
  }

  // Lets admissionType/showOperationNote/showPartograph be changed any time
  // during the stay — not just at intake — since e.g. a MEDICAL admission
  // can turn into a surgery partway through (see AdmissionModal/OverviewTab).
  async updateAdmissionSettings(tenantId: string, admissionId: string, data: any) {
    const { admissionType, showOperationNote, showPartograph, showOxygen } = data;

    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({ where: { id: admissionId, tenantId } });
    if (!admission) throw new Error('Admission not found');

    // @ts-ignore - Temporary fix for schema alignment
    return prisma.admission.update({
      where: { id: admissionId },
      data: {
        ...(admissionType !== undefined ? { admissionType } : {}),
        ...(showOperationNote !== undefined ? { showOperationNote: !!showOperationNote } : {}),
        ...(showPartograph !== undefined ? { showPartograph: !!showPartograph } : {}),
        ...(showOxygen !== undefined ? { showOxygen: !!showOxygen } : {}),
      }
    });
  }

  async dischargePatient(tenantId: string, admissionId: string, data: any, userId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({
      where: { tenantId, id: admissionId, status: 'ADMITTED' },
      include: { patient: { select: { allergies: true } } }
    });
    if (!admission) throw new Error('Active admission not found');

    // Discharging while labor is still open would silently lose the birth
    // record — no delivery outcome would ever be recorded for this
    // admission. If the patient was genuinely transferred out mid-labor
    // (not delivered here), close the labor record out first via
    // POST /api/labor/records/:laborRecordId/discontinue (TRANSFERRED or
    // DISCONTINUED), which is the real escape hatch for that scenario.
    const openLaborRecord = await prisma.laborRecord.findFirst({
      where: { tenantId, admissionId, status: 'IN_LABOR', isDeleted: false }
    });
    if (openLaborRecord) {
      throw new Error(
        'Cannot discharge — labor is still in progress for this admission. Record the delivery outcome, or mark the labor record as transferred/discontinued, first.'
      );
    }

    // Precompute allergy/interaction/duplicate-therapy warnings for every TTO
    // (to-take-out) medication before opening the transaction — same
    // REQ-CLIN-7 checks CreatePrescriptionUseCase and addWardRound's
    // medication-ADD path already enforce; discharge prescriptions were
    // previously the one remaining place a Prescription got created with
    // none of these checks at all.
    const ttoPrescriptions: any[] = Array.isArray(data.prescriptions) ? data.prescriptions : [];
    const patientAllergies = admission.patient.allergies || [];
    const ttoWarnings: Array<{
      medicationName: string;
      allergyWarning: boolean;
      allergyDetails: string[];
      interactionWarning: boolean;
      interactionDetails: string[];
      duplicateWarning: boolean;
      duplicateDetails: string[];
    }> = [];

    for (const p of ttoPrescriptions) {
      if (!p.medicationName) continue;
      const allergyWarning = checkForAllergies(p.medicationName, patientAllergies);
      const allergyDetails = allergyWarning ? findMatchingAllergies(p.medicationName, patientAllergies) : [];
      const { interactionWarning, interactionDetails } = await checkDrugInteractions(prisma, tenantId, admission.patientId, p.medicationName);
      const { duplicateWarning, duplicateDetails } = await checkDuplicateTherapy(prisma, tenantId, admission.patientId, p.medicationName);

      ttoWarnings.push({
        medicationName: p.medicationName,
        allergyWarning,
        allergyDetails,
        interactionWarning,
        interactionDetails,
        duplicateWarning,
        duplicateDetails,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Re-check status inside the transaction — closes the race where two
      // concurrent discharge requests both pass the check above and both try
      // to create a DischargeSummary (which would otherwise fail with a raw
      // unique-constraint error instead of a clean message).
      // @ts-ignore - Temporary fix for schema alignment
      const current = await tx.admission.findFirst({
        where: { tenantId, id: admissionId, status: 'ADMITTED' }
      });
      if (!current) throw new Error('Active admission not found');

      // @ts-ignore - Temporary fix for schema alignment
      const dis = await tx.admission.update({
        where: { id: admissionId },
        data: {
          status: 'DISCHARGED',
          dischargeDate: new Date(),
        }
      });

      // @ts-ignore - Temporary fix for schema alignment
      await tx.dischargeSummary.create({
        data: {
          tenantId,
          admissionId,
          finalNotes: data.finalNotes || data.notes || '',
          followUpPlan: data.followUpPlan || null,
          ttoMedications: data.ttoMedications ? data.ttoMedications : null,
          // Maternity-specific — only ever populated by DischargeModal.tsx
          // when this admission has a linked LaborRecord; null for every
          // other discharge.
          breastfeedingCounselingDone: data.breastfeedingCounselingDone ?? null,
          familyPlanningMethodDiscussed: data.familyPlanningMethodDiscussed || null,
          newbornDangerSignsCounseled: data.newbornDangerSignsCounseled ?? null,
          postnatalFollowUpDate: data.postnatalFollowUpDate ? new Date(data.postnatalFollowUpDate) : null,
          maternalConditionAtDischarge: data.maternalConditionAtDischarge || null,
          maternalConditionNotes: data.maternalConditionNotes || null,
          newbornConditionAtDischarge: data.newbornConditionAtDischarge || null,
          newbornConditionNotes: data.newbornConditionNotes || null,
        }
      });

      if (data.finalDiagnosisId) {
        // Either owned by this tenant, or a shared/global reference row
        // (tenantId: null — see seed-icd10-catalog.ts) usable by every tenant.
        // @ts-ignore - Temporary fix for schema alignment
        const diagnosis = await tx.diagnosisCatalog.findFirst({
          where: { id: data.finalDiagnosisId, OR: [{ tenantId }, { tenantId: null }] }
        });
        if (!diagnosis) throw new Error('Selected diagnosis not found');

        // @ts-ignore - Temporary fix for schema alignment
        await tx.admissionDiagnosis.create({
          data: {
            tenantId,
            admissionId,
            diagnosisId: data.finalDiagnosisId,
            isPrimary: true,
            isAdmission: false // Discharge diagnosis
          }
        });
      }

      // Only free the bed immediately if this admission has actually been
      // billed AND that invoice is fully paid. Otherwise the bed is held —
      // see Admission.bedClearedAt — until someone explicitly confirms via
      // "Confirm Bed Vacated", since in practice a discharged patient often
      // stays in the bed for days while settling an outstanding balance.
      let bedCleared = false;
      if (admission.billingStatus === 'BILLED') {
        // @ts-ignore - Temporary fix for schema alignment
        const lineItems = await tx.invoiceLineItem.findMany({
          where: { admissionId, isDeleted: false },
          select: { invoiceId: true }
        });
        const invoiceIds = [...new Set(lineItems.map((li: any) => li.invoiceId))];
        if (invoiceIds.length > 0) {
          const invoices = await tx.invoice.findMany({
            where: { id: { in: invoiceIds }, isDeleted: false }
          });
          bedCleared = invoices.length > 0 && invoices.every((inv: any) => Number(inv.balance) === 0);
        }
      }

      let bedClearedAt: Date | null = null;
      if (bedCleared) {
        // @ts-ignore - Temporary fix for schema alignment
        await tx.bed.updateMany({
          where: { id: admission.bedId, tenantId },
          data: { status: 'AVAILABLE' }
        });
        bedClearedAt = new Date();
        // @ts-ignore - Temporary fix for schema alignment
        await tx.admission.update({
          where: { id: admissionId },
          data: { bedClearedAt }
        });
      }

      if (ttoPrescriptions.length > 0) {
        for (const p of ttoPrescriptions) {
          const warning = ttoWarnings.find(w => w.medicationName === p.medicationName);
          await tx.prescription.create({
            data: {
              tenantId,
              patientId: admission.patientId,
              doctorId: userId,
              type: 'DISCHARGE',
              medicationId: p.medicationId || undefined,
              medicationName: p.medicationName,
              route: p.route || 'ORAL',
              dosage: p.dosage,
              frequency: p.frequency,
              duration: p.duration,
              instructions: p.instructions || '',
              quantity: p.quantity || 1,
              status: 'PENDING',
              allergyWarning: warning?.allergyWarning || false,
              interactionWarning: warning?.interactionWarning || false,
            }
          });
        }
      }

      return { ...dis, bedCleared, bedClearedAt };
    });

    // Only surface medications that actually triggered a flag.
    const flaggedWarnings = ttoWarnings.filter(
      w => w.allergyWarning || w.interactionWarning || w.duplicateWarning
    );

    return { ...updated, medicationWarnings: flaggedWarnings };
  }

  // Explicitly frees a held bed after discharge, regardless of payment
  // status — staff may choose to let someone go despite an unpaid balance,
  // that's their call, not the system's to block. Available any time after
  // discharge; a no-op guard prevents double-clearing.
  async confirmBedVacated(tenantId: string, admissionId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({
      where: { tenantId, id: admissionId, status: 'DISCHARGED' }
    });
    if (!admission) throw new Error('Discharged admission not found');
    if (admission.bedClearedAt) throw new Error('Bed has already been marked as vacated');

    return prisma.$transaction(async (tx) => {
      // @ts-ignore - Temporary fix for schema alignment
      const updated = await tx.admission.update({
        where: { id: admissionId },
        data: { bedClearedAt: new Date() }
      });
      // @ts-ignore - Temporary fix for schema alignment
      await tx.bed.updateMany({
        where: { id: admission.bedId, tenantId },
        data: { status: 'AVAILABLE' }
      });
      return updated;
    });
  }

  // Powers the "Awaiting Bed Clearance" countdown: for every discharged
  // admission whose bed is still being held, computes how much grace-period
  // time is left (or how far into overstay it already is) and the estimated
  // extra accommodation charge that would result from generating an invoice
  // right now — mirrors the day-count/rate logic in
  // generate-invoice.use-case.ts's ACCOMMODATION overstay line item.
  async getOverstayStatus(tenantId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { overstayGraceDays: true }
    });
    const graceDays = tenant?.overstayGraceDays ?? 2;

    // @ts-ignore - Temporary fix for schema alignment
    const admissions = await prisma.admission.findMany({
      where: { tenantId, status: 'DISCHARGED', bedClearedAt: null },
      include: {
        patient: true,
        bed: { include: { ward: true } }
      },
      orderBy: { dischargeDate: 'asc' }
    });

    const msPerDay = 1000 * 60 * 60 * 24;
    const now = Date.now();

    return admissions.map((admission: any) => {
      const dischargeTime = new Date(admission.dischargeDate).getTime();
      const daysSinceDischarge = Math.max(0, Math.floor((now - dischargeTime) / msPerDay));
      const graceDaysRemaining = Math.max(0, graceDays - daysSinceDischarge);
      const overstayDays = Math.max(0, daysSinceDischarge - graceDays);
      const dailyCost = admission.bed?.ward?.dailyCost || 0;
      const estimatedExtraCharge = overstayDays * dailyCost;

      return {
        admissionId: admission.id,
        patient: admission.patient,
        bed: admission.bed,
        dischargeDate: admission.dischargeDate,
        billingStatus: admission.billingStatus,
        daysSinceDischarge,
        graceDaysRemaining,
        overstayDays,
        estimatedExtraCharge,
        isOverstay: overstayDays > 0
      };
    });
  }

  async transferPatient(tenantId: string, admissionId: string, data: any, userId: string) {
    const { toBedId, reason } = data;

    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({
      where: { tenantId, id: admissionId, status: 'ADMITTED' }
    });
    if (!admission) throw new Error('Active admission not found');

    if (admission.bedId === toBedId) throw new Error('Patient is already in this bed');

    // @ts-ignore - Temporary fix for schema alignment
    const newBed = await prisma.bed.findFirst({
      where: { tenantId, id: toBedId },
      include: { ward: { select: { status: true } } }
    });
    if (!newBed || newBed.status !== 'AVAILABLE') throw new Error('Target bed is not available');
    // @ts-ignore - Temporary fix for schema alignment
    if (newBed.ward.status !== 'ACTIVE') throw new Error('Target bed belongs to a ward that is no longer active');

    const transfer = await prisma.$transaction(async (tx) => {
      const fromBedId = admission.bedId;

      // @ts-ignore - Temporary fix for schema alignment
      await tx.admission.update({
        where: { id: admissionId },
        data: { bedId: toBedId }
      });

      // @ts-ignore - Temporary fix for schema alignment
      await tx.bed.updateMany({
        where: { id: fromBedId, tenantId },
        data: { status: 'AVAILABLE' }
      });

      // Re-check availability inside the transaction — closes the race
      // where two concurrent admit/transfer requests both target this bed.
      // @ts-ignore - Temporary fix for schema alignment
      const bedUpdateResult = await tx.bed.updateMany({
        where: { id: toBedId, tenantId, status: 'AVAILABLE' },
        data: { status: 'OCCUPIED' }
      });
      if (bedUpdateResult.count === 0) {
        throw new Error('Target bed is no longer available — it may have just been assigned to another patient');
      }

      // @ts-ignore - Temporary fix for schema alignment
      const history = await tx.bedTransferHistory.create({
        data: {
          tenantId,
          admissionId,
          fromBedId,
          toBedId,
          transferredById: userId,
          reason
        }
      });

      return history;
    });

    return transfer;
  }

  async addWardRound(tenantId: string, admissionId: string, data: any, userId: string) {
    // Fetch the admission (and patient allergies) up front — needed both to
    // confirm the admission belongs to this tenant and, for any new
    // medication below, to run the same allergy/interaction/duplicate-therapy
    // checks CreatePrescriptionUseCase already enforces (REQ-CLIN-7).
    // Previously this was fetched inside the transaction, after already
    // creating the WardRound row (safe, since a throw rolls the whole
    // transaction back, but there was no allergy checking here at all).
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({
      where: { id: admissionId, tenantId },
      include: { patient: { select: { firstName: true, lastName: true, allergies: true } } }
    });

    if (!admission) {
      throw new Error('Admission not found');
    }

    const changes: any[] = Array.isArray(data.medicationChanges) ? data.medicationChanges : [];
    const patientAllergies = admission.patient.allergies || [];

    // Precompute warnings for every new medication before opening the
    // transaction — these are read-only checks against tenant data, not
    // part of the write itself, mirroring how CreatePrescriptionUseCase
    // orders checks before create rather than inside a transaction.
    const medicationWarnings: Array<{
      medicationName: string;
      allergyWarning: boolean;
      allergyDetails: string[];
      interactionWarning: boolean;
      interactionDetails: string[];
      duplicateWarning: boolean;
      duplicateDetails: string[];
    }> = [];

    for (const change of changes) {
      if (change.action === 'ADD' && change.medicationName) {
        const allergyWarning = checkForAllergies(change.medicationName, patientAllergies);
        const allergyDetails = allergyWarning ? findMatchingAllergies(change.medicationName, patientAllergies) : [];
        const { interactionWarning, interactionDetails } = await checkDrugInteractions(prisma, tenantId, admission.patientId, change.medicationName);
        const { duplicateWarning, duplicateDetails } = await checkDuplicateTherapy(prisma, tenantId, admission.patientId, change.medicationName);

        medicationWarnings.push({
          medicationName: change.medicationName,
          allergyWarning,
          allergyDetails,
          interactionWarning,
          interactionDetails,
          duplicateWarning,
          duplicateDetails,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the ward round
      // @ts-ignore - Temporary fix for schema alignment
      const wardRound = await tx.wardRound.create({
        data: {
          tenantId,
          admissionId,
          conductedById: userId,
          notes: data.notes,
          vitals: data.vitals,
          plan: data.plan
        }
      });

      // 2. Process Medication Changes — tracked so a single role-wide
      // notification can be sent after commit (REQ: a medication add/stop
      // during a ward round must be impossible to miss, not just visible to
      // whoever happens to open the Medication chart tab later).
      const started: string[] = [];
      const discontinued: string[] = [];

      for (const change of changes) {
        if (change.action === 'DISCONTINUE' && change.prescriptionId) {
          // Scoped to this admission's own patient, not just the tenant —
          // otherwise any prescriptionId in the same tenant could be
          // discontinued (and silently reassigned to this admission below)
          // regardless of which patient it actually belongs to.
          const updateResult = await tx.prescription.updateMany({
            where: { id: change.prescriptionId, tenantId, patientId: admission.patientId },
            data: {
              status: 'CANCELLED', // We use CANCELLED to denote discontinued
              // Link to this admission even if the prescription predates it
              // (e.g. started during an earlier consultation) — both
              // getCharts' activePrescriptions and getAdmissionById's
              // prescriptions include filter on admissionId, and a
              // cancelled prescription also fails the PENDING/DISPENSED
              // status fallback, so without this it silently disappears
              // from the chart/banner the moment it's discontinued.
              admissionId: admissionId,
              updatedAt: new Date()
            }
          });
          if (updateResult.count > 0) {
            discontinued.push(change.medicationName || 'a medication');
          }
        } else if (change.action === 'ADD' && change.medicationName) {
          const warning = medicationWarnings.find(w => w.medicationName === change.medicationName);
          await tx.prescription.create({
            data: {
              tenantId,
              patientId: admission.patientId,
              // @ts-ignore - Temporary fix for schema alignment
              admissionId: admissionId,
              doctorId: userId,
              medicationId: change.medicationId || null,
              medicationName: change.medicationName,
              route: change.route || 'ORAL',
              dosage: change.dosage,
              frequency: change.frequency || 'As directed',
              duration: change.duration || 'Until discontinued',
              instructions: change.instructions || 'Added during ward round',
              type: 'INPATIENT',
              status: 'PENDING',
              allergyWarning: warning?.allergyWarning || false,
              interactionWarning: warning?.interactionWarning || false,
            }
          });
          started.push(change.medicationName);
        }
      }

      return { wardRound, started, discontinued };
    });

    // Outside the transaction — only notify once the change is actually
    // committed, and never let a notification failure roll back the
    // clinical write itself.
    if (result.started.length > 0 || result.discontinued.length > 0) {
      const parts: string[] = [];
      if (result.started.length > 0) parts.push(`Started ${result.started.join(', ')}`);
      if (result.discontinued.length > 0) parts.push(`Discontinued ${result.discontinued.join(', ')}`);

      // Ward rounds happen a few times a day — a 15-minute cooldown only
      // catches the pathological case of rapid duplicate submissions, not
      // legitimate distinct rounds later the same day.
      await this.notificationService.notifyRoleWithCooldown(tenantId, ['DOCTOR', 'NURSE'], {
        type: 'MEDICATION_CHANGE',
        severity: 'INFO',
        title: 'Medication Order Changed',
        message: `${admission.patient.firstName} ${admission.patient.lastName} — ${parts.join('; ')}`,
        entityType: 'Admission',
        entityId: admissionId,
      }, 15);
    }

    // Only surface medications that actually triggered a flag — an empty
    // array means nothing to warn about, so the caller can key off length.
    const flaggedWarnings = medicationWarnings.filter(
      w => w.allergyWarning || w.interactionWarning || w.duplicateWarning
    );

    return { ...result.wardRound, medicationWarnings: flaggedWarnings };
  }

  async addMedicationAdministration(tenantId: string, admissionId: string, data: any, userId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({ where: { id: admissionId, tenantId } });
    if (!admission) throw new Error('Admission not found');

    const status = data.status || 'COMPLETED';
    if (status !== 'COMPLETED' && !data.omissionReason) {
      throw new Error('An omission reason is required when a dose is missed or refused');
    }

    return prisma.$transaction(async (tx) => {
      // Only a COMPLETED dose actually leaves the shelf — MISSED/REFUSED
      // doses record why nothing was given, with no stock impact.
      if (status === 'COMPLETED' && data.prescriptionId) {
        // Scoped to this admission's own patient — a prescriptionId from a
        // different patient in the same tenant must not be usable here.
        const prescription = await tx.prescription.findFirst({
          where: { id: data.prescriptionId, tenantId, patientId: admission.patientId }
        });

        if (prescription?.medicationId) {
          const batch = await tx.medicationBatch.findFirst({
            where: {
              tenantId,
              medicationId: prescription.medicationId,
              status: 'ACTIVE',
              quantity: { gt: 0 },
              expiryDate: { gt: new Date() }
            },
            orderBy: { expiryDate: 'asc' }
          });

          if (!batch) {
            throw new Error(`No available stock batch found for ${data.medicationName} — cannot record as administered`);
          }

          await tx.medicationBatch.update({
            where: { id: batch.id },
            data: { quantity: { decrement: 1 } }
          });

          await tx.medication.update({
            where: { id: prescription.medicationId },
            data: { stockLevel: { decrement: 1 } }
          });
        }
      }

      // @ts-ignore - Temporary fix for schema alignment
      return tx.medicationAdministration.create({
        data: {
          tenantId,
          admissionId,
          administeredById: userId,
          medicationName: data.medicationName,
          dosage: data.dosage,
          route: data.route,
          notes: data.notes,
          omissionReason: data.omissionReason,
          prescriptionId: data.prescriptionId,
          status
        }
      });
    });
  }

  async getBillableAdmissions(tenantId: string, patientId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    const admissions = await prisma.admission.findMany({
      where: {
        tenantId,
        patientId,
        billingStatus: 'UNBILLED',
        isDeleted: false
      },
      include: {
        bed: {
          include: {
            ward: true
          }
        },
        medicationAdministrations: {
          where: { status: 'COMPLETED' }
        }
      }
    });

    const billableItems: any[] = [];

    for (const admission of admissions) {
      // Room cost calculation
      const msPerDay = 1000 * 60 * 60 * 24;
      const start = new Date(admission.admissionDate).getTime();
      const end = new Date(admission.dischargeDate || new Date()).getTime();
      const days = Math.max(1, Math.ceil((end - start) / msPerDay));
      const dailyCost = admission.bed.ward.dailyCost || 0;
      
      if (dailyCost > 0) {
        billableItems.push({
          id: `room-${admission.id}`,
          admissionId: admission.id,
          type: 'INPATIENT_ROOM',
          description: `Ward: ${admission.bed.ward.name} (Bed: ${admission.bed.bedNumber})`,
          detail: `${days} day(s) @ ${dailyCost}/day`,
          quantity: days,
          unitPrice: dailyCost,
          total: days * dailyCost,
          selected: true
        });
      }

      // Administered Medications
      for (const medAdmin of admission.medicationAdministrations) {
        // Try to find the medication unit price in pharmacy
        const medication = await prisma.medication.findFirst({
          where: { tenantId, name: medAdmin.medicationName }
        });
        const unitPrice = medication ? medication.unitPrice : 0;

        billableItems.push({
          id: `med-${medAdmin.id}`,
          admissionId: admission.id,
          type: 'ADMINISTERED_DRUG',
          description: `Administered: ${medAdmin.medicationName}`,
          detail: `Dosage: ${medAdmin.dosage} (on ${new Date(medAdmin.administeredAt).toLocaleDateString()})`,
          quantity: 1,
          unitPrice,
          total: unitPrice,
          selected: true
        });
      }
    }

    return { data: billableItems };
  }

  // Mirrors generate-invoice.use-case.ts's own pricing exactly (Service
  // Catalog match first, hardcoded fallback otherwise) so the picker preview
  // and the actual generated invoice never disagree.
  async getBillableTransfusions(tenantId: string, patientId: string) {
    const serviceCatalog = await prisma.serviceCatalog.findMany({
      where: { tenantId, isActive: true, category: 'PROCEDURE' }
    });
    const catalogPrice = serviceCatalog.find(s => s.serviceName.toLowerCase().includes('blood transfusion'));
    const unitPrice = Number(catalogPrice?.basePrice || 15000);
    // Tax must be included here too — generate-invoice.use-case.ts adds
    // (unitPrice * taxRate/100) on top of unitPrice for the same matched
    // catalog entry, so a preview total that omits it would understate
    // what actually lands on the invoice whenever taxRate > 0.
    const taxRate = Number(catalogPrice?.taxRate || 0);
    const tax = unitPrice * (taxRate / 100);

    // @ts-ignore - Temporary fix for schema alignment
    const transfusions = await prisma.transfusionChart.findMany({
      where: { tenantId, isDeleted: false, billingStatus: 'UNBILLED', admission: { patientId } }
    });

    return {
      data: transfusions.map((t: any) => ({
        id: t.id,
        description: `Blood Transfusion — ${t.productType} (Unit ${t.unitNumber})`,
        detail: new Date(t.startTime).toLocaleDateString(),
        quantity: 1,
        unitPrice,
        tax,
        total: unitPrice + tax
      }))
    };
  }

  async getBillableOperationNotes(tenantId: string, patientId: string) {
    const serviceCatalog = await prisma.serviceCatalog.findMany({
      where: { tenantId, isActive: true, category: 'PROCEDURE' }
    });

    // @ts-ignore - Temporary fix for schema alignment
    const operations = await prisma.operationNote.findMany({
      where: { tenantId, isDeleted: false, billingStatus: 'UNBILLED', admission: { patientId } }
    });

    return {
      data: operations.map((op: any) => {
        const catalogPrice = serviceCatalog.find(s => s.serviceName.toLowerCase().includes(op.surgicalProcedure.toLowerCase()));
        const unitPrice = Number(catalogPrice?.basePrice || 50000);
        // Tax must be included here too — generate-invoice.use-case.ts adds
        // (unitPrice * taxRate/100) on top of unitPrice for the same matched
        // catalog entry, so a preview total that omits it would understate
        // what actually lands on the invoice whenever taxRate > 0.
        const taxRate = Number(catalogPrice?.taxRate || 0);
        const tax = unitPrice * (taxRate / 100);
        return {
          id: op.id,
          description: `Surgery: ${op.surgicalProcedure}`,
          detail: new Date(op.operationDate).toLocaleDateString(),
          quantity: 1,
          unitPrice,
          tax,
          total: unitPrice + tax
        };
      })
    };
  }

  // ==================== INPATIENT CHARTS ====================

  async getCharts(tenantId: string, admissionId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({ where: { id: admissionId, tenantId } });
    if (!admission) throw new Error('Admission not found');

    const [vitals, fluids, transfusions, bloodSugars, medications, activePrescriptions] = await Promise.all([
      // @ts-ignore - Temporary fix for schema alignment
      prisma.vitalChart.findMany({ where: { tenantId, admissionId, isDeleted: false }, orderBy: { recordedAt: 'desc' }, include: { recordedBy: { select: { firstName: true, lastName: true } } } }),
      // @ts-ignore - Temporary fix for schema alignment
      prisma.fluidChart.findMany({ where: { tenantId, admissionId, isDeleted: false }, orderBy: { recordedAt: 'desc' }, include: { recordedBy: { select: { firstName: true, lastName: true } } } }),
      // @ts-ignore - Temporary fix for schema alignment
      prisma.transfusionChart.findMany({ where: { tenantId, admissionId, isDeleted: false }, orderBy: { startTime: 'desc' }, include: { transfusedBy: { select: { firstName: true, lastName: true } } } }),
      // @ts-ignore - Temporary fix for schema alignment
      prisma.bloodSugarChart.findMany({ where: { tenantId, admissionId, isDeleted: false }, orderBy: { recordedAt: 'desc' }, include: { recordedBy: { select: { firstName: true, lastName: true } } } }),
      // @ts-ignore - Temporary fix for schema alignment
      prisma.medicationAdministration.findMany({ where: { tenantId, admissionId }, orderBy: { administeredAt: 'desc' }, include: { administeredBy: { select: { firstName: true, lastName: true } } } }),
      prisma.prescription.findMany({ 
        where: { 
          tenantId, 
          patientId: admission.patientId,
          OR: [
            { status: { in: ['PENDING', 'DISPENSED'] } },
            // @ts-ignore - Temporary fix for schema alignment
            { admissionId: admissionId }
          ]
        }, 
        orderBy: { createdAt: 'desc' } 
      })
    ]);

    return { vitals, fluids, transfusions, bloodSugars, medications, activePrescriptions };
  }

  async addVitalChart(tenantId: string, admissionId: string, userId: string, data: any) {
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({
      where: { id: admissionId, tenantId },
      include: { patient: { select: { firstName: true, lastName: true } } }
    });
    if (!admission) throw new Error('Admission not found');

    const chartData = {
      temperature: data.temperature,
      systolicBP: data.systolicBP ?? (data.bloodPressure ? parseInt(data.bloodPressure.split('/')[0]) : null),
      diastolicBP: data.diastolicBP ?? (data.bloodPressure ? parseInt(data.bloodPressure.split('/')[1]) : null),
      heartRate: data.heartRate,
      respiratoryRate: data.respiratoryRate,
      spO2: data.spO2
    };

    // @ts-ignore - Temporary fix for schema alignment
    const vitalChart = await prisma.vitalChart.create({
      data: {
        tenantId,
        admissionId,
        recordedById: userId,
        ...chartData,
        painScore: data.painScore,
        weight: data.weight,
        height: data.height,
        headCircumference: data.headCircumference,
        muac: data.muac,
        notes: data.notes
      }
    });

    const breachedLabels = VITAL_ALERT_THRESHOLDS.filter(t => t.test(chartData)).map(t => t.label);
    if (breachedLabels.length > 0) {
      const patientName = `${admission.patient.firstName} ${admission.patient.lastName}`;
      // Keyed on admissionId, not vitalChart.id — every vitals recording
      // creates a fresh VitalChart row, so keying on that would never
      // actually dedupe anything. A 30-minute cooldown covers the typical
      // vitals-recording cadence for an unstable patient without missing a
      // genuinely new breach for long. No notification click-through
      // navigates by entityId today, so this is a pure improvement.
      await this.notificationService.notifyRoleWithCooldown(tenantId, ['DOCTOR', 'NURSE'], {
        type: 'CRITICAL_VITAL_SIGN',
        severity: 'CRITICAL',
        title: 'Critical Vital Sign',
        message: `${patientName} — ${breachedLabels.join(', ')}`,
        entityType: 'Admission',
        entityId: admissionId
      }, 30);
    }

    return vitalChart;
  }

  async addFluidChart(tenantId: string, admissionId: string, userId: string, data: any) {
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({ where: { id: admissionId, tenantId } });
    if (!admission) throw new Error('Admission not found');

    // @ts-ignore - Temporary fix for schema alignment
    return prisma.fluidChart.create({
      data: {
        tenantId,
        admissionId,
        recordedById: userId,
        type: data.type,
        route: data.route,
        fluidName: data.fluidName,
        volumeMl: data.volumeMl,
        notes: data.notes
      }
    });
  }

  async addTransfusionChart(tenantId: string, admissionId: string, userId: string, data: any) {
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({ where: { id: admissionId, tenantId } });
    if (!admission) throw new Error('Admission not found');

    // @ts-ignore - Temporary fix for schema alignment
    return prisma.transfusionChart.create({
      data: {
        tenantId,
        admissionId,
        transfusedById: userId,
        bloodGroup: data.bloodGroup,
        unitNumber: data.unitNumber,
        productType: data.productType,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : null,
        preVitals: data.preVitals,
        duringVitals: data.duringVitals,
        postVitals: data.postVitals,
        reaction: data.reaction || false,
        reactionNotes: data.reactionNotes
      }
    });
  }

  async addBloodSugarChart(tenantId: string, admissionId: string, userId: string, data: any) {
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({ where: { id: admissionId, tenantId } });
    if (!admission) throw new Error('Admission not found');

    // @ts-ignore - Temporary fix for schema alignment
    return prisma.bloodSugarChart.create({
      data: {
        tenantId,
        admissionId,
        recordedById: userId,
        bloodGlucose: data.bloodGlucose,
        unit: data.unit || 'mg/dL',
        measurementContext: data.measurementContext,
        insulinGiven: data.insulinGiven,
        notes: data.notes
      }
    });
  }

  // ==================== OPERATION NOTES & POSTOP PLAN ====================

  async getOperationNotes(tenantId: string, admissionId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    return prisma.operationNote.findMany({
      where: { tenantId, admissionId, isDeleted: false },
      orderBy: { operationDate: 'desc' },
      include: { recordedBy: { select: { firstName: true, lastName: true } } }
    });
  }

  async addOperationNote(tenantId: string, admissionId: string, userId: string, data: any) {
    // @ts-ignore - Temporary fix for schema alignment
    const admission = await prisma.admission.findFirst({ where: { id: admissionId, tenantId } });
    if (!admission) throw new Error('Admission not found');

    // @ts-ignore - Temporary fix for schema alignment
    return prisma.operationNote.create({
      data: {
        tenantId,
        admissionId,
        recordedById: userId,
        surgicalProcedure: data.surgicalProcedure,
        indication: data.indication,
        surgeons: data.surgeons,
        assistants: data.assistants,
        anaesthetics: data.anaesthetics,
        anaesthetist: data.anaesthetist,
        incision: data.incision,
        findings: data.findings,
        procedure: data.procedure,
        plan: data.plan,
        others: data.others,
        operationDate: data.operationDate ? new Date(data.operationDate) : new Date()
      }
    });
  }

  // Cross-admission by design: lets clinical staff see every operation note
  // recorded at this clinic without opening each patient individually.
  // Deliberately NOT filtered by recordedById — the person logged in when a
  // note was typed up isn't necessarily the operating surgeon (a colleague
  // or resident may enter it on their behalf), and the actual surgeon(s)
  // only exist as free text (`surgeons`), which isn't reliable to filter on
  // either. So this returns the full log rather than a per-doctor slice.
  async getAllOperationNotes(
    tenantId: string,
    filters: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      sortBy?: 'operationDate' | 'surgicalProcedure';
      sortDir?: 'asc' | 'desc';
    }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const sortBy = filters.sortBy || 'operationDate';
    const sortDir = filters.sortDir || 'desc';

    // @ts-ignore - Temporary fix for schema alignment
    const where = {
      tenantId,
      isDeleted: false,
      ...(filters.from || filters.to
        ? {
            operationDate: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [notes, total] = await Promise.all([
      // @ts-ignore - Temporary fix for schema alignment
      prisma.operationNote.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          admission: {
            include: {
              patient: { select: { id: true, patientId: true, firstName: true, lastName: true } },
            },
          },
          recordedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      // @ts-ignore - Temporary fix for schema alignment
      prisma.operationNote.count({ where }),
    ]);

    return { notes, total, page, limit };
  }

  // Ranking report (count per surgicalProcedure in a date range) — mirrors
  // GetDiagnosisTrendsReportUseCase's approach (in-memory Map aggregation
  // over a findMany, rather than a Prisma groupBy) so it stays consistent
  // with the rest of this codebase's reporting pattern. Lives here rather
  // than in application/use-cases/reports/ since Reports is ADMIN_ONLY and
  // this needs to be visible to the same DOCTOR/NURSE audience as the rest
  // of the Surgery Log.
  async getSurgicalProcedureBreakdown(
    tenantId: string,
    filters: { from?: string; to?: string; limit?: number }
  ) {
    const limit = filters.limit || 10;

    // @ts-ignore - Temporary fix for schema alignment
    const notes = await prisma.operationNote.findMany({
      where: {
        tenantId,
        isDeleted: false,
        ...(filters.from || filters.to
          ? {
              operationDate: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      select: { surgicalProcedure: true },
    });

    const counts = new Map<string, number>();
    // @ts-ignore - Temporary fix for schema alignment
    notes.forEach((n) => counts.set(n.surgicalProcedure, (counts.get(n.surgicalProcedure) || 0) + 1));

    const topProcedures = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return {
      topProcedures,
      summary: {
        totalOperationsRecorded: notes.length,
        startDate: filters.from || null,
        endDate: filters.to || null,
      },
    };
  }

  // ==================== VOID / CORRECTIONS ====================
  // Every chart-type model below already carries isDeleted/deletedAt/deletedBy/
  // deletionReason columns that nothing previously wrote to — this is what
  // finally lets a wrong entry be corrected instead of living forever as
  // active data. Voiding never hard-deletes: the row (and who voided it, and
  // why) stays for the audit trail; only the get*/list queries stop showing it.

  private async voidRecord(model: 'wardRound' | 'vitalChart' | 'fluidChart' | 'transfusionChart' | 'bloodSugarChart' | 'operationNote', tenantId: string, admissionId: string, recordId: string, userId: string, reason: string) {
    if (!reason) throw new Error('A reason is required to void a record');

    // @ts-ignore - Temporary fix for schema alignment
    const record = await (prisma as any)[model].findFirst({ where: { id: recordId, tenantId, admissionId } });
    if (!record) throw new Error('Record not found');

    // @ts-ignore - Temporary fix for schema alignment
    return (prisma as any)[model].update({
      where: { id: recordId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        deletionReason: reason
      }
    });
  }

  voidWardRound(tenantId: string, admissionId: string, recordId: string, userId: string, reason: string) {
    return this.voidRecord('wardRound', tenantId, admissionId, recordId, userId, reason);
  }

  voidVitalChart(tenantId: string, admissionId: string, recordId: string, userId: string, reason: string) {
    return this.voidRecord('vitalChart', tenantId, admissionId, recordId, userId, reason);
  }

  voidFluidChart(tenantId: string, admissionId: string, recordId: string, userId: string, reason: string) {
    return this.voidRecord('fluidChart', tenantId, admissionId, recordId, userId, reason);
  }

  voidTransfusionChart(tenantId: string, admissionId: string, recordId: string, userId: string, reason: string) {
    return this.voidRecord('transfusionChart', tenantId, admissionId, recordId, userId, reason);
  }

  voidBloodSugarChart(tenantId: string, admissionId: string, recordId: string, userId: string, reason: string) {
    return this.voidRecord('bloodSugarChart', tenantId, admissionId, recordId, userId, reason);
  }

  voidOperationNote(tenantId: string, admissionId: string, recordId: string, userId: string, reason: string) {
    return this.voidRecord('operationNote', tenantId, admissionId, recordId, userId, reason);
  }
}
