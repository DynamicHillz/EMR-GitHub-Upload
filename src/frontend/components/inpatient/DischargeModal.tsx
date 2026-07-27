import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import InpatientService from '../../services/InpatientService';
import MedicationAutocomplete, { Medication } from '../common/MedicationAutocomplete';
import { useToast } from '../ToastContainer';
import { Admission } from '../../types/inpatient';
import { formatDate } from '../../utils/formatters';
import {
  DURATION_OPTIONS,
  mapDosageFormToRoute,
  getQuantityLabel,
  isCountableSolidForm,
  getUnitsPerDoseLabel,
  parseFrequencyToTimesPerDay,
  parseDurationToDays,
} from '../../utils/prescriptionHelpers';
import Dropdown from '../common/Dropdown';
import TypeaheadTextField from '../common/TypeaheadTextField';

interface DischargeModalProps {
  admissionId: string;
  patientName: string;
  admission?: Admission;
  onClose: () => void;
  onSuccess: () => void;
}

interface PrescriptionItem {
  medicationId?: string;
  medicationName: string;
  route: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
  /** Inventory dosage form (Tablet, Capsule, Syrup, etc.) — drives the
   * quantity field's label (e.g. "No of Tablets"); cleared when the
   * medication name is edited by hand instead of picked from the
   * autocomplete, since the form is then no longer known. */
  dosageForm?: string;
  /** Per-unit strength (e.g. "500mg"), known from inventory once selected —
   * shown as a helper next to "No of Tablets/Capsules". */
  strength?: string;
  /** For Tablet/Capsule only: how many units the patient takes per dose
   * (e.g. 2, for "take 2 tablets 3 times a day") — distinct from
   * `quantity`, which is the total dispensed to the patient. */
  unitsPerDose?: number;
  /** Once true, the auto-total below stops overwriting `quantity` for this
   * item — set when the doctor edits Quantity by hand. */
  quantityManuallyEdited?: boolean;
}

const getRouteLabels = (route: string) => {
  switch (route) {
    case 'TOPICAL':
      return { dosageLabel: 'Application Amount', dosagePlaceholder: 'e.g., Apply thin layer', freqOptions: ['Select frequency', 'Once daily', 'Twice daily', 'Three times daily', 'As needed'], durationPlaceholder: 'e.g., 7 days' };
    case 'OPHTHALMIC':
    case 'OTIC':
      return { dosageLabel: 'Drops per Dose', dosagePlaceholder: 'e.g., 2 drops', freqOptions: ['Select frequency', 'Once daily', 'Twice daily', 'Three times daily', 'Every 6 hours', 'Every 8 hours', 'As needed'], durationPlaceholder: 'e.g., 5 days' };
    case 'INTRAVENOUS':
    case 'INTRAMUSCULAR':
    case 'SUBCUTANEOUS':
      return { dosageLabel: 'Dose', dosagePlaceholder: 'e.g., 1g, 500mg', freqOptions: ['Select frequency', 'STAT (Immediately)', 'Once daily', 'Twice daily', 'Every 8 hours', 'Every 12 hours'], durationPlaceholder: 'e.g., STAT, 3 days' };
    case 'INHALATION':
      return { dosageLabel: 'Puffs/Dose', dosagePlaceholder: 'e.g., 2 puffs', freqOptions: ['Select frequency', 'Once daily', 'Twice daily', 'Every 4 hours', 'As needed'], durationPlaceholder: 'e.g., 1 month' };
    case 'RECTAL':
    case 'VAGINAL':
      return { dosageLabel: 'Dose', dosagePlaceholder: 'e.g., 1 suppository', freqOptions: ['Select frequency', 'Once daily', 'Twice daily', 'At bedtime', 'As needed'], durationPlaceholder: 'e.g., 5 days' };
    default:
      return { dosageLabel: 'Dosage', dosagePlaceholder: 'e.g., 500mg, 10ml', freqOptions: ['Select frequency', 'Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours', 'As needed (PRN)'], durationPlaceholder: 'e.g., 7 days, 2 weeks' };
  }
};

const DischargeModal: React.FC<DischargeModalProps> = ({
  admissionId,
  patientName,
  admission,
  onClose,
  onSuccess
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);

  // WHO Discharge Summary extensions
  const [finalNotes, setFinalNotes] = useState('');
  const [followUpPlan, setFollowUpPlan] = useState('');
  const [primaryDiagnosisId, setPrimaryDiagnosisId] = useState('');
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const [diagnoses, setDiagnoses] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [isSearchingDiagnosis, setIsSearchingDiagnosis] = useState(false);
  const [activeMedications, setActiveMedications] = useState<any[]>([]);

  // Same active-prescriptions fetch WardRoundModal already makes, so TTO
  // entry can offer "convert this" instead of a blank form per drug.
  useEffect(() => {
    InpatientService.getCharts(admissionId)
      .then((data) => {
        const active = (data.activePrescriptions || []).filter(
          (p: any) => p.status !== 'CANCELLED' && p.status !== 'COMPLETED'
        );
        setActiveMedications(active);
      })
      .catch((err) => console.error('Failed to fetch active medications', err));
  }, [admissionId]);

  // Search Diagnoses
  const searchDiagnoses = async (query: string) => {
    if (query.length < 2) {
      setDiagnoses([]);
      return;
    }

    setIsSearchingDiagnosis(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const response = await fetch(`${apiBaseUrl}/api/clinical/diagnoses?query=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setDiagnoses(result.data || []);
      }
    } catch (error) {
      console.error('Error searching diagnoses:', error);
    } finally {
      setIsSearchingDiagnosis(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (diagnosisSearch) searchDiagnoses(diagnosisSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [diagnosisSearch]);

  // Pre-populate a discharge draft from data already on the admission
  // record — the admission diagnosis, the latest ward round's notes/plan.
  // Everything below stays fully editable; this only saves re-typing.
  useEffect(() => {
    if (!admission) return;

    const admissionDiagnosis = admission.diagnoses?.find(d => d.isAdmission);
    if (admissionDiagnosis?.diagnosis) {
      setPrimaryDiagnosisId(admissionDiagnosis.diagnosisId);
      setDiagnosisSearch(`${admissionDiagnosis.diagnosis.code} - ${admissionDiagnosis.diagnosis.name}`);
    }

    const latestRound = admission.wardRounds?.[0];
    if (latestRound?.notes) {
      setFinalNotes(latestRound.notes);
    }
    if (latestRound?.plan) {
      setFollowUpPlan(latestRound.plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestVitals = admission?.vitalCharts?.[0];

  const handleAddPrescription = () => {
    setPrescriptions([...prescriptions, {
      medicationId: undefined,
      medicationName: '',
      route: 'ORAL',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: 1,
      instructions: '',
      dosageForm: undefined,
      strength: undefined,
      unitsPerDose: undefined,
      quantityManuallyEdited: false,
    }]);
  };

  const handleRemovePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const handleConvertToTTO = (med: any) => {
    setPrescriptions([...prescriptions, {
      medicationId: med.medicationId || undefined,
      medicationName: med.medicationName,
      route: med.route || 'ORAL',
      dosage: med.dosage || '',
      frequency: med.frequency || '',
      duration: med.duration || '',
      quantity: med.quantity || 1,
      instructions: med.instructions || '',
      dosageForm: med.dosageForm || undefined,
      strength: med.strength || undefined,
      unitsPerDose: undefined,
      quantityManuallyEdited: true, // came from an existing chart entry — don't silently overwrite its quantity
    }]);
    setActiveMedications(activeMedications.filter((m) => m.id !== med.id));
  };

  const handlePrescriptionChange = (index: number, field: keyof PrescriptionItem, value: any) => {
    const updated = [...prescriptions];
    updated[index] = {
      ...updated[index],
      [field]: value,
      ...(field === 'quantity' ? { quantityManuallyEdited: true } : {}),
    };
    setPrescriptions(updated);
  };

  const handleUnitsPerDoseChange = (index: number, value: number) => {
    const updated = [...prescriptions];
    updated[index] = { ...updated[index], unitsPerDose: value };
    setPrescriptions(updated);
  };

  const handleMedicationSelect = (index: number, medication: Medication) => {
    const mappedRoute = mapDosageFormToRoute(medication.dosageForm);
    const updated = [...prescriptions];
    updated[index] = {
      ...updated[index],
      medicationName: medication.name,
      medicationId: medication.id,
      route: mappedRoute || updated[index].route,
      dosage: isCountableSolidForm(medication.dosageForm) ? updated[index].dosage : (medication.strength || updated[index].dosage),
      dosageForm: medication.dosageForm,
      strength: medication.strength,
      unitsPerDose: undefined,
      quantityManuallyEdited: false,
    };
    setPrescriptions(updated);
  };

  // Auto-total each Tablet/Capsule item's Quantity = (units per dose) ×
  // (times/day) × (days) — e.g. "2 tablets, three times daily, 7 days" ->
  // 42. Skips items whose Quantity was manually edited, and bails out
  // without calling setPrescriptions when nothing actually changed so this
  // doesn't loop (a plain .map() always returns a new array reference).
  useEffect(() => {
    let changed = false;
    const next = prescriptions.map((p) => {
      if (!isCountableSolidForm(p.dosageForm) || p.quantityManuallyEdited) return p;
      const timesPerDay = parseFrequencyToTimesPerDay(p.frequency);
      const days = parseDurationToDays(p.duration);
      if (p.unitsPerDose && timesPerDay && days) {
        const calculated = p.unitsPerDose * timesPerDay * days;
        if (p.quantity !== calculated) {
          changed = true;
          return { ...p, quantity: calculated };
        }
      }
      return p;
    });
    if (changed) setPrescriptions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prescriptions]);

  // For Tablet/Capsule, the backend still just gets a descriptive `dosage`
  // string — this composes it from the per-dose count + known strength
  // (e.g. "2 tablets (500mg each)") rather than adding a new API field.
  const composePrescriptionForSubmit = (p: PrescriptionItem): PrescriptionItem => {
    if (isCountableSolidForm(p.dosageForm) && p.unitsPerDose) {
      const { unitSingular, unitPlural } = getUnitsPerDoseLabel(p.dosageForm);
      const unitWord = p.unitsPerDose === 1 ? unitSingular : unitPlural;
      const dosage = p.strength ? `${p.unitsPerDose} ${unitWord} (${p.strength} each)` : `${p.unitsPerDose} ${unitWord}`;
      return { ...p, dosage };
    }
    return p;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const finalPrescriptions = prescriptions.filter(p => p.medicationName).map(composePrescriptionForSubmit);
      await InpatientService.dischargePatient(admissionId, {
        notes,
        finalNotes: finalNotes || notes,
        followUpPlan,
        finalDiagnosisId: primaryDiagnosisId,
        ttoMedications: finalPrescriptions,
        prescriptions: finalPrescriptions
      });
      toast.success('Patient discharged successfully');
      window.open(`/inpatient/admissions/${admissionId}/discharge-summary`, '_blank');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to discharge patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Discharge Patient: {patientName}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Latest Vitals — reference only, not part of the discharge record */}
            {latestVitals && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Latest Vitals ({formatDate(latestVitals.recordedAt)})
                </h3>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                  {latestVitals.temperature != null && <span>Temp: {latestVitals.temperature}°C</span>}
                  {latestVitals.systolicBP != null && latestVitals.diastolicBP != null && (
                    <span>BP: {latestVitals.systolicBP}/{latestVitals.diastolicBP} mmHg</span>
                  )}
                  {latestVitals.heartRate != null && <span>PR: {latestVitals.heartRate} bpm</span>}
                  {latestVitals.spO2 != null && <span>SpO2: {latestVitals.spO2}%</span>}
                  {latestVitals.respiratoryRate != null && <span>RR: {latestVitals.respiratoryRate}/min</span>}
                </div>
              </div>
            )}

            {/* Clinical Summary Section */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="text-lg font-medium text-blue-900 mb-4">Discharge Summary (WHO Standard)</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Final Primary Diagnosis (ICD-11)</label>
                  <input
                    type="text"
                    value={diagnosisSearch}
                    onChange={(e) => {
                      setDiagnosisSearch(e.target.value);
                      setPrimaryDiagnosisId('');
                    }}
                    placeholder="Search diagnosis..."
                    className="input w-full bg-white"
                  />
                  {isSearchingDiagnosis && <p className="text-sm text-gray-500 mt-1">Searching...</p>}
                  {diagnoses.length > 0 && !primaryDiagnosisId && (
                    <div className="mt-2 border border-gray-200 rounded-md max-h-40 overflow-y-auto bg-white shadow-sm">
                      {diagnoses.map((diag) => (
                        <button
                          key={diag.id}
                          type="button"
                          onClick={() => {
                            setPrimaryDiagnosisId(diag.id);
                            setDiagnosisSearch(`${diag.code} - ${diag.name}`);
                            setDiagnoses([]);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{diag.name}</div>
                          <div className="text-sm text-gray-500">{diag.code}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Final Clinical Notes *</label>
                  <TypeaheadTextField
                    className="input w-full bg-white"
                    rows={4}
                    value={finalNotes}
                    onChange={e => setFinalNotes(e.target.value)}
                    placeholder="Summarize the patient's hospital course, procedures performed, and condition on discharge..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Plan & Instructions</label>
                  <TypeaheadTextField
                    className="input w-full bg-white"
                    rows={2}
                    value={followUpPlan}
                    onChange={e => setFollowUpPlan(e.target.value)}
                    placeholder="When to return, what symptoms to watch for, dietary advice..."
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">To-Take-Out (TTO) Medications</h3>
              <button
                type="button"
                onClick={handleAddPrescription}
                className="flex items-center px-3 py-1.5 text-sm bg-primary-50 text-primary-600 rounded-md hover:bg-primary-100"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Medication
              </button>
            </div>

            {activeMedications.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs font-medium text-blue-900 mb-2">
                  Currently active on the ward — convert to a take-home order instead of retyping:
                </p>
                <div className="space-y-1">
                  {activeMedications.map((med) => (
                    <div key={med.id} className="flex justify-between items-center bg-white rounded px-3 py-2 border border-blue-100">
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">{med.medicationName}</span>
                        <span className="text-gray-500 ml-2">{med.dosage} - {med.frequency}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleConvertToTTO(med)}
                        className="text-xs font-medium text-primary-600 hover:text-primary-800 px-2 py-1"
                      >
                        + Add as TTO
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {prescriptions.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500 text-sm">No take-home medications prescribed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((pres, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative">
                    <button
                      type="button"
                      onClick={() => handleRemovePrescription(index)}
                      className="absolute top-4 right-4 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    
                    <div className="grid grid-cols-2 gap-4 mr-8">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Medication Name *</label>
                        <MedicationAutocomplete
                          value={pres.medicationName}
                          onChange={(val) => {
                            const updated = [...prescriptions];
                            updated[index] = { ...updated[index], medicationName: val, medicationId: undefined, dosageForm: undefined, strength: undefined, unitsPerDose: undefined };
                            setPrescriptions(updated);
                          }}
                          onSelect={(med) => handleMedicationSelect(index, med)}
                          placeholder="Search inventory or type a medication name..."
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Route / Form *</label>
                        <Dropdown
                          required
                          className="input w-full text-sm py-1.5"
                          value={pres.route}
                          onChange={e => handlePrescriptionChange(index, 'route', e.target.value)}
                        >
                          <option value="ORAL">Oral (Tablet, Syrup)</option>
                          <option value="INTRAVENOUS">Intravenous (IV)</option>
                          <option value="INTRAMUSCULAR">Intramuscular (IM)</option>
                          <option value="SUBCUTANEOUS">Subcutaneous (SC)</option>
                          <option value="TOPICAL">Topical (Ointment, Cream)</option>
                          <option value="OPHTHALMIC">Ophthalmic (Eye Drops)</option>
                          <option value="OTIC">Otic (Ear Drops)</option>
                          <option value="INHALATION">Inhalation</option>
                          <option value="RECTAL">Rectal (Suppository)</option>
                          <option value="SUBLINGUAL">Sublingual</option>
                          <option value="NASAL">Nasal</option>
                          <option value="VAGINAL">Vaginal</option>
                          <option value="OTHER">Other</option>
                        </Dropdown>
                      </div>

                      <div>
                        {isCountableSolidForm(pres.dosageForm) ? (
                          <>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {getUnitsPerDoseLabel(pres.dosageForm).label} (per dose) *
                            </label>
                            <input
                              type="number"
                              required
                              min="1"
                              className="input w-full text-sm py-1.5"
                              value={pres.unitsPerDose || ''}
                              onChange={e => handleUnitsPerDoseChange(index, parseInt(e.target.value) || 0)}
                              placeholder="e.g., 2"
                            />
                            {pres.strength && (
                              <p className="text-xs text-gray-500 mt-1">
                                {pres.strength} per {getUnitsPerDoseLabel(pres.dosageForm).unitSingular}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <label className="block text-xs font-medium text-gray-700 mb-1">{getRouteLabels(pres.route).dosageLabel} *</label>
                            <input
                              type="text"
                              required
                              className="input w-full text-sm py-1.5"
                              value={pres.dosage}
                              onChange={e => handlePrescriptionChange(index, 'dosage', e.target.value)}
                              placeholder={getRouteLabels(pres.route).dosagePlaceholder}
                            />
                          </>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Frequency *</label>
                        <Dropdown
                          required
                          className="input w-full text-sm py-1.5"
                          value={pres.frequency}
                          onChange={e => handlePrescriptionChange(index, 'frequency', e.target.value)}
                        >
                          {getRouteLabels(pres.route).freqOptions.map(opt => (
                            <option key={opt} value={opt === 'Select frequency' ? '' : opt}>{opt}</option>
                          ))}
                          {pres.frequency && !getRouteLabels(pres.route).freqOptions.includes(pres.frequency) && (
                            <option value={pres.frequency}>{pres.frequency}</option>
                          )}
                        </Dropdown>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Duration *</label>
                        <Dropdown
                          className="input w-full text-sm py-1.5"
                          value={pres.duration}
                          onChange={e => handlePrescriptionChange(index, 'duration', e.target.value)}
                        >
                          {DURATION_OPTIONS.map(opt => (
                            <option key={opt} value={opt === 'Select duration' ? '' : opt}>{opt}</option>
                          ))}
                          <option value="CUSTOM">Custom...</option>
                          {pres.duration && !DURATION_OPTIONS.includes(pres.duration) && pres.duration !== 'CUSTOM' && (
                            <option value={pres.duration}>{pres.duration}</option>
                          )}
                        </Dropdown>
                        {(pres.duration === 'CUSTOM' || (!!pres.duration && !DURATION_OPTIONS.includes(pres.duration) && pres.duration !== 'CUSTOM')) && (
                          <input
                            type="text"
                            required
                            className="input w-full text-sm py-1.5 mt-2"
                            placeholder={getRouteLabels(pres.route).durationPlaceholder}
                            value={pres.duration === 'CUSTOM' ? '' : pres.duration}
                            onChange={e => handlePrescriptionChange(index, 'duration', e.target.value)}
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {getQuantityLabel(pres.route, pres.dosageForm).qtyLabel}
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="input w-full text-sm py-1.5"
                          value={pres.quantity}
                          onChange={e => handlePrescriptionChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          placeholder={getQuantityLabel(pres.route, pres.dosageForm).qtyPlaceholder}
                        />
                        {isCountableSolidForm(pres.dosageForm) && !pres.quantityManuallyEdited && pres.quantity > 0 && (
                          <p className="text-xs text-gray-500 mt-1">Auto-calculated — you can still edit it.</p>
                        )}
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Instructions (Optional)</label>
                        <input
                          type="text"
                          className="input w-full text-sm py-1.5"
                          value={pres.instructions}
                          onChange={e => handlePrescriptionChange(index, 'instructions', e.target.value)}
                          placeholder="e.g. Take after meals"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center"
            disabled={loading}
          >
            {loading ? 'Discharging...' : 'Confirm Discharge'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DischargeModal;
