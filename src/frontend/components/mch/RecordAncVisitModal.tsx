import React, { useState } from 'react';
import { ancService } from '../../services/anc.service';
import { X, Activity, Droplet, Heart, AlertCircle, Syringe, ClipboardCheck, Pill, Trash2 } from 'lucide-react';
import MedicationAutocomplete, { Medication } from '../common/MedicationAutocomplete';
import { DURATION_OPTIONS, mapDosageFormToRoute } from '../../utils/prescriptionHelpers';
import Dropdown from '../common/Dropdown';

interface RecordAncVisitModalProps {
  patientId: string;
  pregnancyId: string;
  onClose: () => void;
  onSuccess: (newVisit: any) => void;
}

interface StagedMedication {
  medicationId?: string;
  medicationName: string;
  route: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const EMPTY_MEDICATION: StagedMedication = {
  medicationName: '', route: 'ORAL', dosage: '', frequency: '', duration: '', instructions: '',
};

// Live, non-blocking danger-sign check — standard pre-eclampsia/obstetric
// thresholds, informational only. Does not stop the visit from being saved.
const getAncDangerSigns = (formData: { systolicBP: string; diastolicBP: string; urineProtein: string; fetalHeartRate: string }): string[] => {
  const signs: string[] = [];
  const systolic = parseInt(formData.systolicBP);
  const diastolic = parseInt(formData.diastolicBP);
  const fhr = parseInt(formData.fetalHeartRate);

  if (!isNaN(systolic) && systolic >= 140) signs.push(`Elevated systolic BP (${systolic} mmHg)`);
  if (!isNaN(diastolic) && diastolic >= 90) signs.push(`Elevated diastolic BP (${diastolic} mmHg)`);
  if (formData.urineProtein === '2+' || formData.urineProtein === '3+') signs.push(`Significant proteinuria (${formData.urineProtein})`);
  if (!isNaN(fhr) && (fhr < 110 || fhr > 160)) signs.push(`Fetal heart rate outside normal range (${fhr} bpm)`);

  return signs;
};

const RecordAncVisitModal: React.FC<RecordAncVisitModalProps> = ({ patientId, pregnancyId, onClose, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('vitals');
  const [stagedMedications, setStagedMedications] = useState<StagedMedication[]>([]);
  const [medicationDraft, setMedicationDraft] = useState<StagedMedication>(EMPTY_MEDICATION);

  const [formData, setFormData] = useState({
    gestationalAgeWeeks: '', weight: '', systolicBP: '', diastolicBP: '',
    fundalHeight: '', fetalHeartRate: '', presentation: '', urineProtein: '',
    ironFolicAcidProvided: false, calciumProvided: false, itnProvided: false, iptpDose: '',
    syphilisTestResult: '', hivTestResult: '', hepBTestResult: '', malariaRdtResult: '',
    ultrasoundDone: false, counselingDone: false, notes: '', others: '',
    ttDosesToDate: '', ttDoseGivenToday: false,
    dewormingProvided: false, counseledOnDangerSigns: false,
    birthPreparednessPlanDiscussed: false, intimatePartnerViolenceScreening: false
  });

  const dangerSigns = getAncDangerSigns(formData);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMedicationDraftChange = (field: keyof StagedMedication, value: string) => {
    setMedicationDraft(prev => ({ ...prev, [field]: value }));
  };

  const handleMedicationSelect = (medication: Medication) => {
    const mappedRoute = mapDosageFormToRoute(medication.dosageForm);
    setMedicationDraft(prev => ({
      ...prev,
      medicationName: medication.name,
      medicationId: medication.id,
      route: mappedRoute || prev.route,
      dosage: medication.strength || prev.dosage,
    }));
  };

  const handleAddMedication = () => {
    if (!medicationDraft.medicationName || !medicationDraft.dosage || !medicationDraft.frequency) {
      alert('Medication name, dosage, and frequency are required');
      return;
    }
    setStagedMedications(prev => [...prev, medicationDraft]);
    setMedicationDraft(EMPTY_MEDICATION);
  };

  const handleRemoveMedication = (index: number) => {
    setStagedMedications(prev => prev.filter((_, i) => i !== index));
  };

  const createPrescriptionsForVisit = async (ancVisitId: string) => {
    if (stagedMedications.length === 0) return;
    const token = localStorage.getItem('token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
    for (const med of stagedMedications) {
      try {
        await fetch(`${apiBaseUrl}/api/prescriptions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            patientId,
            ancVisitId,
            type: 'ANC',
            medicationId: med.medicationId,
            medicationName: med.medicationName,
            route: med.route,
            dosage: med.dosage,
            frequency: med.frequency,
            duration: med.duration,
            instructions: med.instructions,
          }),
        });
      } catch (error) {
        console.error('Failed to create prescription for ANC visit:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        gestationalAgeWeeks: formData.gestationalAgeWeeks ? parseInt(formData.gestationalAgeWeeks) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        systolicBP: formData.systolicBP ? parseInt(formData.systolicBP) : undefined,
        diastolicBP: formData.diastolicBP ? parseInt(formData.diastolicBP) : undefined,
        fundalHeight: formData.fundalHeight ? parseFloat(formData.fundalHeight) : undefined,
        fetalHeartRate: formData.fetalHeartRate ? parseInt(formData.fetalHeartRate) : undefined,
        iptpDose: formData.iptpDose ? parseInt(formData.iptpDose) : undefined,
        ttDosesToDate: formData.ttDosesToDate ? parseInt(formData.ttDosesToDate) : undefined,
      };

      const newVisit = await ancService.createVisit(pregnancyId, payload);
      await createPrescriptionsForVisit(newVisit.id);
      onSuccess(newVisit);
    } catch (error) {
      console.error(error);
      alert('Failed to record visit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Record ANC Visit (WHO Standards)</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-gray-50 p-4 border-r overflow-y-auto">
            <nav className="space-y-1">
              <button onClick={() => setActiveTab('vitals')} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'vitals' ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                <Activity className="mr-3 h-5 w-5" /> Maternal/Fetal Assessment
              </button>
              <button onClick={() => setActiveTab('screening')} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'screening' ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                <Droplet className="mr-3 h-5 w-5" /> Infectious Disease Screening
              </button>
              <button onClick={() => setActiveTab('prevention')} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'prevention' ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                <Syringe className="mr-3 h-5 w-5" /> Prevention & Nutrition
              </button>
              <button onClick={() => setActiveTab('counseling')} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'counseling' ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                <ClipboardCheck className="mr-3 h-5 w-5" /> Counseling & Scans
              </button>
              <button onClick={() => setActiveTab('medications')} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'medications' ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                <Pill className="mr-3 h-5 w-5" /> Prescribe Medication
                {stagedMedications.length > 0 && (
                  <span className="ml-auto bg-primary-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{stagedMedications.length}</span>
                )}
              </button>
            </nav>
          </div>

          {/* Form Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <form id="anc-visit-form" onSubmit={handleSubmit}>
              
              {/* VITALS */}
              <div className={activeTab === 'vitals' ? 'block' : 'hidden'}>
                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Maternal & Fetal Assessment</h3>
                {dangerSigns.length > 0 && (
                  <div className="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-900 text-sm">Danger Sign(s) Detected</p>
                        <ul className="text-red-800 text-sm mt-1 list-disc list-inside">
                          {dangerSigns.map((sign) => <li key={sign}>{sign}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Gestational Age (Weeks)</label>
                    <input type="number" name="gestationalAgeWeeks" value={formData.gestationalAgeWeeks} onChange={handleChange} className="input mt-1 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                    <input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleChange} className="input mt-1 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Systolic BP</label>
                    <input type="number" name="systolicBP" value={formData.systolicBP} onChange={handleChange} className="input mt-1 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Diastolic BP</label>
                    <input type="number" name="diastolicBP" value={formData.diastolicBP} onChange={handleChange} className="input mt-1 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fundal Height (cm)</label>
                    <input type="number" step="0.1" name="fundalHeight" value={formData.fundalHeight} onChange={handleChange} className="input mt-1 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fetal Heart Rate (bpm)</label>
                    <input type="number" name="fetalHeartRate" value={formData.fetalHeartRate} onChange={handleChange} className="input mt-1 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fetal Presentation</label>
                    <Dropdown name="presentation" value={formData.presentation} onChange={handleChange} className="input mt-1 w-full">
                      <option value="">Select...</option>
                      <option value="CEPHALIC">Cephalic</option>
                      <option value="BREECH">Breech</option>
                      <option value="TRANSVERSE">Transverse</option>
                      <option value="UNKNOWN">Unknown</option>
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Urine Protein</label>
                    <Dropdown name="urineProtein" value={formData.urineProtein} onChange={handleChange} className="input mt-1 w-full">
                      <option value="">Select...</option>
                      <option value="NEGATIVE">Negative</option>
                      <option value="TRACE">Trace</option>
                      <option value="1+">1+</option>
                      <option value="2+">2+</option>
                      <option value="3+">3+</option>
                    </Dropdown>
                  </div>
                </div>
              </div>

              {/* SCREENING */}
              <div className={activeTab === 'screening' ? 'block' : 'hidden'}>
                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Infectious Disease Screening</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">HIV Status</label>
                    <Dropdown name="hivTestResult" value={formData.hivTestResult} onChange={handleChange} className="input mt-1 w-full">
                      <option value="">Not Tested Today</option>
                      <option value="POSITIVE">Positive</option>
                      <option value="NEGATIVE">Negative</option>
                      <option value="KNOWN_POSITIVE">Known Positive (On ART)</option>
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Syphilis Screen</label>
                    <Dropdown name="syphilisTestResult" value={formData.syphilisTestResult} onChange={handleChange} className="input mt-1 w-full">
                      <option value="">Not Tested Today</option>
                      <option value="POSITIVE">Positive</option>
                      <option value="NEGATIVE">Negative</option>
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hepatitis B (HBsAg)</label>
                    <Dropdown name="hepBTestResult" value={formData.hepBTestResult} onChange={handleChange} className="input mt-1 w-full">
                      <option value="">Not Tested Today</option>
                      <option value="POSITIVE">Positive</option>
                      <option value="NEGATIVE">Negative</option>
                    </Dropdown>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Malaria RDT</label>
                    <Dropdown name="malariaRdtResult" value={formData.malariaRdtResult} onChange={handleChange} className="input mt-1 w-full">
                      <option value="">Not Tested Today</option>
                      <option value="POSITIVE">Positive</option>
                      <option value="NEGATIVE">Negative</option>
                    </Dropdown>
                  </div>
                </div>
              </div>

              {/* PREVENTION */}
              <div className={activeTab === 'prevention' ? 'block' : 'hidden'}>
                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Prevention & Nutrition Support</h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input type="checkbox" id="ironFolicAcidProvided" name="ironFolicAcidProvided" checked={formData.ironFolicAcidProvided} onChange={handleChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                    <label htmlFor="ironFolicAcidProvided" className="ml-2 block text-sm text-gray-900">Iron and Folic Acid Supplementation Provided (Daily Oral)</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="calciumProvided" name="calciumProvided" checked={formData.calciumProvided} onChange={handleChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                    <label htmlFor="calciumProvided" className="ml-2 block text-sm text-gray-900">Calcium Supplementation Provided (Daily Oral)</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="itnProvided" name="itnProvided" checked={formData.itnProvided} onChange={handleChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                    <label htmlFor="itnProvided" className="ml-2 block text-sm text-gray-900">Insecticide-Treated Net (ITN) Provided Today</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="dewormingProvided" name="dewormingProvided" checked={formData.dewormingProvided} onChange={handleChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                    <label htmlFor="dewormingProvided" className="ml-2 block text-sm text-gray-900">Anti-helminthic Treatment (Deworming) Provided</label>
                  </div>
                  <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-700">Malaria IPTp Dose Given</label>
                    <Dropdown name="iptpDose" value={formData.iptpDose} onChange={handleChange} className="input mt-1 w-64">
                      <option value="">None Today</option>
                      <option value="1">Dose 1</option>
                      <option value="2">Dose 2</option>
                      <option value="3">Dose 3</option>
                      <option value="4">Dose 4</option>
                      <option value="5">Dose 5+</option>
                    </Dropdown>
                  </div>

                  <h4 className="font-semibold text-gray-800 border-b pb-1 mt-6">Tetanus Toxoid (TT) Immunization</h4>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Cumulative TT Doses To Date</label>
                      <input type="number" min="0" max="5" name="ttDosesToDate" value={formData.ttDosesToDate} onChange={handleChange} className="input mt-1 w-full" placeholder="e.g. 2" />
                    </div>
                    <div className="flex items-center pt-6">
                      <input type="checkbox" id="ttDoseGivenToday" name="ttDoseGivenToday" checked={formData.ttDoseGivenToday} onChange={handleChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                      <label htmlFor="ttDoseGivenToday" className="ml-2 block text-sm text-gray-900 font-medium">TT Dose Administered Today</label>
                    </div>
                  </div>
                </div>
              </div>

              {/* COUNSELING */}
              <div className={activeTab === 'counseling' ? 'block' : 'hidden'}>
                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Counseling & General Notes</h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input type="checkbox" id="ultrasoundDone" name="ultrasoundDone" checked={formData.ultrasoundDone} onChange={handleChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                    <label htmlFor="ultrasoundDone" className="ml-2 block text-sm text-gray-900">Early Ultrasound Performed Today (Before 24 weeks)</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="counselingDone" name="counselingDone" checked={formData.counselingDone} onChange={handleChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                    <label htmlFor="counselingDone" className="ml-2 block text-sm text-gray-900">General Counseling Performed</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="counseledOnDangerSigns" name="counseledOnDangerSigns" checked={formData.counseledOnDangerSigns} onChange={handleChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                    <label htmlFor="counseledOnDangerSigns" className="ml-2 block text-sm text-gray-900">Counseled on Danger Signs & Physiological Symptoms (Nausea, Heartburn)</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="birthPreparednessPlanDiscussed" name="birthPreparednessPlanDiscussed" checked={formData.birthPreparednessPlanDiscussed} onChange={handleChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                    <label htmlFor="birthPreparednessPlanDiscussed" className="ml-2 block text-sm text-gray-900">Birth Preparedness & Complication Readiness Plan Discussed</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="intimatePartnerViolenceScreening" name="intimatePartnerViolenceScreening" checked={formData.intimatePartnerViolenceScreening} onChange={handleChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                    <label htmlFor="intimatePartnerViolenceScreening" className="ml-2 block text-sm text-gray-900">Intimate Partner Violence (IPV) Clinical Enquiry / Screening Done</label>
                  </div>
                  <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-700">Clinical Notes & Symptoms Management</label>
                    <textarea name="notes" rows={4} value={formData.notes} onChange={handleChange} className="input mt-1 w-full" placeholder="Document physiological symptoms (nausea, heartburn) and advice given..."></textarea>
                  </div>
                  <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-700">Others</label>
                    <textarea name="others" rows={3} value={formData.others} onChange={handleChange} className="input mt-1 w-full" placeholder="Any other findings or observations not captured above..."></textarea>
                  </div>
                </div>
              </div>

              {/* MEDICATIONS */}
              <div className={activeTab === 'medications' ? 'block' : 'hidden'}>
                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Prescribe Medication</h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Medication Name</label>
                    <MedicationAutocomplete
                      value={medicationDraft.medicationName}
                      onChange={(value) => handleMedicationDraftChange('medicationName', value)}
                      onSelect={handleMedicationSelect}
                      placeholder="Search inventory or type a medication name..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Route</label>
                      <Dropdown className="input mt-1 w-full" value={medicationDraft.route} onChange={(e) => handleMedicationDraftChange('route', e.target.value)}>
                        <option value="ORAL">Oral</option>
                        <option value="INTRAVENOUS">Intravenous (IV)</option>
                        <option value="INTRAMUSCULAR">Intramuscular (IM)</option>
                        <option value="TOPICAL">Topical</option>
                        <option value="OTHER">Other</option>
                      </Dropdown>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Dosage</label>
                      <input type="text" className="input mt-1 w-full" placeholder="e.g., 500mg" value={medicationDraft.dosage} onChange={(e) => handleMedicationDraftChange('dosage', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Frequency</label>
                      <input type="text" className="input mt-1 w-full" placeholder="e.g., Twice daily" value={medicationDraft.frequency} onChange={(e) => handleMedicationDraftChange('frequency', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Duration</label>
                      <Dropdown className="input mt-1 w-full" value={medicationDraft.duration} onChange={(e) => handleMedicationDraftChange('duration', e.target.value)}>
                        {DURATION_OPTIONS.map(opt => (
                          <option key={opt} value={opt === 'Select duration' ? '' : opt}>{opt}</option>
                        ))}
                        <option value="CUSTOM">Custom...</option>
                        {medicationDraft.duration && !DURATION_OPTIONS.includes(medicationDraft.duration) && (
                          <option value={medicationDraft.duration}>{medicationDraft.duration}</option>
                        )}
                      </Dropdown>
                      {(medicationDraft.duration === 'CUSTOM' || (!!medicationDraft.duration && !DURATION_OPTIONS.includes(medicationDraft.duration) && medicationDraft.duration !== 'CUSTOM')) && (
                        <input
                          type="text"
                          className="input w-full mt-2"
                          placeholder="e.g., 7 days"
                          value={medicationDraft.duration === 'CUSTOM' ? '' : medicationDraft.duration}
                          onChange={(e) => handleMedicationDraftChange('duration', e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Instructions</label>
                    <textarea rows={2} className="input mt-1 w-full" placeholder="e.g., Take with food" value={medicationDraft.instructions} onChange={(e) => handleMedicationDraftChange('instructions', e.target.value)} />
                  </div>
                  <button type="button" onClick={handleAddMedication} className="btn btn-secondary flex items-center gap-2">
                    <Pill className="w-4 h-4" /> Add Medication
                  </button>
                </div>

                {stagedMedications.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Medications to be prescribed with this visit</h4>
                    {stagedMedications.map((med, index) => (
                      <div key={index} className="flex justify-between items-center border border-gray-200 rounded-md p-3 bg-white">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{med.medicationName}</p>
                          <p className="text-xs text-gray-500">{med.dosage} - {med.frequency} {med.duration ? `- ${med.duration}` : ''}</p>
                        </div>
                        <button type="button" onClick={() => handleRemoveMedication(index)} className="text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </form>
          </div>
        </div>

        <div className="border-t p-4 flex justify-between bg-gray-50 rounded-b-lg items-center">
          <p className="text-sm text-gray-500 flex items-center">
            <AlertCircle className="w-4 h-4 mr-1 text-primary-500" />
            Fill out all applicable WHO sections before saving.
          </p>
          <div className="flex space-x-3">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="anc-visit-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Visit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordAncVisitModal;
