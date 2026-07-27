import { prisma } from '../../infrastructure/database/prisma.client';
import { NotificationService } from '../../application/services/notification.service';

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

  async getWards(tenantId: string) {
    // @ts-ignore - Temporary fix for schema alignment
    return prisma.ward.findMany({
      where: { tenantId, status: 'ACTIVE' },
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
          // @ts-ignore - Temporary fix for schema alignment
          await tx.bed.deleteMany({ where: { id: { in: bedsToDelete.map(b => b.id) } } });
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
    const where: any = { tenantId };
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
      where: { tenantId, id: admissionId },
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
      where: { tenantId, patientId },
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

    // Check if bed is available
    // @ts-ignore - Temporary fix for schema alignment
    const bed = await prisma.bed.findFirst({
      where: { tenantId, id: bedId }
    });
    if (!bed || bed.status !== 'AVAILABLE') throw new Error('Bed is not available');

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
      where: { tenantId, id: admissionId, status: 'ADMITTED' }
    });
    if (!admission) throw new Error('Active admission not found');

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
        }
      });

      if (data.finalDiagnosisId) {
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

      // @ts-ignore - Temporary fix for schema alignment
      await tx.bed.updateMany({
        where: { id: admission.bedId, tenantId },
        data: { status: 'AVAILABLE' }
      });

      if (data.prescriptions && Array.isArray(data.prescriptions) && data.prescriptions.length > 0) {
        for (const p of data.prescriptions) {
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
              status: 'PENDING'
            }
          });
        }
      }

      return dis;
    });

    return updated;
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
      where: { tenantId, id: toBedId }
    });
    if (!newBed || newBed.status !== 'AVAILABLE') throw new Error('Target bed is not available');

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

      // 2. Fetch the admission to get patientId
      // @ts-ignore - Temporary fix for schema alignment
      const admission = await tx.admission.findFirst({
        where: { id: admissionId, tenantId },
        include: { patient: { select: { firstName: true, lastName: true } } }
      });

      if (!admission) {
        throw new Error('Admission not found');
      }

      // 3. Process Medication Changes — tracked so a single role-wide
      // notification can be sent after commit (REQ: a medication add/stop
      // during a ward round must be impossible to miss, not just visible to
      // whoever happens to open the Medication chart tab later).
      const started: string[] = [];
      const discontinued: string[] = [];

      if (data.medicationChanges && Array.isArray(data.medicationChanges)) {
        for (const change of data.medicationChanges) {
          if (change.action === 'DISCONTINUE' && change.prescriptionId) {
            const updateResult = await tx.prescription.updateMany({
              where: { id: change.prescriptionId, tenantId },
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
                status: 'PENDING'
              }
            });
            started.push(change.medicationName);
          }
        }
      }

      return { wardRound, started, discontinued, patientName: `${admission.patient.firstName} ${admission.patient.lastName}` };
    });

    // Outside the transaction — only notify once the change is actually
    // committed, and never let a notification failure roll back the
    // clinical write itself.
    if (result.started.length > 0 || result.discontinued.length > 0) {
      const parts: string[] = [];
      if (result.started.length > 0) parts.push(`Started ${result.started.join(', ')}`);
      if (result.discontinued.length > 0) parts.push(`Discontinued ${result.discontinued.join(', ')}`);

      await this.notificationService.notifyRole(tenantId, ['DOCTOR', 'NURSE'], {
        type: 'MEDICATION_CHANGE',
        title: 'Medication Order Changed',
        message: `${result.patientName} — ${parts.join('; ')}`,
        entityType: 'Admission',
        entityId: admissionId,
      });
    }

    return result.wardRound;
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
        const prescription = await tx.prescription.findFirst({
          where: { id: data.prescriptionId, tenantId }
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
        billingStatus: 'UNBILLED'
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
        total: unitPrice
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
        return {
          id: op.id,
          description: `Surgery: ${op.surgicalProcedure}`,
          detail: new Date(op.operationDate).toLocaleDateString(),
          quantity: 1,
          unitPrice,
          total: unitPrice
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
      await this.notificationService.notifyRole(tenantId, ['DOCTOR', 'NURSE'], {
        type: 'CRITICAL_VITAL_SIGN',
        title: 'Critical Vital Sign',
        message: `${patientName} — ${breachedLabels.join(', ')}`,
        entityType: 'VitalChart',
        entityId: vitalChart.id
      });
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
        anaesthesis: data.anaesthesis,
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
    filters: { page?: number; limit?: number; from?: string; to?: string }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;

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
        orderBy: { operationDate: 'desc' },
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
