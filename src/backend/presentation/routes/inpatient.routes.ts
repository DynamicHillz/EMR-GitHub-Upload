import { Router } from 'express';
import { InpatientController } from '../controllers/inpatient.controller';
import { requireRole } from '../middleware/auth';

const router = Router();
const inpatientController = new InpatientController();

// Manage wards
router.get('/wards', requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']), inpatientController.getWards.bind(inpatientController));
router.post('/wards', requireRole(['SUPER_ADMIN', 'ADMIN']), inpatientController.createWard.bind(inpatientController));
router.put('/wards/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), inpatientController.updateWard.bind(inpatientController));
router.delete('/wards/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), inpatientController.deleteWard.bind(inpatientController));
router.get('/admissions', requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'CASHIER']), inpatientController.getAdmissions.bind(inpatientController));
router.get('/admissions/billable', requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']), inpatientController.getBillableAdmissions.bind(inpatientController));
router.get('/transfusions/billable', requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']), inpatientController.getBillableTransfusions.bind(inpatientController));
router.get('/operation-notes/billable', requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']), inpatientController.getBillableOperationNotes.bind(inpatientController));
router.get('/operation-notes/analytics', requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']), inpatientController.getSurgicalProcedureBreakdown.bind(inpatientController));
router.get('/admissions/patient/:patientId', requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'CASHIER']), inpatientController.getAdmissionsByPatientId.bind(inpatientController));
router.get('/admissions/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'CASHIER']), inpatientController.getAdmissionById.bind(inpatientController));

// Clinical Actions (Doctors/Nurses only)
router.post('/admissions', requireRole(['DOCTOR', 'NURSE']), inpatientController.admitPatient.bind(inpatientController));
router.put('/admissions/:id/settings', requireRole(['DOCTOR', 'NURSE']), inpatientController.updateAdmissionSettings.bind(inpatientController));
router.post('/admissions/:id/discharge', requireRole(['DOCTOR', 'NURSE']), inpatientController.dischargePatient.bind(inpatientController));
router.post('/admissions/:id/transfer', requireRole(['DOCTOR', 'NURSE']), inpatientController.transferPatient.bind(inpatientController));

// Ward Rounds and Medications (Clinical Staff only)
router.post('/admissions/:id/ward-rounds', requireRole(['DOCTOR']), inpatientController.addWardRound.bind(inpatientController));
router.delete('/admissions/:id/ward-rounds/:recordId', requireRole(['DOCTOR']), inpatientController.voidWardRound.bind(inpatientController));
router.post('/admissions/:id/medications', requireRole(['NURSE', 'DOCTOR']), inpatientController.addMedicationAdministration.bind(inpatientController));

// Charts (Clinical Staff only)
router.get('/admissions/:id/charts', requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']), inpatientController.getCharts.bind(inpatientController));
router.post('/admissions/:id/vitals', requireRole(['DOCTOR', 'NURSE']), inpatientController.addVitalChart.bind(inpatientController));
router.delete('/admissions/:id/vitals/:recordId', requireRole(['DOCTOR', 'NURSE']), inpatientController.voidVitalChart.bind(inpatientController));
router.post('/admissions/:id/fluids', requireRole(['DOCTOR', 'NURSE']), inpatientController.addFluidChart.bind(inpatientController));
router.delete('/admissions/:id/fluids/:recordId', requireRole(['DOCTOR', 'NURSE']), inpatientController.voidFluidChart.bind(inpatientController));
router.post('/admissions/:id/transfusions', requireRole(['DOCTOR', 'NURSE']), inpatientController.addTransfusionChart.bind(inpatientController));
router.delete('/admissions/:id/transfusions/:recordId', requireRole(['DOCTOR', 'NURSE']), inpatientController.voidTransfusionChart.bind(inpatientController));
router.post('/admissions/:id/blood-sugar', requireRole(['DOCTOR', 'NURSE']), inpatientController.addBloodSugarChart.bind(inpatientController));
router.delete('/admissions/:id/blood-sugar/:recordId', requireRole(['DOCTOR', 'NURSE']), inpatientController.voidBloodSugarChart.bind(inpatientController));

// Operation Notes (includes postop plan — see OperationNote.plan) (Clinical Staff only)
router.get('/admissions/:id/operation-notes', requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']), inpatientController.getOperationNotes.bind(inpatientController));
router.post('/admissions/:id/operation-notes', requireRole(['DOCTOR']), inpatientController.addOperationNote.bind(inpatientController));
router.delete('/admissions/:id/operation-notes/:recordId', requireRole(['DOCTOR']), inpatientController.voidOperationNote.bind(inpatientController));

// Cross-admission surgery log — every operation note recorded at this
// clinic, regardless of which doctor recorded it, so staff don't have to
// open each patient individually to find one. Same role set as the
// per-admission read above.
router.get('/operation-notes', requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']), inpatientController.getAllOperationNotes.bind(inpatientController));

// Bed management
router.put('/beds/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), inpatientController.updateBed.bind(inpatientController));

export default router;
