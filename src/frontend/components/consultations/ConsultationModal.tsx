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
import { X, AlertCircle, Activity, FileText, Lock, Save, Pill, Beaker, Wind } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ErrorAlert from '../common/ErrorAlert';
import PrescriptionModal from './PrescriptionModal';
import LabTestModal from './LabTestModal';
import RecordConsumableUsageModal from '../pharmacy/RecordConsumableUsageModal';
import ConfirmDialog from '../common/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import DiagnosisAutocomplete from '../common/DiagnosisAutocomplete';
import { offlineFetch } from '../../services/offlineFetch';
import Dropdown from '../common/Dropdown';
import TypeaheadTextField from '../common/TypeaheadTextField';

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  gender: string;
  allergies: string[];
  chronicConditions: string[];
}

interface OrderItem {
  id: string;
  name: string;
  status: string;
  type: 'prescription' | 'lab_test';
  details?: string;
  createdAt?: string;
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
  systolicBP: string;
  diastolicBP: string;
  createdAt?: string;
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

  const [localConsultationId, setLocalConsultationId] = useState<string | null>(consultationId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [status, setStatus] = useState<string>('DRAFT');
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showLabTestModal, setShowLabTestModal] = useState(false);
  const [showOxygenModal, setShowOxygenModal] = useState(false);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [orderedItems, setOrderedItems] = useState<OrderItem[]>([]);
  const [latestTriage, setLatestTriage] = useState<any>(null);
  const lastSavedSoapRef = React.useRef({ subjective: '', objective: '', assessment: '', plan: '' });
  const autosaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Optimistic-concurrency token from the server — echoed back on every
  // save so a stale save (autosave racing a manual save, another tab, etc.)
  // gets a conflict instead of silently overwriting newer content.
  const [currentVersion, setCurrentVersion] = useState<number | undefined>(undefined);
  const [clinicalSummary, setClinicalSummary] = useState<{
    activePrescriptions: { medicationName: string; dosage: string; frequency: string; prescriberName: string }[];
    recentDiagnoses: { code: string; name: string; diagnosedAt: string }[];
  } | null>(null);

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
    systolicBP: '',
    diastolicBP: '',
  });

  const fetchOrders = async (consId: string, patId: string) => {
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const items: OrderItem[] = [];

      // Fetch prescriptions
      try {
        const rxRes = await fetch(
          `${apiBaseUrl}/api/prescriptions?consultationId=${consId}&patientId=${patId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (rxRes.ok) {
          const rxData = await rxRes.json();
          const rxList = Array.isArray(rxData.data) ? rxData.data : (Array.isArray(rxData) ? rxData : []);
          rxList.forEach((rx: any) => {
            items.push({
              id: rx.id,
              name: rx.medicationName || rx.medication?.name || 'Prescription',
              status: rx.status || 'PENDING',
              type: 'prescription',
              details: rx.dosage ? `${rx.dosage} - ${rx.frequency || ''}` : '',
              createdAt: rx.createdAt,
            });
          });
        }
      } catch (e) {
        console.error('Error fetching prescriptions:', e);
      }

      // Fetch lab tests
      try {
        const labRes = await fetch(
          `${apiBaseUrl}/api/lab/tests?consultationId=${consId}&patientId=${patId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (labRes.ok) {
          const labData = await labRes.json();
          const labList = Array.isArray(labData.data) ? labData.data : (Array.isArray(labData) ? labData : []);
          labList.forEach((lab: any) => {
            items.push({
              id: lab.id,
              name: lab.testName || lab.test?.name || 'Lab Test',
              status: lab.status || 'PENDING',
              type: 'lab_test',
              details: lab.priority ? `Priority: ${lab.priority}` : '',
              createdAt: lab.createdAt,
            });
          });
        }
      } catch (e) {
        console.error('Error fetching lab tests:', e);
      }

      setOrderedItems(items);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrderedItems([]);
    }
  };

  const autoCreateDraft = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const doctorId = user?.id;
      if (!doctorId) return;

      const payload = { patientId, doctorId };
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const response = await fetch(`${apiBaseUrl}/api/consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.ok && result.data?.id) {
        setLocalConsultationId(result.data.id);
        fetchConsultation(result.data.id);
      }
    } catch (e) {
      console.error('Failed to auto-create draft:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConsultation = async (id: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const response = await fetch(
        `${apiBaseUrl}/api/consultations/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const result = await response.json();
      if (response.ok && result.data) {
        const consultation = result.data;
        // Strip legacy auto-filled chief complaint prefix if present
        let cleanSubjective = consultation.subjective || '';
        if (cleanSubjective.startsWith('Chief Complaint from Triage: ')) {
          cleanSubjective = cleanSubjective.replace(/^Chief Complaint from Triage: .*?(\n\n|$)/s, '');
        }

        lastSavedSoapRef.current = {
          subjective: cleanSubjective,
          objective: consultation.objective || '',
          assessment: consultation.assessment || '',
          plan: consultation.plan || '',
        };
        setFormData({
          subjective: cleanSubjective,
          objective: consultation.objective || '',
          assessment: consultation.assessment || '',
          plan: consultation.plan || '',
          bloodPressure: consultation.vitalSigns?.bloodPressure || '',
          heartRate: consultation.vitalSigns?.heartRate?.toString() || '',
          temperature: consultation.vitalSigns?.temperature?.toString() || '',
          weight: consultation.vitalSigns?.weight?.toString() || '',
          height: consultation.vitalSigns?.height?.toString() || '',
          spO2: consultation.vitalSigns?.spO2?.toString() || '',
          systolicBP: consultation.vitalSigns?.systolicBP?.toString() || (consultation.vitalSigns?.bloodPressure ? consultation.vitalSigns.bloodPressure.split('/')[0] : ''),
          diastolicBP: consultation.vitalSigns?.diastolicBP?.toString() || (consultation.vitalSigns?.bloodPressure ? consultation.vitalSigns.bloodPressure.split('/')[1] : ''),
        });
        setDiagnoses(consultation.diagnoses || []);
        setCanEdit(consultation.canEdit);
        setStatus(consultation.status);
        setCurrentVersion(consultation.version);
      }
    } catch (error) {
      console.error('Error fetching consultation:', error);
      setError('Failed to load consultation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const draftCreatedRef = React.useRef(false);

  useEffect(() => {
    if (consultationId) {
      setLocalConsultationId(consultationId);
      fetchConsultation(consultationId);
      fetchOrders(consultationId, patient.id);
    } else if (!localConsultationId && patientId && !draftCreatedRef.current) {
      draftCreatedRef.current = true;
      autoCreateDraft();
    }

    const fetchTriage = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
        const res = await fetch(`${apiBaseUrl}/api/triage/patient/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const history = await res.json();
        const triageList = Array.isArray(history) ? history : (history.data || []);
        
        if (triageList.length > 0) {
          setLatestTriage(triageList[0]); // assuming sorted descending by date
        }
      } catch (e) {
        console.error('Failed to fetch triage data', e);
      }
    };
    fetchTriage();

    const fetchClinicalSummary = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
        const res = await fetch(`${apiBaseUrl}/api/patients/${patientId}/clinical-summary`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const result = await res.json();
          setClinicalSummary(result.data || null);
        }
      } catch (e) {
        console.error('Failed to fetch patient clinical summary', e);
      }
    };
    fetchClinicalSummary();
  }, [consultationId, patientId]);

  useEffect(() => {
    if (localConsultationId) {
      fetchOrders(localConsultationId, patient.id);
    }
  }, [showPrescriptionModal, showLabTestModal]);

  useEffect(() => {
    if (latestTriage) {
      setFormData((prev) => ({
        ...prev,
        bloodPressure: prev.bloodPressure || (latestTriage.systolicBP && latestTriage.diastolicBP ? `${latestTriage.systolicBP}/${latestTriage.diastolicBP}` : ''),
        heartRate: prev.heartRate || (latestTriage.heartRate ? latestTriage.heartRate.toString() : ''),
        temperature: prev.temperature || (latestTriage.temperature ? latestTriage.temperature.toString() : ''),
        weight: prev.weight || (latestTriage.weight ? latestTriage.weight.toString() : ''),
        spO2: prev.spO2 || (latestTriage.spO2 ? latestTriage.spO2.toString() : ''),
        systolicBP: prev.systolicBP || (latestTriage.systolicBP ? latestTriage.systolicBP.toString() : ''),
        diastolicBP: prev.diastolicBP || (latestTriage.diastolicBP ? latestTriage.diastolicBP.toString() : '')
      }));
    }
  }, [latestTriage]);


  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const hasUnsavedSoapChanges = () =>
    formData.subjective !== lastSavedSoapRef.current.subjective ||
    formData.objective !== lastSavedSoapRef.current.objective ||
    formData.assessment !== lastSavedSoapRef.current.assessment ||
    formData.plan !== lastSavedSoapRef.current.plan;

  // Debounced background autosave — an interruption mid-note loses at most a
  // few seconds of typing instead of everything since the last manual Save Draft.
  useEffect(() => {
    if (!canEdit || !localConsultationId || isSubmitting) return;
    if (!hasUnsavedSoapChanges()) return;

    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      handleSave(false);
    }, 12000);

    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.subjective, formData.objective, formData.assessment, formData.plan, canEdit, localConsultationId]);

  const handleCloseAttempt = async () => {
    if (!canEdit || !hasUnsavedSoapChanges()) {
      onClose();
      return;
    }
    const confirmed = await confirm({
      title: 'Discard unsaved notes?',
      message: 'You have unsaved changes to this consultation. Closing now will discard them.',
      confirmText: 'Discard',
      cancelText: 'Keep Editing',
      variant: 'warning',
    });
    if (confirmed) onClose();
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

  const handleSave = async (showSuccessMsg = true): Promise<boolean> => {
    // Whichever save actually runs first, cancel any pending autosave timer
    // so a stale one can't fire again after this — the version guard above
    // is the real safety net, this just avoids a redundant/confusing extra save.
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

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
        subjective: formData.subjective || "",
        objective: formData.objective || "",
        assessment: formData.assessment || "",
        plan: formData.plan || "",
        heartRate: formData.heartRate ? parseInt(formData.heartRate) : undefined,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        spO2: formData.spO2 ? parseInt(formData.spO2) : undefined,
        bloodPressure: (formData.systolicBP && formData.diastolicBP) ? `${formData.systolicBP}/${formData.diastolicBP}` : undefined,
        diagnoses: diagnoses.map(d => ({ 
          diagnosisId: d.diagnosisId || d.id, 
          code: d.code,
          name: d.name,
          type: d.type || 'ICD-11',
          isPrimary: d.isPrimary, 
          notes: d.notes 
        })),
      };

      if (!localConsultationId) {
        payload.patientId = patientId;
        payload.doctorId = doctorId;
      } else {
        payload.version = currentVersion;
      }

      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const url = localConsultationId
        ? `${apiBaseUrl}/api/consultations/${localConsultationId}`
        : `${apiBaseUrl}/api/consultations`;

      const requestInit: RequestInit = {
        method: localConsultationId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      };

      // Only UPDATE (editing an existing consultation) can be queued for
      // offline replay — the sync push endpoint doesn't support CREATE yet.
      const response = localConsultationId
        ? await offlineFetch(url, requestInit, { entityType: 'CONSULTATION', entityId: localConsultationId, baseVersion: currentVersion })
        : await fetch(url, requestInit);

      const result = await response.json();

      if (result.queued) {
        lastSavedSoapRef.current = {
          subjective: formData.subjective,
          objective: formData.objective,
          assessment: formData.assessment,
          plan: formData.plan,
        };
        if (showSuccessMsg) {
          setSuccessMessage('Saved offline — will sync automatically when your connection returns.');
          setTimeout(() => setSuccessMessage(''), 3000);
        }
        onSuccess();
        return true;
      } else if (response.ok) {
        lastSavedSoapRef.current = {
          subjective: formData.subjective,
          objective: formData.objective,
          assessment: formData.assessment,
          plan: formData.plan,
        };
        setCurrentVersion(result.data?.version);
        if (!localConsultationId && result.data?.id) {
          setLocalConsultationId(result.data.id);
        }
        if (showSuccessMsg) {
          setSuccessMessage(
            localConsultationId ? 'Consultation updated successfully!' : 'Consultation created successfully!'
          );
          // Keep modal open so they can continue working
          setTimeout(() => setSuccessMessage(''), 3000);
        }

        // Notify parent list to refresh silently
        onSuccess();
        return true;
      } else if (response.status === 409) {
        setError('This consultation was changed elsewhere while you were editing. Reload it to see the latest version before saving again.');
        return false;
      } else {
        setError(result.message || result.error || 'Failed to save consultation');
        return false;
      }
    } catch (error) {
      console.error('Error saving consultation:', error);
      setError('Failed to save consultation. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    if (!localConsultationId) {
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

    // Save the consultation to ensure backend has the latest subjective and assessment
    const isSaved = await handleSave(false);
    if (!isSaved) {
      return; // Error is already set by handleSave
    }

    setIsFinalizing(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const response = await fetch(
        `${apiBaseUrl}/api/consultations/${localConsultationId}/finalize`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage('Consultation finalized successfully! It can no longer be edited.');
        setTimeout(() => {
          onClose(); // Explicitly close on finalize
          onSuccess();
        }, 1500);
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
              <h3 className="text-2xl font-bold">
                {consultationId ? 'Edit Consultation' : 'New Consultation'}
              </h3>
              {status === 'FINALIZED' && (
                <span className="mt-2 text-sm bg-green-100 text-green-800 px-3 py-1 rounded flex items-center gap-1 inline-flex">
                  <Lock className="w-4 h-4" />
                  Finalized - Read Only
                </span>
              )}
            </div>
            <button onClick={handleCloseAttempt} className="text-gray-400 hover:text-gray-600">
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
            {Array.isArray(patient.allergies) && patient.allergies.length > 0 && (
              <div className="mt-3 flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-red-700">Allergies:</span>
                  <span className="ml-2 text-red-600">{patient.allergies.join(', ')}</span>
                </div>
              </div>
            )}
            {Array.isArray(patient.chronicConditions) && patient.chronicConditions.length > 0 && (
              <div className="mt-2 text-sm">
                <span className="font-medium">Chronic Conditions:</span>
                <span className="ml-2">{patient.chronicConditions.join(', ')}</span>
              </div>
            )}
            {latestTriage?.chiefComplaint && (
              <div className="mt-2 text-sm">
                <span className="font-medium text-blue-800">Triage Chief Complaint:</span>
                <span className="ml-2 text-blue-900">{latestTriage.chiefComplaint}</span>
              </div>
            )}
            {clinicalSummary && clinicalSummary.activePrescriptions.length > 0 && (
              <div className="mt-2 text-sm">
                <span className="font-medium">Active Medications:</span>
                <span className="ml-2">
                  {clinicalSummary.activePrescriptions
                    .map((rx) => `${rx.medicationName} (${rx.dosage}, ${rx.frequency})`)
                    .join('; ')}
                </span>
              </div>
            )}
            {clinicalSummary && clinicalSummary.recentDiagnoses.length > 0 && (
              <div className="mt-2 text-sm">
                <span className="font-medium">Recent Diagnoses:</span>
                <span className="ml-2">
                  {clinicalSummary.recentDiagnoses
                    .map((dx) => `${dx.name} (${dx.code})`)
                    .join('; ')}
                </span>
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
                <TypeaheadTextField name="subjective" value={formData.subjective} onChange={handleInputChange}
                  className="input w-full" rows={3}
                  placeholder="Patient's description of symptoms, concerns, history..."
                  required disabled={!canEdit} />
                <span className="text-xs text-gray-500">Required for finalization</span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Objective (Physical Examination Findings)
                </label>
                <TypeaheadTextField name="objective" value={formData.objective} onChange={handleInputChange}
                  className="input w-full" rows={3}
                  placeholder="Physical examination findings, observations..."
                  disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  <span className="text-red-500">*</span> Assessment (Diagnosis)
                </label>
                <TypeaheadTextField name="assessment" value={formData.assessment} onChange={handleInputChange}
                  className="input w-full" rows={2}
                  placeholder="Clinical diagnosis, differential diagnoses..."
                  required disabled={!canEdit} />
                <span className="text-xs text-gray-500">Required for finalization</span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Plan (Treatment Plan)</label>
                <TypeaheadTextField name="plan" value={formData.plan} onChange={handleInputChange}
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
                <div className="flex items-center gap-2">
                  <input type="number" name="systolicBP" value={formData.systolicBP}
                    onChange={handleInputChange} className="input w-full" placeholder="Sys"
                    min="50" max="250" disabled={!canEdit} />
                  <span className="text-gray-500">/</span>
                  <input type="number" name="diastolicBP" value={formData.diastolicBP}
                    onChange={handleInputChange} className="input w-full" placeholder="Dia"
                    min="30" max="150" disabled={!canEdit} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pulse Rate (bpm)</label>
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

          {/* Diagnoses */}
          <div className="mb-6">
            <h4 className="font-semibold text-lg border-b pb-2 mb-4">WHO ICD-10 Diagnoses</h4>
            {canEdit && (
              <div className="mb-4">
                <DiagnosisAutocomplete 
                  onSelect={(diagnosis) => {
                    if (!diagnoses.find(d => (d.diagnosisId || d.id) === diagnosis.id)) {
                      setDiagnoses([...diagnoses, { ...diagnosis, diagnosisId: diagnosis.id, isPrimary: diagnoses.length === 0, notes: '', certainty: 'CONFIRMED' }]);
                    }
                  }}
                />
              </div>
            )}
            
            {diagnoses.length > 0 && (
              <div className="space-y-3">
                {diagnoses.map((d, index) => (
                  <div key={index} className="flex flex-col md:flex-row md:items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-blue-700">{d.code} - {d.name}</div>
                      <input 
                        type="text" 
                        className="input text-sm mt-1 w-full" 
                        placeholder="Add notes..." 
                        value={d.notes || ''}
                        onChange={(e) => {
                          const newDiagnoses = [...diagnoses];
                          newDiagnoses[index].notes = e.target.value;
                          setDiagnoses(newDiagnoses);
                        }}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-2 md:mt-0">
                      <label className="flex items-center gap-1 text-sm cursor-pointer">
                        <input 
                          type="radio" 
                          name={`primaryDiagnosis_${index}`} 
                          checked={d.isPrimary}
                          onChange={() => {
                            const newDiagnoses = diagnoses.map((diag, i) => ({
                              ...diag,
                              isPrimary: i === index
                            }));
                            setDiagnoses(newDiagnoses);
                          }}
                          disabled={!canEdit}
                        />
                        Primary
                      </label>
                      <Dropdown 
                        className="input text-sm py-1 px-2 h-auto"
                        value={d.certainty || 'CONFIRMED'}
                        onChange={(e) => {
                          const newDiagnoses = [...diagnoses];
                          newDiagnoses[index].certainty = e.target.value;
                          setDiagnoses(newDiagnoses);
                        }}
                        disabled={!canEdit}
                      >
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="PRESUMPTIVE">Presumptive</option>
                        <option value="DIFFERENTIAL">Differential</option>
                      </Dropdown>
                      {canEdit && (
                        <button 
                          type="button" 
                          onClick={() => {
                            const newDiagnoses = diagnoses.filter((_, i) => i !== index);
                            if (d.isPrimary && newDiagnoses.length > 0) {
                              newDiagnoses[0].isPrimary = true;
                            }
                            setDiagnoses(newDiagnoses);
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {diagnoses.length === 0 && !canEdit && (
              <p className="text-gray-500 text-sm">No diagnoses recorded.</p>
            )}
          </div>

          {/* Orders */}
          {localConsultationId && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-lg mb-3">Orders</h4>
              
              {/* Ordered Items List */}
              {orderedItems.length > 0 && (
                <div className="mb-4 space-y-2">
                  {orderedItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        {item.type === 'prescription' ? (
                          <Pill className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Beaker className="w-5 h-5 text-purple-500" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.details}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        item.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        item.status === 'DISPENSED' || item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <button type="button" onClick={() => { setShowPrescriptionModal(v => !v); setShowLabTestModal(false); }}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 py-3"
                  disabled={!canEdit}>
                  <Pill className="w-5 h-5" />
                  {showPrescriptionModal ? 'Cancel New Prescription' : 'New Prescription'}
                </button>
                <button type="button" onClick={() => { setShowLabTestModal(v => !v); setShowPrescriptionModal(false); }}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2 py-3"
                  disabled={!canEdit}>
                  <Beaker className="w-5 h-5" />
                  {showLabTestModal ? 'Cancel Lab Order' : 'Order Lab Test'}
                </button>
                <button type="button" onClick={() => setShowOxygenModal(true)}
                  className="btn bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-2 py-3"
                  disabled={!canEdit}>
                  <Wind className="w-5 h-5" />
                  Record Oxygen
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                {!canEdit
                  ? 'Cannot create orders for finalized consultations'
                  : 'Create prescriptions with allergy checking and order lab tests'}
              </p>

              {/* Inline Prescription Order */}
              {showPrescriptionModal && (
                <PrescriptionModal
                  variant="inline"
                  context={{ type: 'consultation', consultationId: localConsultationId! }}
                  patient={patient}
                  onClose={() => setShowPrescriptionModal(false)}
                  onSuccess={() => {
                    setShowPrescriptionModal(false);
                    setSuccessMessage('Prescription created successfully!');
                  }}
                />
              )}

              {/* Inline Lab Test Order */}
              {showLabTestModal && (
                <LabTestModal
                  variant="inline"
                  consultationId={localConsultationId!}
                  patient={patient}
                  onClose={() => setShowLabTestModal(false)}
                  onSuccess={() => {
                    setShowLabTestModal(false);
                    setSuccessMessage('Lab test ordered successfully!');
                  }}
                />
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <button type="button" onClick={handleCloseAttempt} className="btn btn-secondary"
              disabled={isSubmitting || isFinalizing}>
              {canEdit ? 'Cancel' : 'Close'}
            </button>
            <div className="flex gap-3">
              {canEdit && (
                <>
                  <button type="button" onClick={handleSave} disabled={isSubmitting || !canEdit}
                  className="btn btn-primary min-w-[200px]">
                  {isSubmitting ? 'Saving...' : 'Save Draft'}
                </button>
                {localConsultationId && (
                  <button type="button" onClick={handleFinalize} disabled={isFinalizing || !canEdit}
                    className="btn bg-green-600 hover:bg-green-700 text-white min-w-[150px] flex items-center justify-center gap-2">
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
      <RecordConsumableUsageModal
        isOpen={showOxygenModal}
        onClose={() => setShowOxygenModal(false)}
        onSuccess={() => setSuccessMessage('Oxygen usage recorded and queued for billing.')}
        patientId={patientId}
        patientLabel={patient.fullName}
        consultationId={localConsultationId || undefined}
        lockToCategory="Oxygen"
      />
    </div>
  );
};

export default ConsultationModal;