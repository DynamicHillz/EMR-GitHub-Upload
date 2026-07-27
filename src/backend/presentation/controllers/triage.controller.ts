import { Request, Response } from 'express';
import { TriageService } from '../../domain/services/triage.service';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

const triageService = new TriageService();

export class TriageController {
  async getTriageQueue(req: Request, res: Response) {
    try {
      const queue = await triageService.getTriageQueue(req.user!.tenantId);
      res.json(queue);
    } catch (error: any) {
      res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching triage queue') });
    }
  }

  async getTriageRecord(req: Request, res: Response) {
    try {
      const record = await triageService.getTriageRecord(req.user!.tenantId, req.params.id);
      res.json(record);
    } catch (error: any) {
      res.status(404).json({ message: getSafeErrorMessage(error, 'Triage record not found') });
    }
  }

  async getPatientTriageHistory(req: Request, res: Response) {
    try {
      const history = await triageService.getPatientTriageHistory(req.user!.tenantId, req.params.patientId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: getSafeErrorMessage(error, 'Error fetching patient triage history') });
    }
  }

  async createTriageRecord(req: Request, res: Response) {
    try {
      const record = await triageService.createTriageRecord(req.user!.tenantId, req.user!.id, req.body);
      res.status(201).json(record);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error creating triage record') });
    }
  }

  async updateTriageRecord(req: Request, res: Response) {
    try {
      const record = await triageService.updateTriageRecord(req.user!.tenantId, req.params.id, req.body);
      res.json(record);
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ message: getSafeErrorMessage(error, 'Error updating triage record') });
    }
  }

  async markAsSeen(req: Request, res: Response) {
    try {
      const record = await triageService.markAsSeen(req.user!.tenantId, req.params.id);
      res.json(record);
    } catch (error: any) {
      res.status(400).json({ message: getSafeErrorMessage(error, 'Error marking triage record as seen') });
    }
  }
}
