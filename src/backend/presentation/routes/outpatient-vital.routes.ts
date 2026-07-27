import { Router } from 'express';
import { OutpatientVitalController } from '../controllers/outpatient-vital.controller';
import { requireRole } from '../middleware/auth';

const router = Router();
const vitalController = new OutpatientVitalController();

// Create new vitals (Nurses, Doctors only — recording a patient's actual
// vitals is a clinical act; ADMIN/SUPER_ADMIN can view but not create)
router.post(
  '/',
  requireRole(['DOCTOR', 'NURSE']),
  vitalController.recordVitals.bind(vitalController)
);

// Get vitals history for a patient
router.get(
  '/patient/:patientId',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']),
  vitalController.getPatientVitals.bind(vitalController)
);

// Get latest vitals today for a patient
router.get(
  '/patient/:patientId/today',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']),
  vitalController.getLatestVitalsToday.bind(vitalController)
);

export default router;
