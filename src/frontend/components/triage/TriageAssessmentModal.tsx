import React, { useEffect, useMemo, useRef, useState } from 'react';
import { offlineFetch } from '../../services/offlineFetch';
import ErrorAlert from '../common/ErrorAlert';
import ConfirmDialog from '../common/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import { useDraftPersistence } from '../../hooks/useDraftPersistence';
import { useToast } from '../ToastContainer';
import { suggestTriageCategory } from '../../utils/triageAcuity';
import Dropdown from '../common/Dropdown';
import { getErrorMessage } from '../../utils/errorHandler';
import { Wind } from 'lucide-react';
import RecordConsumableUsageModal from '../pharmacy/RecordConsumableUsageModal';

const CATEGORY_DISPLAY: Record<string, { emoji: string; label: string }> = {
  RESUSCITATION: { emoji: '🔴', label: 'RESUSCITATION' },
  EMERGENT: { emoji: '🟠', label: 'EMERGENT' },
  URGENT: { emoji: '🟡', label: 'URGENT' },
  SEMI_URGENT: { emoji: '🟢', label: 'SEMI-URGENT' },
};

interface TriageAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  appointmentId?: string;
  onSuccess: () => void;
}

const TriageAssessmentModal: React.FC<TriageAssessmentModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  appointmentId,
  onSuccess,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOxygenModal, setShowOxygenModal] = useState(false);

  const [formData, setFormData] = useState({
    chiefComplaint: '',
    category: 'NON_URGENT',
    systolicBP: '',
    diastolicBP: '',
    heartRate: '',
    temperature: '',
    respiratoryRate: '',
    spO2: '',
    weight: '',
    painScore: '',
    glucoseLevel: '',
    consciousnessLevel: 'Alert',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const { confirm, isOpen: confirmIsOpen, options: confirmOptions, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();
  const draftKey = `triage-draft-${patientId}`;
  const triageDraft = useDraftPersistence(draftKey, formData, isOpen);
  const hasPromptedRestore = useRef(false);

  const vitalsFieldNames = ['systolicBP', 'diastolicBP', 'heartRate', 'temperature', 'respiratoryRate', 'spO2', 'weight', 'painScore', 'glucoseLevel'] as const;
  const hasAnyVitals = vitalsFieldNames.some((f) => formData[f]);

  useEffect(() => {
    if (!isOpen || hasPromptedRestore.current) return;
    hasPromptedRestore.current = true;

    const draft = triageDraft.restore();
    const draftHasContent = !!draft && (draft.chiefComplaint || vitalsFieldNames.some((f) => draft[f]));
    if (draftHasContent) {
      confirm({
        title: 'Restore unsaved triage entry?',
        message: `You have an unsaved triage assessment in progress for ${patientName}. Restore it, or start fresh?`,
        confirmText: 'Restore Draft',
        cancelText: 'Start Fresh',
        variant: 'info',
      }).then((restoreConfirmed) => {
        if (restoreConfirmed) {
          setFormData(draft!);
        } else {
          triageDraft.clear();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const acuitySuggestion = useMemo(
    () =>
      suggestTriageCategory({
        systolicBP: formData.systolicBP ? parseInt(formData.systolicBP) : undefined,
        heartRate: formData.heartRate ? parseInt(formData.heartRate) : undefined,
        respiratoryRate: formData.respiratoryRate ? parseInt(formData.respiratoryRate) : undefined,
        spO2: formData.spO2 ? parseInt(formData.spO2) : undefined,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        glucoseLevel: formData.glucoseLevel ? parseFloat(formData.glucoseLevel) : undefined,
        painScore: formData.painScore ? parseInt(formData.painScore) : undefined,
        consciousnessLevel: formData.consciousnessLevel,
      }),
    [
      formData.systolicBP,
      formData.heartRate,
      formData.respiratoryRate,
      formData.spO2,
      formData.temperature,
      formData.glucoseLevel,
      formData.painScore,
      formData.consciousnessLevel,
    ]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        patientId,
        appointmentId,
        chiefComplaint: formData.chiefComplaint,
        category: formData.category as any,
        systolicBP: formData.systolicBP ? parseInt(formData.systolicBP) : undefined,
        diastolicBP: formData.diastolicBP ? parseInt(formData.diastolicBP) : undefined,
        heartRate: formData.heartRate ? parseInt(formData.heartRate) : undefined,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        respiratoryRate: formData.respiratoryRate ? parseInt(formData.respiratoryRate) : undefined,
        spO2: formData.spO2 ? parseInt(formData.spO2) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        painScore: formData.painScore ? parseInt(formData.painScore) : undefined,
        glucoseLevel: formData.glucoseLevel ? parseFloat(formData.glucoseLevel) : undefined,
        consciousnessLevel: formData.consciousnessLevel,
      };

      // Generated up front so it can double as the idempotency key if this
      // request fails and gets queued for offline replay (see
      // sync.controller.ts's applyCreate) — the same id is used whether the
      // create succeeds immediately or only after reconnecting later.
      const entityId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

      const response = await offlineFetch(
        `${apiBaseUrl}/api/triage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...payload, id: entityId }),
        },
        { entityType: 'TRIAGE', entityId, operation: 'CREATE' }
      );

      const result = await response.json();

      if (result.queued) {
        triageDraft.clear();
        toast.success('Saved offline', `${patientName}'s triage will sync automatically when your connection returns.`);
        onSuccess();
        onClose();
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit triage assessment');
      }

      triageDraft.clear();
      toast.success('Triage recorded', `${patientName} added to the doctor queue.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to submit triage assessment'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              WHO ETAT Triage Assessment - {patientName}
            </h3>

            {error && <ErrorAlert message={error} />}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Category & Complaint */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Chief Complaint *</label>
                  <textarea
                    name="chiefComplaint"
                    required
                    value={formData.chiefComplaint}
                    onChange={handleChange}
                    className="input w-full mt-1"
                    rows={2}
                  ></textarea>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Triage Category (Priority) *</label>
                  <Dropdown
                    name="category"
                    required
                    value={formData.category}
                    onChange={handleChange}
                    className="input w-full mt-1"
                  >
                    <option value="RESUSCITATION">🔴 RESUSCITATION (Immediate, Life-saving)</option>
                    <option value="EMERGENT">🟠 EMERGENT (High risk, within 15 mins)</option>
                    <option value="URGENT">🟡 URGENT (Urgent, within 30 mins)</option>
                    <option value="SEMI_URGENT">🟢 SEMI-URGENT (Less urgent, within 60 mins)</option>
                    <option value="NON_URGENT">⚪ NON-URGENT (Non-urgent, within 120 mins)</option>
                  </Dropdown>
                  {acuitySuggestion && (
                    <div className="mt-2 flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-900">
                      <span>
                        Vitals suggest: {CATEGORY_DISPLAY[acuitySuggestion.category].emoji}{' '}
                        <strong>{CATEGORY_DISPLAY[acuitySuggestion.category].label}</strong>
                        {' — '}
                        {acuitySuggestion.reasons.join(', ')}. This is an informational aid only — your own
                        clinical judgment determines the category saved above.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Vitals */}
              <h4 className="font-medium text-gray-900 mt-6 mb-2 border-b pb-2">Vital Signs</h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Systolic BP</label>
                  <input type="number" name="systolicBP" value={formData.systolicBP} onChange={handleChange} className="input w-full mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Diastolic BP</label>
                  <input type="number" name="diastolicBP" value={formData.diastolicBP} onChange={handleChange} className="input w-full mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pulse Rate</label>
                  <input type="number" name="heartRate" value={formData.heartRate} onChange={handleChange} className="input w-full mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Resp Rate</label>
                  <input type="number" name="respiratoryRate" value={formData.respiratoryRate} onChange={handleChange} className="input w-full mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Temp (°C)</label>
                  <input type="number" step="0.1" name="temperature" value={formData.temperature} onChange={handleChange} className="input w-full mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">SpO2 (%)</label>
                  <input type="number" name="spO2" value={formData.spO2} onChange={handleChange} className="input w-full mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                  <input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleChange} className="input w-full mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pain (0-10)</label>
                  <input type="number" min="0" max="10" name="painScore" value={formData.painScore} onChange={handleChange} className="input w-full mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">AVPU (Consciousness)</label>
                  <Dropdown name="consciousnessLevel" value={formData.consciousnessLevel} onChange={handleChange} className="input w-full mt-1">
                    <option value="Alert">Alert</option>
                    <option value="Voice">Responds to Voice</option>
                    <option value="Pain">Responds to Pain</option>
                    <option value="Unresponsive">Unresponsive</option>
                  </Dropdown>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Blood Glucose</label>
                  <input type="number" step="0.1" name="glucoseLevel" value={formData.glucoseLevel} onChange={handleChange} className="input w-full mt-1" />
                </div>
              </div>

              {!hasAnyVitals && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  No vitals recorded — submitting chief complaint and category only.
                </p>
              )}

              {/* Critical cases sometimes need oxygen before/without a
                  consultation or admission existing yet — this logs it
                  directly against the patient (billing + audit trail) right
                  from triage, without leaving this screen. */}
              <button
                type="button"
                onClick={() => setShowOxygenModal(true)}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
              >
                <Wind className="w-4 h-4" />
                Record Oxygen Given
              </button>

              <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:bg-blue-300"
                >
                  {loading ? 'Saving...' : 'Complete Triage'}
                </button>
                <button
                  type="button"
                  onClick={() => { triageDraft.clear(); onClose(); }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmIsOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={confirmOptions.title}
        message={confirmOptions.message}
        confirmText={confirmOptions.confirmText}
        cancelText={confirmOptions.cancelText}
        variant={confirmOptions.variant}
        loading={confirmLoading}
      />
      <RecordConsumableUsageModal
        isOpen={showOxygenModal}
        onClose={() => setShowOxygenModal(false)}
        onSuccess={() => toast.success('Oxygen usage recorded', `${patientName}'s oxygen administration has been logged and queued for billing.`)}
        patientId={patientId}
        patientLabel={patientName}
        lockToCategory="Oxygen"
      />
    </div>
  );
};

export default TriageAssessmentModal;
