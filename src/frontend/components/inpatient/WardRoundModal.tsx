import React, { useState, useEffect } from 'react';
import InpatientService from '../../services/InpatientService';
import { Pill, Plus, X } from 'lucide-react';
import MedicationAutocomplete, { Medication } from '../common/MedicationAutocomplete';
import { DURATION_OPTIONS, mapDosageFormToRoute } from '../../utils/prescriptionHelpers';
import Dropdown from '../common/Dropdown';
import TypeaheadTextField from '../common/TypeaheadTextField';
import { useToast } from '../ToastContainer';

interface WardRoundModalProps {
  admissionId: string;
  onClose: () => void;
  onSuccess: () => void;
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

const WardRoundModal: React.FC<WardRoundModalProps> = ({ admissionId, onClose, onSuccess }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    notes: '',
    plan: '',
  });
  const [vitals, setVitals] = useState({
    temperature: '',
    systolicBP: '',
    diastolicBP: '',
    heartRate: '',
    respiratoryRate: '',
    spO2: '',
  });
  const hasVitalsEntered = Object.values(vitals).some((v) => v);
  const [activePrescriptions, setActivePrescriptions] = useState<any[]>([]);
  const [discontinuedIds, setDiscontinuedIds] = useState<string[]>([]);
  const [newMedications, setNewMedications] = useState<any[]>([]);
  
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [newMedicationForm, setNewMedicationForm] = useState({
    medicationId: undefined as string | undefined,
    medicationName: '',
    route: 'ORAL',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: ''
  });

  const handleMedicationSelect = (medication: Medication) => {
    const mappedRoute = mapDosageFormToRoute(medication.dosageForm);
    setNewMedicationForm(prev => ({
      ...prev,
      medicationName: medication.name,
      medicationId: medication.id,
      route: mappedRoute || prev.route,
      dosage: medication.strength || prev.dosage,
    }));
  };

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivePrescriptions();
  }, [admissionId]);

  const fetchActivePrescriptions = async () => {
    try {
      setInitialLoading(true);
      const data = await InpatientService.getCharts(admissionId);
      // Filter out CANCELLED or COMPLETED to get currently active ones
      const active = (data.activePrescriptions || []).filter((p: any) => p.status !== 'CANCELLED' && p.status !== 'COMPLETED');
      setActivePrescriptions(active);
    } catch (err) {
      console.error('Failed to fetch active prescriptions', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const toggleDiscontinue = (id: string) => {
    if (discontinuedIds.includes(id)) {
      setDiscontinuedIds(discontinuedIds.filter(dId => dId !== id));
    } else {
      setDiscontinuedIds([...discontinuedIds, id]);
    }
  };

  const handleAddNewMedication = () => {
    if (!newMedicationForm.medicationName || !newMedicationForm.dosage) return;
    setNewMedications([...newMedications, { ...newMedicationForm, id: Date.now().toString() }]);
    setNewMedicationForm({ medicationId: undefined, medicationName: '', route: 'ORAL', dosage: '', frequency: '', duration: '', instructions: '' });
    setShowAddMedication(false);
  };

  const removeNewMedication = (id: string) => {
    setNewMedications(newMedications.filter(m => m.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.notes) {
      setError('Clinical notes are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const medicationChanges: any[] = [];
      discontinuedIds.forEach(id => {
        medicationChanges.push({ action: 'DISCONTINUE', prescriptionId: id });
      });
      newMedications.forEach(med => {
        medicationChanges.push({
          action: 'ADD',
          medicationId: med.medicationId,
          medicationName: med.medicationName,
          route: med.route,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          instructions: med.instructions
        });
      });

      const wardRoundPromise = InpatientService.addWardRound(admissionId, {
        notes: formData.notes,
        plan: formData.plan,
        medicationChanges
      });
      const otherPromises: Promise<any>[] = [];

      if (hasVitalsEntered) {
        const sys = vitals.systolicBP ? parseInt(vitals.systolicBP) : undefined;
        const dia = vitals.diastolicBP ? parseInt(vitals.diastolicBP) : undefined;
        otherPromises.push(
          InpatientService.addVitalChart(admissionId, {
            temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
            systolicBP: sys,
            diastolicBP: dia,
            bloodPressure: sys && dia ? `${sys}/${dia}` : undefined,
            heartRate: vitals.heartRate ? parseInt(vitals.heartRate) : undefined,
            respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate) : undefined,
            spO2: vitals.spO2 ? parseInt(vitals.spO2) : undefined,
          })
        );
      }

      const [wardRound] = await Promise.all([wardRoundPromise, ...otherPromises]);

      // Surface any allergy/interaction/duplicate-therapy flags on a newly
      // added medication (REQ-CLIN-7) — informational only, the ward round
      // is already saved by this point, this doesn't block anything.
      wardRound.medicationWarnings?.forEach(w => {
        const parts: string[] = [];
        if (w.allergyWarning) parts.push(`Allergy: ${w.allergyDetails.join(', ')}`);
        if (w.interactionWarning) parts.push(`Interaction: ${w.interactionDetails.join(', ')}`);
        if (w.duplicateWarning) parts.push(`Duplicate therapy: ${w.duplicateDetails.join(', ')}`);
        toast.warning(`Warning: ${w.medicationName}`, parts.join(' — '));
      });

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save ward round');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="relative inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <span className="sr-only">Close</span>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Record Ward Round</h3>
              <div className="mt-6">
                {error && (
                  <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes *</label>
                    <TypeaheadTextField
                      className="input w-full"
                      rows={4}
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Enter examination findings, symptoms, progress..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                    <TypeaheadTextField
                      className="input w-full"
                      rows={2}
                      value={formData.plan}
                      onChange={e => setFormData({ ...formData, plan: e.target.value })}
                      placeholder="Plan for the day, investigations to order..."
                    />
                  </div>

                  {/* Quick Vitals — optional, so a round note and a vitals check
                      don't require leaving this modal for a different tab */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Quick Vitals (optional)</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Temp (°C)</label>
                        <input type="number" step="0.1" className="input w-full py-1.5 text-sm"
                          value={vitals.temperature} onChange={e => setVitals({ ...vitals, temperature: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Systolic BP</label>
                        <input type="number" className="input w-full py-1.5 text-sm"
                          value={vitals.systolicBP} onChange={e => setVitals({ ...vitals, systolicBP: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Diastolic BP</label>
                        <input type="number" className="input w-full py-1.5 text-sm"
                          value={vitals.diastolicBP} onChange={e => setVitals({ ...vitals, diastolicBP: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Pulse Rate</label>
                        <input type="number" className="input w-full py-1.5 text-sm"
                          value={vitals.heartRate} onChange={e => setVitals({ ...vitals, heartRate: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Resp Rate</label>
                        <input type="number" className="input w-full py-1.5 text-sm"
                          value={vitals.respiratoryRate} onChange={e => setVitals({ ...vitals, respiratoryRate: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">SpO2 (%)</label>
                        <input type="number" className="input w-full py-1.5 text-sm"
                          value={vitals.spO2} onChange={e => setVitals({ ...vitals, spO2: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  {/* Medication Management Section */}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-md font-medium text-gray-900 flex items-center">
                        <Pill className="w-5 h-5 mr-2 text-primary-600" />
                        Medication Changes
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowAddMedication(!showAddMedication)}
                        className="text-sm flex items-center text-primary-600 hover:text-primary-700 font-medium"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Medication
                      </button>
                    </div>

                    {initialLoading ? (
                      <p className="text-sm text-gray-500">Loading active medications...</p>
                    ) : (
                      <div className="space-y-3">
                        {activePrescriptions.length === 0 && newMedications.length === 0 && (
                          <p className="text-sm text-gray-500 italic">No active medications for this patient.</p>
                        )}
                        
                        {/* Currently Active Medications */}
                        {activePrescriptions.map(med => {
                          const isDiscontinued = discontinuedIds.includes(med.id);
                          return (
                            <div key={med.id} className={`p-3 rounded-lg border ${isDiscontinued ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} flex justify-between items-center transition-colors`}>
                              <div>
                                <p className={`font-medium ${isDiscontinued ? 'text-red-700 line-through' : 'text-gray-900'} flex items-center`}>
                                  {med.medicationName}
                                  {med.type === 'OUTPATIENT' && (
                                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 font-semibold">
                                      OUTPATIENT
                                    </span>
                                  )}
                                  {med.type === 'INPATIENT' && (
                                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 font-semibold">
                                      INPATIENT
                                    </span>
                                  )}
                                </p>
                                <p className={`text-sm ${isDiscontinued ? 'text-red-500 line-through' : 'text-gray-600'}`}>{med.dosage} - {med.frequency}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleDiscontinue(med.id)}
                                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                                  isDiscontinued 
                                    ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                                    : 'bg-white border border-gray-300 text-red-600 hover:bg-red-50'
                                }`}
                              >
                                {isDiscontinued ? 'Undo Discontinue' : 'Discontinue'}
                              </button>
                            </div>
                          );
                        })}

                        {/* Newly Added Medications (Not Yet Saved) */}
                        {newMedications.map(med => (
                          <div key={med.id} className="p-3 rounded-lg border bg-green-50 border-green-200 flex justify-between items-center">
                            <div>
                              <p className="font-medium text-green-800">{med.medicationName} <span className="text-xs bg-green-200 text-green-900 px-2 py-0.5 rounded-full ml-2">NEW</span></p>
                              <p className="text-sm text-green-700">{med.dosage} - {med.frequency}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeNewMedication(med.id)}
                              className="text-gray-400 hover:text-red-500 p-1"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Medication Form inline */}
                    {showAddMedication && (
                      <div className="mt-4 p-4 border border-primary-200 bg-primary-50 rounded-lg space-y-4">
                        <h5 className="font-medium text-primary-900 text-sm">New Medication Order</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Medication Name *</label>
                            <MedicationAutocomplete
                              value={newMedicationForm.medicationName}
                              onChange={(value) => setNewMedicationForm(prev => ({ ...prev, medicationName: value, medicationId: undefined }))}
                              onSelect={handleMedicationSelect}
                              placeholder="Search inventory or type a medication name..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Route / Form *</label>
                            <Dropdown
                              required
                              className="input w-full py-1.5 text-sm"
                              value={newMedicationForm.route}
                              onChange={e => setNewMedicationForm({ ...newMedicationForm, route: e.target.value })}
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
                            <label className="block text-xs font-medium text-gray-700 mb-1">{getRouteLabels(newMedicationForm.route).dosageLabel} *</label>
                            <input
                              type="text"
                              className="input w-full py-1.5 text-sm"
                              placeholder={getRouteLabels(newMedicationForm.route).dosagePlaceholder}
                              value={newMedicationForm.dosage}
                              onChange={e => setNewMedicationForm({...newMedicationForm, dosage: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
                            <Dropdown
                              className="input w-full py-1.5 text-sm"
                              value={newMedicationForm.frequency}
                              onChange={e => setNewMedicationForm({...newMedicationForm, frequency: e.target.value})}
                            >
                              {getRouteLabels(newMedicationForm.route).freqOptions.map(opt => (
                                <option key={opt} value={opt === 'Select frequency' ? '' : opt}>{opt}</option>
                              ))}
                              {newMedicationForm.frequency && !getRouteLabels(newMedicationForm.route).freqOptions.includes(newMedicationForm.frequency) && newMedicationForm.frequency !== 'Select frequency' && (
                                <option value={newMedicationForm.frequency}>{newMedicationForm.frequency}</option>
                              )}
                            </Dropdown>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
                            <Dropdown
                              className="input w-full py-1.5 text-sm"
                              value={newMedicationForm.duration}
                              onChange={e => setNewMedicationForm({...newMedicationForm, duration: e.target.value})}
                            >
                              {DURATION_OPTIONS.map(opt => (
                                <option key={opt} value={opt === 'Select duration' ? '' : opt}>{opt}</option>
                              ))}
                              <option value="CUSTOM">Custom...</option>
                              {newMedicationForm.duration && !DURATION_OPTIONS.includes(newMedicationForm.duration) && (
                                <option value={newMedicationForm.duration}>{newMedicationForm.duration}</option>
                              )}
                            </Dropdown>
                            {(newMedicationForm.duration === 'CUSTOM' || (!!newMedicationForm.duration && !DURATION_OPTIONS.includes(newMedicationForm.duration) && newMedicationForm.duration !== 'CUSTOM')) && (
                              <input
                                type="text"
                                className="input w-full py-1.5 text-sm mt-2"
                                placeholder={getRouteLabels(newMedicationForm.route).durationPlaceholder}
                                value={newMedicationForm.duration === 'CUSTOM' ? '' : newMedicationForm.duration}
                                onChange={e => setNewMedicationForm({...newMedicationForm, duration: e.target.value})}
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end space-x-3">
                          <button
                            type="button"
                            onClick={() => setShowAddMedication(false)}
                            className="text-sm font-medium text-gray-600 hover:text-gray-900"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddNewMedication}
                            disabled={!newMedicationForm.medicationName || !newMedicationForm.dosage}
                            className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-1.5 px-4 rounded-md disabled:opacity-50"
                          >
                            Confirm Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      disabled={loading || !formData.notes}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save Ward Round'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WardRoundModal;
