import { Request, Response } from 'express';
import { OutpatientVitalService } from '../../application/services/outpatient-vital.service';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

const vitalService = new OutpatientVitalService();

export class OutpatientVitalController {
  
  /**
   * Record new vitals for a patient
   * POST /api/vitals/outpatient
   */
  async recordVitals(req: Request, res: Response) {
    try {
      const { tenantId, id: userId } = req.user!;
      const { patientId } = req.body;

      if (!patientId) {
        return res.status(400).json({
          status: 'error',
          message: 'Patient ID is required'
        });
      }

      const vitals = await vitalService.recordVitals(
        tenantId,
        patientId,
        userId,
        req.body
      );

      return res.status(201).json({
        status: 'success',
        message: 'Vitals recorded successfully',
        data: vitals
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: getSafeErrorMessage(error, 'Failed to record vitals')
      });
    }
  }

  /**
   * Get all vitals history for a patient
   * GET /api/vitals/outpatient/patient/:patientId
   */
  async getPatientVitals(req: Request, res: Response) {
    try {
      const { tenantId } = req.user!;
      const { patientId } = req.params;

      const vitals = await vitalService.getPatientVitals(tenantId, patientId);

      return res.status(200).json({
        status: 'success',
        data: vitals
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: getSafeErrorMessage(error, 'Failed to fetch vitals')
      });
    }
  }

  /**
   * Get latest vitals recorded today for a patient
   * GET /api/vitals/outpatient/patient/:patientId/today
   */
  async getLatestVitalsToday(req: Request, res: Response) {
    try {
      const { tenantId } = req.user!;
      const { patientId } = req.params;

      const vitals = await vitalService.getLatestVitalsToday(tenantId, patientId);

      return res.status(200).json({
        status: 'success',
        data: vitals // Can be null if no vitals taken today
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: getSafeErrorMessage(error, 'Failed to fetch latest vitals')
      });
    }
  }
}
