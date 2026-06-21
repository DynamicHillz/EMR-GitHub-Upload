/**
 * Consultation Modal
 *
 * Modal for creating/editing consultations with SOAP notes and vital signs
 * REQ-CLIN-1: SOAP format documentation
 * REQ-CLIN-2: Vital signs capture with BMI calculation
 * REQ-CLIN-6: Finalize consultation
 * REQ-CLIN-8: Display patient medical history
 */

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Activity, FileText, Lock, Save, Pill, Beaker } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ErrorAlert from '../common/ErrorAlert';
import PrescriptionModal from './PrescriptionModal';
import LabTestModal from './LabTestModal';
import ConfirmDialog from '../common/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';

interface Patient {
  id: string;
  patientId: string;
  fullName: string;
  age: number;
  gender: string;
  allergies: string[];
  chronicConditions: string[];
}

interface ConsultationModalProps {
  patientId: string;
  patient: Patient;
  consultationId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  weight: string;
  height: string;
  spO2: string;
  icd10Codes: string;
}

const ConsultationModal: React.FC<ConsultationModalProps> = ({
  patientId,
  patient,
  consultationId,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { confirm, isOpen, options, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [status, setStatus] = useState<string>('DRAFT');
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showLabTestModal, setShowLabTestModal] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    bloodPressure: '',
    heartRate: '',
    temperature: '',
    weight: '',
    height: '',
    spO2: '',
    icd10Codes: '',
  });

  useEffect(() => {
    if (consultationId) {
      fetchConsultation();
    }
  }, [consultationId]);

  const fetchConsultation = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/consultations/${consultationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const result = await response.json();
      if (response.ok && result.data) {
        const consultation = result.data;
        setFormData({
          subjective: consultation.subjective || '',
          objective: consultation.objective || '',
          assessment: consultation.assessment || '',
          plan: consultation.plan || '',
          bloodPressure: consultation.vitalSigns.bloodPressure || '',
          heartRate: consultation.vitalSigns.heartRate?.toString() || '',
          temperature: consultation.vitalSigns.temperature?.toString() || '',
          weight: consultation.vitalSigns.weight?.toString() || '',
          height: consultation.vitalSigns.height?.toString() || '',
          spO2: consultation.vitalSigns.spO2?.toString() || '',
          icd10Codes: consultation.icd10Codes?.join(', ') || '',
        });
        setCanEdit(consultation.canEdit);
        setStatus(consultation.status);
      }
    } catch (error) {
      console.error('Error fetching consultation:', error);
      setError('Failed to load consultation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const calculateBMI = () => {
    const weight = parseFloat(formData.weight);
    const height = parseFloat(formData.height);
    if (weight && height) {
      const heightInMeters = height / 100;
      return (weight / heightInMeters ** 2).toFixed(1);
    }
    return null;
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal weight';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      const doctorId = user?.id;

      if (!doctorId) {
        setError('Unable to determine your doctor ID. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const payload: any = {
        subjective: formData.subjective || undefined,
        objective: formData.objective || undefined,
        assessment: formData.assessment || undefined,
        plan: formData.plan || undefined,
        bloodPressure: formData.bloodPressure || undefined,
        heartRate: formData.heartRate ? parseInt(formData.heartRate) : undefined,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        spO2: formData.spO2 ? parseInt(formData.spO2) : undefined,
        icd10Codes: formData.icd10Codes
          ? formData.icd10Codes.split(',').map((c) => c.trim()).filter((c) => c)
          : undefined,
      };

      if (!consultationId) {
        payload.patientId = patientId;
        payload.doctorId = doctorId;
      }

      const url = consultationId
        ? `http://localhost:3000/api/consultations/${consultationId}`
        : 'http://localhost:3000/api/consultations';

      const response = await fetch(url, {
        method: consultationId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage(
          consultationId ? 'Consultation updated successfully!' : 'Consultation created successfully!'
        );
        setTimeout(() => onSuccess(), 1500);
      } else {
        setError(result.message || result.error || 'Failed to save consultation');
      }
    } catch (error) {
      console.error('Error saving consultation:', error);
      setError('Failed to save consultation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    if (!consultationId) {
      setError('Please save the consultation first before finalizing');
      return;
    }

    if (!formData.subjective || !formData.assessment) {
      setError('Subjective (Chief Complaint) and Assessment (Diagnosis) are required to finalize');
      return;
    }

    const confirmed = await confirm({
      title: 'Finalize Consultation',
      message: 'Are you sure you want to finalize this consultation? It cannot be edited after finalization.',
      confirmText: 'Finalize',
      cancelText: 'Cancel',
      variant: 'warning',
    });

    if (!confirmed) return;

    setIsFinalizing(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/consultations/${consultationId}/finalize`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage('Consultation finalized successfully! It can no longer be edited.');
        setTimeout(() => onSuccess(), 1500);
      } else {
        setError(result.message || 'Failed to finalize consultation');
      }
    } catch (error) {
      console.error('Error finalizing consultation:', error);
      setError('Failed to finalize consultation. Please try again.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const bmi = calculateBMI();

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading consultation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6" />
                {consultationId ? 'Edit Consultation' : 'New Consultation'}
              </h3>
              {status === 'FINALIZED' && (
                <span className="mt-2 text-sm bg-green-100 text-green-800 px-3 py-1 rounded flex items-center gap-1 inline-flex">
                  <Lock className="w-4 h-4" />
                  Finalized - Read Only
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4">
              <ErrorAlert message={error} severity="error" onDismiss={() => setError('')} />
            </div>
          )}
          {successMessage && (
            <div className="mb-4">
              <ErrorAlert message={successMessage} severity="info" onDismiss={() => setSuccessMessage('')} />
            </div>
          )}

          {/* Patient Medical History */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Patient Medical History</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="font-medium">Patient:</span> {patient.fullName}</div>
              <div><span className="font-medium">ID:</span> {patient.patientId}</div>
              <div><span className="font-medium">Age:</span> {patient.age} years</div>
              <div><span className="font-medium">Gender:</span> {patient.gender}</div>
            </div>
            {patient.allergies.length > 0 && (
              <div className="mt-3 flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-red-700">Allergies:</span>
                  <span className="ml-2 text-red-600">{patient.allergies.join(', ')}</span>
                </div>
              </div>
            )}
            {patient.chronicConditions.length > 0 && (
              <div className="mt-2 text-sm">
                <span className="font-medium">Chronic Conditions:</span>
                <span className="ml-2">{patient.chronicConditions.join(', ')}</span>
              </div>
            )}
          </div>

          {/* SOAP Notes */}
          <div className="mb-6">
            <h4 className="font-semibold text-lg border-b pb-2 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              SOAP Notes
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  <span className="text-red-500">*</span> Subjective (Chief Complaint, History of Present Illness)
                </label>
                <textarea name="subjective" value={formData.subjective} onChange={handleInputChange}
                  className="input w-full" rows={3}
                  placeholder="Patient's description of symptoms, concerns, history..."
                  required disabled={!canEdit} />
                <span className="text-xs text-gray-500">Required for finalization</span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Objective (Physical Examination Findings)
                </label>
                <textarea name="objective" value={formData.objective} onChange={handleInputChange}
                  className="input w-full" rows={3}
                  placeholder="Physical examination findings, observations..."
                  disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  <span className="text-red-500">*</span> Assessment (Diagnosis)
                </label>
                <textarea name="assessment" value={formData.assessment} onChange={handleInputChange}
                  className="input w-full" rows={2}
                  placeholder="Clinical diagnosis, differential diagnoses..."
                  required disabled={!canEdit} />
                <span className="text-xs text-gray-500">Required for finalization</span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Plan (Treatment Plan)</label>
                <textarea name="plan" value={formData.plan} onChange={handleInputChange}
                  className="input w-full" rows={3}
                  placeholder="Treatment plan, medications, follow-up instructions..."
                  disabled={!canEdit} />
              </div>
            </div>
          </div>

          {/* Vital Signs */}
          <div className="mb-6">
            <h4 className="font-semibold text-lg border-b pb-2 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Vital Signs
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Blood Pressure (mmHg)</label>
                <input type="text" name="bloodPressure" value={formData.bloodPressure}
                  onChange={handleInputChange} className="input w-full" placeholder="120/80"
                  pattern="\d{2,3}/\d{2,3}" disabled={!canEdit} />
                <span className="text-xs text-gray-500">Format: XXX/YYY</span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Heart Rate (bpm)</label>
                <input type="number" name="heartRate" value={formData.heartRate}
                  onChange={handleInputChange} className="input w-full" placeholder="72"
                  min="30" max="250" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Temperature (°C)</label>
                <input type="number" name="temperature" value={formData.temperature}
                  onChange={handleInputChange} className="input w-full" placeholder="36.5"
                  step="0.1" min="30" max="45" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Weight (kg)</label>
                <input type="number" name="weight" value={formData.weight}
                  onChange={handleInputChange} className="input w-full" placeholder="70"
                  step="0.1" min="0.5" max="500" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Height (cm)</label>
                <input type="number" name="height" value={formData.height}
                  onChange={handleInputChange} className="input w-full" placeholder="170"
                  step="0.1" min="20" max="300" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">SpO2 (%)</label>
                <input type="number" name="spO2" value={formData.spO2}
                  onChange={handleInputChange} className="input w-full" placeholder="98"
                  min="0" max="100" disabled={!canEdit} />
              </div>
            </div>
            {bmi && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">Calculated BMI:</span>
                    <span className="ml-2 text-lg font-bold text-blue-600">{bmi}</span>
                    <span className="ml-2 text-sm text-gray-600">
                      ({getBMICategory(parseFloat(bmi))})
                    </span>
                  </div>
                  <Activity className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            )}
          </div>

          {/* ICD-10 Codes */}
          <div className="mb-6">
            <h4 className="font-semibold text-lg border-b pb-2 mb-4">ICD-10 Diagnosis Codes</h4>
            <div>
              <label className="block text-sm font-medium mb-1">ICD-10 Codes (comma-separated)</label>
              <input type="text" name="icd10Codes" value={formData.icd10Codes}
                onChange={handleInputChange} className="input w-full"
                placeholder="e.g., J06.9, R50.9, M25.50" disabled={!canEdit} />
              <span className="text-xs text-gray-500">Enter ICD-10 codes separated by commas</span>
            </div>
          </div>

          {/* Orders */}
          {consultationId && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-lg mb-3">Orders</h4>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowPrescriptionModal(true)}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 py-3"
                  disabled={!canEdit}>
                  <Pill className="w-5 h-5" />
                  New Prescription
                </button>
                <button type="button" onClick={() => setShowLabTestModal(true)}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2 py-3"
                  disabled={!canEdit}>
                  <Beaker className="w-5 h-5" />
                  Order Lab Test
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {!canEdit
                  ? 'Cannot create orders for finalized consultations'
                  : 'Create prescriptions with allergy checking and order lab tests'}
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <button type="button" onClick={onClose} className="btn btn-secondary"
              disabled={isSubmitting || isFinalizing}>
              {canEdit ? 'Cancel' : 'Close'}
            </button>
            <div className="flex gap-3">
              {canEdit && (
                <>
                  <button type="button" onClick={handleSave}
                    className="btn btn-primary flex items-center gap-2"
                    disabled={isSubmitting || isFinalizing}>
                    <Save className="w-4 h-4" />
                    {isSubmitting ? 'Saving...' : consultationId ? 'Update Consultation' : 'Create Consultation'}
                  </button>
                  {consultationId && (
                    <button type="button" onClick={handleFinalize}
                      className="btn bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                      disabled={isSubmitting || isFinalizing}>
                      <Lock className="w-4 h-4" />
                      {isFinalizing ? 'Finalizing...' : 'Finalize'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prescription Modal */}
      {showPrescriptionModal && consultationId && (
        <PrescriptionModal
          consultationId={consultationId}
          patient={patient}
          onClose={() => setShowPrescriptionModal(false)}
          onSuccess={() => {
            setShowPrescriptionModal(false);
            setSuccessMessage('Prescription created successfully!');
          }}
        />
      )}

      {/* Lab Test Modal */}
      {showLabTestModal && consultationId && (
        <LabTestModal
          consultationId={consultationId}
          patient={patient}
          onClose={() => setShowLabTestModal(false)}
          onSuccess={() => {
            setShowLabTestModal(false);
            setSuccessMessage('Lab test ordered successfully!');
          }}
        />
      )}

      {/* Finalize Confirm Dialog */}
      <ConfirmDialog
        isOpen={isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        loading={confirmLoading}
      />
    </div>
  );
};

export default ConsultationModal;