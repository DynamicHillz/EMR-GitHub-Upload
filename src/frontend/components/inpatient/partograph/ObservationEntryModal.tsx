import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import laborService from '../../../services/labor.service';
import { PartographObservation } from '../../../types/labor';
import { useToast } from '../../ToastContainer';
import Dropdown from '../../common/Dropdown';
import DilationChart from './DilationChart';
import FetalHeartRateChart from './FetalHeartRateChart';

interface ObservationEntryModalProps {
  laborRecordId: string;
  observations?: PartographObservation[];
  activePhaseOnsetAt?: string;
  onClose: () => void;
  onSuccess: (observation: PartographObservation) => void;
}

const toDatetimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

interface FormState {
  recordedAt: string;
  cervicalDilation: string;
  descentOfHead: string;
  fetalHeartRate: string;
  liquor: string;
  moulding: string;
  contractionsFrequencyPer10Min: string;
  contractionsDurationSeconds: string;
  maternalPulse: string;
  maternalSystolicBP: string;
  maternalDiastolicBP: string;
  maternalTemperature: string;
  urineProtein: string;
  urineAcetone: string;
  urineVolumeMl: string;
  oxytocinDose: string;
  drugsGiven: string;
  ivFluids: string;
  notes: string;
}

const getDangerSigns = (formData: FormState): string[] => {
  const signs: string[] = [];
  const fhr = parseInt(formData.fetalHeartRate, 10);
  if (!isNaN(fhr) && (fhr < 110 || fhr > 160)) {
    signs.push(`Fetal heart rate ${fhr}bpm is outside the normal range (110-160bpm)`);
  }
  const systolic = parseInt(formData.maternalSystolicBP, 10);
  const diastolic = parseInt(formData.maternalDiastolicBP, 10);
  if ((!isNaN(systolic) && systolic >= 140) || (!isNaN(diastolic) && diastolic >= 90)) {
    signs.push('Maternal blood pressure is elevated — possible pre-eclampsia');
  }
  return signs;
};

const ObservationEntryModal: React.FC<ObservationEntryModalProps> = ({ laborRecordId, observations = [], activePhaseOnsetAt, onClose, onSuccess }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>({
    recordedAt: toDatetimeLocal(new Date()),
    cervicalDilation: '',
    descentOfHead: '',
    fetalHeartRate: '',
    liquor: '',
    moulding: '',
    contractionsFrequencyPer10Min: '',
    contractionsDurationSeconds: '',
    maternalPulse: '',
    maternalSystolicBP: '',
    maternalDiastolicBP: '',
    maternalTemperature: '',
    urineProtein: '',
    urineAcetone: '',
    urineVolumeMl: '',
    oxytocinDose: '',
    drugsGiven: '',
    ivFluids: '',
    notes: '',
  });

  const dangerSigns = getDangerSigns(formData);

  // Mirrors the classic paper-partograph workflow — the point appears on
  // the chart the moment it's typed, not only after the form is saved, so
  // the clinician can see it against the alert/action line while still
  // filling the rest of the reading in.
  const draftObservation = {
    id: '__draft__',
    laborRecordId,
    recordedById: '',
    recordedAt: formData.recordedAt ? new Date(formData.recordedAt).toISOString() : new Date().toISOString(),
    cervicalDilation: formData.cervicalDilation === '' ? undefined : Number(formData.cervicalDilation),
    fetalHeartRate: formData.fetalHeartRate === '' ? undefined : Number(formData.fetalHeartRate),
    isDraft: true,
  } as PartographObservation & { isDraft: true };
  const previewObservations = [...observations, draftObservation];

  const update = (field: keyof FormState, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const toNumber = (value: string): number | undefined => (value === '' ? undefined : Number(value));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const observation = await laborService.recordObservation(laborRecordId, {
        recordedAt: formData.recordedAt ? new Date(formData.recordedAt).toISOString() : undefined,
        cervicalDilation: toNumber(formData.cervicalDilation),
        descentOfHead: formData.descentOfHead || undefined,
        fetalHeartRate: toNumber(formData.fetalHeartRate),
        liquor: formData.liquor || undefined,
        moulding: formData.moulding || undefined,
        contractionsFrequencyPer10Min: toNumber(formData.contractionsFrequencyPer10Min),
        contractionsDurationSeconds: toNumber(formData.contractionsDurationSeconds),
        maternalPulse: toNumber(formData.maternalPulse),
        maternalSystolicBP: toNumber(formData.maternalSystolicBP),
        maternalDiastolicBP: toNumber(formData.maternalDiastolicBP),
        maternalTemperature: toNumber(formData.maternalTemperature),
        urineProtein: formData.urineProtein || undefined,
        urineAcetone: formData.urineAcetone || undefined,
        urineVolumeMl: toNumber(formData.urineVolumeMl),
        oxytocinDose: formData.oxytocinDose || undefined,
        drugsGiven: formData.drugsGiven || undefined,
        ivFluids: formData.ivFluids || undefined,
        notes: formData.notes || undefined,
      });
      toast.success('Observation recorded');
      onSuccess(observation);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to record observation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Record Partograph Observation</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {dangerSigns.length > 0 && (
            <div className="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 font-bold mb-1">
                <AlertCircle className="w-5 h-5" />
                Danger Sign(s) Detected
              </div>
              <ul className="list-disc list-inside text-sm text-red-700">
                {dangerSigns.map((sign) => (
                  <li key={sign}>{sign}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Live Preview</h3>
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Unsaved reading — plots as you type below
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DilationChart observations={previewObservations} activePhaseOnsetAt={activePhaseOnsetAt} />
              <FetalHeartRateChart observations={previewObservations} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recorded At *</label>
            <input
              type="datetime-local"
              required
              className="input w-full max-w-xs"
              value={formData.recordedAt}
              onChange={(e) => update('recordedAt', e.target.value)}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1 mb-3">Fetal</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cervical Dilation (cm)</label>
                <input type="number" min="0" max="10" className="input w-full text-sm py-1.5" value={formData.cervicalDilation} onChange={(e) => update('cervicalDilation', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descent of Head</label>
                <input type="text" placeholder="e.g. 3/5 or -2" className="input w-full text-sm py-1.5" value={formData.descentOfHead} onChange={(e) => update('descentOfHead', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fetal Heart Rate (bpm)</label>
                <input type="number" className="input w-full text-sm py-1.5" value={formData.fetalHeartRate} onChange={(e) => update('fetalHeartRate', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Liquor</label>
                <Dropdown className="input w-full text-sm py-1.5" value={formData.liquor} onChange={(e) => update('liquor', e.target.value)}>
                  <option value="">Not recorded</option>
                  <option value="CLEAR">Clear</option>
                  <option value="MECONIUM_LIGHT">Meconium (Light)</option>
                  <option value="MECONIUM_THICK">Meconium (Thick)</option>
                  <option value="BLOOD_STAINED">Blood Stained</option>
                  <option value="ABSENT">Absent</option>
                </Dropdown>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Moulding</label>
                <Dropdown className="input w-full text-sm py-1.5" value={formData.moulding} onChange={(e) => update('moulding', e.target.value)}>
                  <option value="">Not recorded</option>
                  <option value="0">0</option>
                  <option value="+1">+1</option>
                  <option value="+2">+2</option>
                  <option value="+3">+3</option>
                </Dropdown>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1 mb-3">Contractions</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Frequency (per 10 min)</label>
                <input type="number" min="0" className="input w-full text-sm py-1.5" value={formData.contractionsFrequencyPer10Min} onChange={(e) => update('contractionsFrequencyPer10Min', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Duration (seconds)</label>
                <input type="number" min="0" className="input w-full text-sm py-1.5" value={formData.contractionsDurationSeconds} onChange={(e) => update('contractionsDurationSeconds', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1 mb-3">Maternal</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Pulse</label>
                <input type="number" className="input w-full text-sm py-1.5" value={formData.maternalPulse} onChange={(e) => update('maternalPulse', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Systolic BP</label>
                <input type="number" className="input w-full text-sm py-1.5" value={formData.maternalSystolicBP} onChange={(e) => update('maternalSystolicBP', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Diastolic BP</label>
                <input type="number" className="input w-full text-sm py-1.5" value={formData.maternalDiastolicBP} onChange={(e) => update('maternalDiastolicBP', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Temperature (°C)</label>
                <input type="number" step="0.1" className="input w-full text-sm py-1.5" value={formData.maternalTemperature} onChange={(e) => update('maternalTemperature', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1 mb-3">Urine</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Protein</label>
                <Dropdown className="input w-full text-sm py-1.5" value={formData.urineProtein} onChange={(e) => update('urineProtein', e.target.value)}>
                  <option value="">Not recorded</option>
                  <option value="NEGATIVE">Negative</option>
                  <option value="TRACE">Trace</option>
                  <option value="1+">1+</option>
                  <option value="2+">2+</option>
                  <option value="3+">3+</option>
                </Dropdown>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Acetone</label>
                <Dropdown className="input w-full text-sm py-1.5" value={formData.urineAcetone} onChange={(e) => update('urineAcetone', e.target.value)}>
                  <option value="">Not recorded</option>
                  <option value="NEGATIVE">Negative</option>
                  <option value="TRACE">Trace</option>
                  <option value="1+">1+</option>
                  <option value="2+">2+</option>
                  <option value="3+">3+</option>
                </Dropdown>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Volume (ml)</label>
                <input type="number" min="0" className="input w-full text-sm py-1.5" value={formData.urineVolumeMl} onChange={(e) => update('urineVolumeMl', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1 mb-3">Drugs & Fluids</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Oxytocin Dose</label>
                <input type="text" placeholder="e.g. 5 mU/min" className="input w-full text-sm py-1.5" value={formData.oxytocinDose} onChange={(e) => update('oxytocinDose', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Drugs Given</label>
                <input type="text" className="input w-full text-sm py-1.5" value={formData.drugsGiven} onChange={(e) => update('drugsGiven', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">IV Fluids</label>
                <input type="text" className="input w-full text-sm py-1.5" value={formData.ivFluids} onChange={(e) => update('ivFluids', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} className="input w-full" value={formData.notes} onChange={(e) => update('notes', e.target.value)} />
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700" disabled={loading}>
              {loading ? 'Saving...' : 'Save Observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ObservationEntryModal;
