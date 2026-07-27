import React, { useState, useEffect } from 'react';
import { Ward, Patient } from '../../types/inpatient';
import InpatientService from '../../services/InpatientService';
import Dropdown from '../common/Dropdown';

interface AdmissionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  wards: Ward[];
}

const AdmissionModal: React.FC<AdmissionModalProps> = ({ onClose, onSuccess, wards }) => {
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<Array<{ id: string; name: string; patientNumber: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [formData, setFormData] = useState({
    patientId: '',
    wardId: '',
    bedId: '',
    reason: '',
    notes: '',
    isolationRequired: false,
    infectionRisk: '',
    primaryDiagnosisId: '',
    diagnosisSearch: '',
    admissionType: 'MEDICAL'
  });
  const [diagnoses, setDiagnoses] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [isSearchingDiagnosis, setIsSearchingDiagnosis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search patients
  const searchPatients = async (query: string) => {
    if (query.length < 2) {
      setPatients([]);
      return;
    }

    setIsSearching(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const response = await fetch(`${apiBaseUrl}/api/patients/search?query=${encodeURIComponent(query)}&lite=true`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setPatients(
          result.data.map((p: any) => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            patientNumber: p.patientId,
          }))
        );
      }
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setIsSearching(false);
    }
  };

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
      searchPatients(patientSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.diagnosisSearch) searchDiagnoses(formData.diagnosisSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.diagnosisSearch]);

  const selectedWard = wards.find(w => w.id === formData.wardId);
  const availableBeds = selectedWard?.beds?.filter(b => {
    if (b.status !== 'AVAILABLE') return false;
    // If isolation is required, only show isolation beds (if any), or just don't filter strict for now
    // For now we allow any bed, but UI shows isolationReady status
    return true;
  }) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId || !formData.bedId || !formData.reason) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await InpatientService.admitPatient({
        patientId: formData.patientId,
        bedId: formData.bedId,
        reason: formData.reason,
        notes: formData.notes,
        isolationRequired: formData.isolationRequired,
        infectionRisk: formData.infectionRisk,
        primaryDiagnosisId: formData.primaryDiagnosisId,
        admissionType: formData.admissionType
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to admit patient');
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
              <h3 className="text-lg font-medium leading-6 text-gray-900">Admit Patient to Ward</h3>
              <div className="mt-6">
                {error && (
                  <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Patient *</label>
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        // Clear selection if they start typing again
                        if (formData.patientId) {
                          setFormData({ ...formData, patientId: '' });
                        }
                      }}
                      placeholder="Search by name or patient number..."
                      className="input w-full"
                      disabled={loading}
                      required={!formData.patientId}
                    />
                    {isSearching && <p className="text-sm text-gray-500 mt-1">Searching...</p>}
                    {patients.length > 0 && !formData.patientId && (
                      <div className="mt-2 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                        {patients.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, patientId: patient.id });
                              setPatientSearch(`${patient.name} (${patient.patientNumber})`);
                              setPatients([]);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{patient.name}</div>
                            <div className="text-sm text-gray-500">{patient.patientNumber}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Primary Diagnosis */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Diagnosis (ICD-11)</label>
                    <input
                      type="text"
                      value={formData.diagnosisSearch}
                      onChange={(e) => {
                        setFormData({ ...formData, diagnosisSearch: e.target.value, primaryDiagnosisId: '' });
                      }}
                      placeholder="Search diagnosis..."
                      className="input w-full"
                      disabled={loading}
                    />
                    {isSearchingDiagnosis && <p className="text-sm text-gray-500 mt-1">Searching...</p>}
                    {diagnoses.length > 0 && !formData.primaryDiagnosisId && (
                      <div className="mt-2 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                        {diagnoses.map((diag) => (
                          <button
                            key={diag.id}
                            type="button"
                            onClick={() => {
                              setFormData({ 
                                ...formData, 
                                primaryDiagnosisId: diag.id,
                                diagnosisSearch: `${diag.code} - ${diag.name}` 
                              });
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Ward *</label>
                    <Dropdown
                      className="input w-full"
                      value={formData.wardId}
                      onChange={e => setFormData({ ...formData, wardId: e.target.value, bedId: '' })}
                      required
                    >
                      <option value="">-- Select Ward --</option>
                      {wards.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.type})
                        </option>
                      ))}
                    </Dropdown>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Bed *</label>
                    <Dropdown
                      className="input w-full"
                      value={formData.bedId}
                      onChange={e => setFormData({ ...formData, bedId: e.target.value })}
                      required
                      disabled={!formData.wardId}
                    >
                      <option value="">-- Select Available Bed --</option>
                      {availableBeds.map(b => (
                        <option key={b.id} value={b.id}>
                          Bed {b.bedNumber} {b.type ? `(${b.type})` : ''} {b.isolationReady ? ' [Isolation Ready]' : ''}
                        </option>
                      ))}
                    </Dropdown>
                    {formData.wardId && availableBeds.length === 0 && (
                      <p className="mt-1 text-xs text-red-500">No available beds in this ward.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Admission *</label>
                    <input
                      type="text"
                      className="input w-full"
                      value={formData.reason}
                      onChange={e => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="e.g. Malaria Observation"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admission Type *</label>
                    <Dropdown
                      className="input w-full"
                      value={formData.admissionType}
                      onChange={e => setFormData({ ...formData, admissionType: e.target.value })}
                      required
                    >
                      <option value="MEDICAL">Medical</option>
                      <option value="SURGERY">Surgery</option>
                      <option value="CHILD_BIRTH">Child Birth</option>
                    </Dropdown>
                    <p className="mt-1 text-xs text-gray-500">
                      Controls which tabs show for this admission — Surgery adds the Operation Note tab, Child Birth adds Operation Note and Partograph.
                    </p>
                  </div>

                  {/* Infection Control */}
                  <div className="bg-orange-50 p-4 rounded-md border border-orange-100">
                    <h4 className="text-sm font-medium text-orange-800 mb-3">Infection Control (WHO Standard)</h4>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                          checked={formData.isolationRequired}
                          onChange={e => setFormData({ ...formData, isolationRequired: e.target.checked })}
                        />
                        <span className="ml-2 text-sm text-gray-900">Requires Isolation</span>
                      </label>
                      {formData.isolationRequired && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Infection Risk Details</label>
                          <input
                            type="text"
                            className="input w-full"
                            value={formData.infectionRisk}
                            onChange={e => setFormData({ ...formData, infectionRisk: e.target.value })}
                            placeholder="e.g., Suspected Tuberculosis"
                            required={formData.isolationRequired}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admission Notes</label>
                    <textarea
                      className="input w-full"
                      rows={3}
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Optional notes..."
                    />
                  </div>

                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      disabled={loading || !formData.patientId || !formData.bedId || !formData.reason}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                    >
                      {loading ? 'Admitting...' : 'Admit Patient'}
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

export default AdmissionModal;
