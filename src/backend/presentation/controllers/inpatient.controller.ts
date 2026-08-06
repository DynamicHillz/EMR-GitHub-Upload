import { Request, Response } from 'express';
import { InpatientService } from '../../domain/services/inpatient.service';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

const inpatientService = new InpatientService();

export class InpatientController {
  async getWards(req: Request, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      const wards = await inpatientService.getWards(req.user!.tenantId, status);
      res.json(wards);
    } catch (error: any) {
      res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching wards') });
    }
  }

  async createWard(req: Request, res: Response) {
    try {
      const ward = await inpatientService.createWard(req.user!.tenantId, req.body);
      res.status(201).json(ward);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error creating ward') });
    }
  }

  async updateWard(req: Request, res: Response) {
    try {
      const ward = await inpatientService.updateWard(req.user!.tenantId, req.params.id, req.body);
      res.json(ward);
    } catch (error: any) {
      console.error('WARD UPDATE ERROR:', error);
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error updating ward') });
    }
  }

  async deleteWard(req: Request, res: Response) {
    try {
      await inpatientService.deleteWard(req.user!.tenantId, req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error deleting ward') });
    }
  }

  async reactivateWard(req: Request, res: Response) {
    try {
      const ward = await inpatientService.reactivateWard(req.user!.tenantId, req.params.id);
      res.json(ward);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error reactivating ward') });
    }
  }

  async getAdmissions(req: Request, res: Response) {
    try {
      const { status } = req.query;
      const admissions = await inpatientService.getAdmissions(
        req.user!.tenantId,
        status as string | undefined
      );
      res.json(admissions);
    } catch (error: any) {
      res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching admissions') });
    }
  }

  async getAdmissionById(req: Request, res: Response) {
    try {
      const admission = await inpatientService.getAdmissionById(
        req.user!.tenantId,
        req.params.id
      );
      res.json(admission);
    } catch (error: any) {
      if (error.message === 'Admission not found') {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching admission details') });
      }
    }
  }

  async admitPatient(req: Request, res: Response) {
    try {
      const admission = await inpatientService.admitPatient(
        req.user!.tenantId,
        req.body,
        req.user!.id
      );
      res.status(201).json(admission);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error admitting patient') });
    }
  }

  async updateAdmissionSettings(req: Request, res: Response) {
    try {
      const admission = await inpatientService.updateAdmissionSettings(req.user!.tenantId, req.params.id, req.body);
      res.json(admission);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error updating admission settings') });
    }
  }

  async getAdmissionsByPatientId(req: Request, res: Response) {
    try {
      const admissions = await inpatientService.getAdmissionsByPatientId(req.user!.tenantId, req.params.patientId);
      res.json(admissions);
    } catch (error: any) {
      res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching admissions') });
    }
  }

  async updateBed(req: Request, res: Response) {
    try {
      const bed = await inpatientService.updateBed(req.user!.tenantId, req.params.id, req.body);
      res.json(bed);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error updating bed') });
    }
  }

  async dischargePatient(req: Request, res: Response) {
    try {
      const admission = await inpatientService.dischargePatient(
        req.user!.tenantId,
        req.params.id,
        req.body,
        req.user!.id
      );
      res.json(admission);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error discharging patient') });
    }
  }

  async confirmBedVacated(req: Request, res: Response) {
    try {
      const admission = await inpatientService.confirmBedVacated(
        req.user!.tenantId,
        req.params.id
      );
      res.json(admission);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error confirming bed vacated') });
    }
  }

  async getOverstayStatus(req: Request, res: Response) {
    try {
      const items = await inpatientService.getOverstayStatus(req.user!.tenantId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching overstay status') });
    }
  }

  async transferPatient(req: Request, res: Response) {
    try {
      const transfer = await inpatientService.transferPatient(
        req.user!.tenantId,
        req.params.id,
        req.body,
        req.user!.id
      );
      res.status(201).json(transfer);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error transferring patient') });
    }
  }

  async addWardRound(req: Request, res: Response) {
    try {
      const wardRound = await inpatientService.addWardRound(
        req.user!.tenantId,
        req.params.id,
        req.body,
        req.user!.id
      );
      res.status(201).json(wardRound);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error adding ward round') });
    }
  }

  async addMedicationAdministration(req: Request, res: Response) {
    try {
      const medAdmin = await inpatientService.addMedicationAdministration(
        req.user!.tenantId,
        req.params.id,
        req.body,
        req.user!.id
      );
      res.status(201).json(medAdmin);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error adding medication administration') });
    }
  }

  async getBillableAdmissions(req: Request, res: Response) {
    try {
      const patientId = req.query.patientId as string;
      if (!patientId) {
        return res.status(400).json({ message: 'patientId is required' });
      }
      const items = await inpatientService.getBillableAdmissions(req.user!.tenantId, patientId);
      res.json(items);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error fetching billable admissions') });
    }
  }

  async getBillableTransfusions(req: Request, res: Response) {
    try {
      const patientId = req.query.patientId as string;
      if (!patientId) {
        return res.status(400).json({ message: 'patientId is required' });
      }
      const items = await inpatientService.getBillableTransfusions(req.user!.tenantId, patientId);
      res.json(items);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error fetching billable transfusions') });
    }
  }

  async getBillableOperationNotes(req: Request, res: Response) {
    try {
      const patientId = req.query.patientId as string;
      if (!patientId) {
        return res.status(400).json({ message: 'patientId is required' });
      }
      const items = await inpatientService.getBillableOperationNotes(req.user!.tenantId, patientId);
      res.json(items);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error fetching billable operation notes') });
    }
  }

  // ==================== INPATIENT CHARTS ====================

  async getCharts(req: Request, res: Response) {
    try {
      const charts = await inpatientService.getCharts(req.user!.tenantId, req.params.id);
      res.json(charts);
    } catch (error: any) {
      res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching charts') });
    }
  }

  async addVitalChart(req: Request, res: Response) {
    try {
      const chart = await inpatientService.addVitalChart(req.user!.tenantId, req.params.id, req.user!.id, req.body);
      res.status(201).json(chart);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error adding vital chart') });
    }
  }

  async addFluidChart(req: Request, res: Response) {
    try {
      const chart = await inpatientService.addFluidChart(req.user!.tenantId, req.params.id, req.user!.id, req.body);
      res.status(201).json(chart);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error adding fluid chart') });
    }
  }

  async addTransfusionChart(req: Request, res: Response) {
    try {
      const chart = await inpatientService.addTransfusionChart(req.user!.tenantId, req.params.id, req.user!.id, req.body);
      res.status(201).json(chart);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error adding transfusion chart') });
    }
  }

  async addBloodSugarChart(req: Request, res: Response) {
    try {
      const chart = await inpatientService.addBloodSugarChart(req.user!.tenantId, req.params.id, req.user!.id, req.body);
      res.status(201).json(chart);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error adding blood sugar chart') });
    }
  }

  // ==================== OPERATION NOTES (includes postop plan) ====================

  async getOperationNotes(req: Request, res: Response) {
    try {
      const notes = await inpatientService.getOperationNotes(req.user!.tenantId, req.params.id);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching operation notes') });
    }
  }

  async addOperationNote(req: Request, res: Response) {
    try {
      const note = await inpatientService.addOperationNote(req.user!.tenantId, req.params.id, req.user!.id, req.body);
      res.status(201).json(note);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error adding operation note') });
    }
  }

  async getAllOperationNotes(req: Request, res: Response) {
    try {
      const result = await inpatientService.getAllOperationNotes(req.user!.tenantId, {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        sortBy: req.query.sortBy as 'operationDate' | 'surgicalProcedure' | undefined,
        sortDir: req.query.sortDir as 'asc' | 'desc' | undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching operation notes') });
    }
  }

  async getSurgicalProcedureBreakdown(req: Request, res: Response) {
    try {
      const result = await inpatientService.getSurgicalProcedureBreakdown(req.user!.tenantId, {
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching surgical procedure breakdown') });
    }
  }

  // ==================== VOID / CORRECTIONS ====================

  async voidWardRound(req: Request, res: Response) {
    try {
      const result = await inpatientService.voidWardRound(req.user!.tenantId, req.params.id, req.params.recordId, req.user!.id, req.body.reason);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error voiding ward round') });
    }
  }

  async voidVitalChart(req: Request, res: Response) {
    try {
      const result = await inpatientService.voidVitalChart(req.user!.tenantId, req.params.id, req.params.recordId, req.user!.id, req.body.reason);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error voiding vital chart entry') });
    }
  }

  async voidFluidChart(req: Request, res: Response) {
    try {
      const result = await inpatientService.voidFluidChart(req.user!.tenantId, req.params.id, req.params.recordId, req.user!.id, req.body.reason);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error voiding fluid chart entry') });
    }
  }

  async voidTransfusionChart(req: Request, res: Response) {
    try {
      const result = await inpatientService.voidTransfusionChart(req.user!.tenantId, req.params.id, req.params.recordId, req.user!.id, req.body.reason);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error voiding transfusion chart entry') });
    }
  }

  async voidBloodSugarChart(req: Request, res: Response) {
    try {
      const result = await inpatientService.voidBloodSugarChart(req.user!.tenantId, req.params.id, req.params.recordId, req.user!.id, req.body.reason);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error voiding blood sugar chart entry') });
    }
  }

  async voidOperationNote(req: Request, res: Response) {
    try {
      const result = await inpatientService.voidOperationNote(req.user!.tenantId, req.params.id, req.params.recordId, req.user!.id, req.body.reason);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error voiding operation note') });
    }
  }
}
