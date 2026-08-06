import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import laborService from '../../../services/labor.service';
import { LaborRecord } from '../../../types/labor';
import { useToast } from '../../ToastContainer';
import Dropdown from '../../common/Dropdown';
import DangerSignBanner from '../../common/DangerSignBanner';

interface DeliveryOutcomeModalProps {
  laborRecordId: string;
  // Used only for the post-error recovery check below — not needed for the
  // submit itself.
  admissionId: string;
  onClose: () => void;
  onSuccess: (laborRecord: LaborRecord) => void;
}

const toDatetimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const STILLBIRTH_OUTCOMES = ['STILLBIRTH_FRESH', 'STILLBIRTH_MACERATED'];

// Live, non-blocking check mirroring the same PPH/stillbirth/APGAR/
// resuscitation thresholds the backend uses to fire a staff notification
// (record-delivery-outcome.use-case.ts) — this banner is just the on-screen
// echo of that; the real alerting happens server-side.
// WHO defines PPH as >=500mL for vaginal delivery but >=1000mL for
// cesarean — a flat 500mL threshold would false-alarm on every normal
// C-section (mirrors record-delivery-outcome.use-case.ts's threshold exactly).
const getPphThresholdMl = (modeOfDelivery: string): number => (modeOfDelivery === 'CESAREAN_SECTION' ? 1000 : 500);

const getDeliveryDangerSigns = (formData: {
  estimatedBloodLossMl: string;
  babyOutcome: string;
  modeOfDelivery: string;
  apgarScore5Min: string;
  resuscitationRequired: boolean;
}): string[] => {
  const signs: string[] = [];
  const bloodLoss = parseInt(formData.estimatedBloodLossMl, 10);
  const pphThreshold = getPphThresholdMl(formData.modeOfDelivery);
  if (!isNaN(bloodLoss) && bloodLoss >= pphThreshold) signs.push(`Estimated blood loss ${bloodLoss}ml — possible PPH (threshold ${pphThreshold}ml for this delivery mode)`);
  if (STILLBIRTH_OUTCOMES.includes(formData.babyOutcome)) signs.push('Stillbirth outcome recorded');
  const apgar5 = parseInt(formData.apgarScore5Min, 10);
  if (!isNaN(apgar5) && apgar5 < 7) signs.push(`5-minute APGAR score ${apgar5} is low`);
  if (formData.resuscitationRequired) signs.push('Neonatal resuscitation was required');
  return signs;
};

const DeliveryOutcomeModal: React.FC<DeliveryOutcomeModalProps> = ({ laborRecordId, admissionId, onClose, onSuccess }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deliveredAt, setDeliveredAt] = useState(toDatetimeLocal(new Date()));
  const [modeOfDelivery, setModeOfDelivery] = useState('SVD');
  const [perineumStatus, setPerineumStatus] = useState('');
  const [estimatedBloodLossMl, setEstimatedBloodLossMl] = useState('');
  const [babyOutcome, setBabyOutcome] = useState('LIVE_BIRTH');
  const [babySex, setBabySex] = useState('');
  const [babyBirthWeightGrams, setBabyBirthWeightGrams] = useState('');
  const [apgarScore1Min, setApgarScore1Min] = useState('');
  const [apgarScore5Min, setApgarScore5Min] = useState('');
  const [resuscitationRequired, setResuscitationRequired] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [registerNewbornAsPatient, setRegisterNewbornAsPatient] = useState(true);
  const [newbornPatient, setNewbornPatient] = useState<{ id: string; patientId: string } | null>(null);
  const [deliveredLaborRecord, setDeliveredLaborRecord] = useState<LaborRecord | null>(null);

  const dangerSigns = getDeliveryDangerSigns({ estimatedBloodLossMl, babyOutcome, modeOfDelivery, apgarScore5Min, resuscitationRequired });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const result = await laborService.recordDeliveryOutcome(laborRecordId, {
        deliveredAt: deliveredAt ? new Date(deliveredAt).toISOString() : undefined,
        modeOfDelivery,
        perineumStatus: perineumStatus || undefined,
        estimatedBloodLossMl: estimatedBloodLossMl === '' ? undefined : Number(estimatedBloodLossMl),
        babyOutcome,
        babySex: (babySex || undefined) as 'MALE' | 'FEMALE' | undefined,
        babyBirthWeightGrams: babyBirthWeightGrams === '' ? undefined : Number(babyBirthWeightGrams),
        apgarScore1Min: apgarScore1Min === '' ? undefined : Number(apgarScore1Min),
        apgarScore5Min: apgarScore5Min === '' ? undefined : Number(apgarScore5Min),
        resuscitationRequired,
        deliveryNotes: deliveryNotes || undefined,
        registerNewbornAsPatient: babyOutcome === 'LIVE_BIRTH' ? registerNewbornAsPatient : false,
      });
      toast.success(
        'Delivery recorded',
        result.pregnancyClosed ? 'Antenatal record closed out.' : 'No antenatal record was linked — nothing to close out.'
      );
      if (result.newbornPatient) {
        setNewbornPatient(result.newbornPatient);
        setDeliveredLaborRecord(result.laborRecord);
        toast.success('Newborn registered', `Patient ID ${result.newbornPatient.patientId} — update their name once decided.`);
      } else {
        onSuccess(result.laborRecord);
      }
    } catch (err: any) {
      // A lost response (e.g. network timeout right after a successful
      // commit) would otherwise strand the newborn's patient ID — the
      // labor record is already DELIVERED, but the frontend never learned
      // that. Re-check via the record's actual current state before
      // showing a bare error that implies nothing happened.
      try {
        const current = await laborService.getLaborRecordByAdmission(admissionId);
        if (current && current.status === 'DELIVERED') {
          setDeliveredLaborRecord(current);
          if (current.newbornPatient) {
            setNewbornPatient(current.newbornPatient);
          } else {
            toast.success('Delivery already recorded', 'This delivery outcome was already saved.');
            onSuccess(current);
          }
          return;
        }
      } catch {
        // Fall through to the generic error below if the recovery check itself fails.
      }
      toast.error(err.response?.data?.message || err.message || 'Failed to record delivery outcome');
    } finally {
      setLoading(false);
    }
  };

  if (newbornPatient) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 text-center">
          <h2 className="text-xl font-semibold text-gray-800">Delivery Recorded</h2>
          <p className="text-sm text-gray-600">
            The newborn was registered as a patient with a placeholder name and phone number.
          </p>
          <p className="text-lg font-semibold text-primary-700">{newbornPatient.patientId}</p>
          <p className="text-xs text-gray-500">
            Update the name once decided, from the Patients page.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (deliveredLaborRecord) onSuccess(deliveredLaborRecord);
                navigate(`/patients?patientId=${newbornPatient.id}`);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
            >
              View Newborn's Chart
            </button>
            <button
              type="button"
              onClick={() => deliveredLaborRecord && onSuccess(deliveredLaborRecord)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Record Delivery Outcome</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <DangerSignBanner signs={dangerSigns} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Time *</label>
              <input type="datetime-local" required className="input w-full" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode of Delivery *</label>
              <Dropdown required className="input w-full" value={modeOfDelivery} onChange={(e) => setModeOfDelivery(e.target.value)}>
                <option value="SVD">Spontaneous Vaginal Delivery</option>
                <option value="ASSISTED_VACUUM">Assisted — Vacuum</option>
                <option value="ASSISTED_FORCEPS">Assisted — Forceps</option>
                <option value="CESAREAN_SECTION">Cesarean Section</option>
                <option value="BREECH">Breech</option>
              </Dropdown>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Perineum</label>
              <Dropdown className="input w-full" value={perineumStatus} onChange={(e) => setPerineumStatus(e.target.value)}>
                <option value="">Not recorded</option>
                <option value="INTACT">Intact</option>
                <option value="EPISIOTOMY">Episiotomy</option>
                <option value="FIRST_DEGREE_TEAR">First Degree Tear</option>
                <option value="SECOND_DEGREE_TEAR">Second Degree Tear</option>
                <option value="THIRD_DEGREE_TEAR">Third Degree Tear</option>
                <option value="FOURTH_DEGREE_TEAR">Fourth Degree Tear</option>
              </Dropdown>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Blood Loss (ml)</label>
              <input type="number" min="0" className="input w-full" value={estimatedBloodLossMl} onChange={(e) => setEstimatedBloodLossMl(e.target.value)} />
            </div>
          </div>

          <div className="pt-2 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 mt-3">Baby</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outcome *</label>
                <Dropdown required className="input w-full" value={babyOutcome} onChange={(e) => setBabyOutcome(e.target.value)}>
                  <option value="LIVE_BIRTH">Live Birth</option>
                  <option value="STILLBIRTH_FRESH">Stillbirth (Fresh)</option>
                  <option value="STILLBIRTH_MACERATED">Stillbirth (Macerated)</option>
                </Dropdown>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sex {babyOutcome === 'LIVE_BIRTH' && registerNewbornAsPatient && '*'}
                </label>
                <Dropdown
                  required={babyOutcome === 'LIVE_BIRTH' && registerNewbornAsPatient}
                  className="input w-full"
                  value={babySex}
                  onChange={(e) => setBabySex(e.target.value)}
                >
                  <option value="">Not recorded</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Dropdown>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Birth Weight (g)</label>
                <input type="number" min="0" className="input w-full" value={babyBirthWeightGrams} onChange={(e) => setBabyBirthWeightGrams(e.target.value)} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                  <input type="checkbox" checked={resuscitationRequired} onChange={(e) => setResuscitationRequired(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  Resuscitation Required
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apgar Score (1 min)</label>
                <input type="number" min="0" max="10" className="input w-full" value={apgarScore1Min} onChange={(e) => setApgarScore1Min(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apgar Score (5 min)</label>
                <input type="number" min="0" max="10" className="input w-full" value={apgarScore5Min} onChange={(e) => setApgarScore5Min(e.target.value)} />
              </div>
            </div>

            {babyOutcome === 'LIVE_BIRTH' && (
              <label className="flex items-start gap-2 text-sm text-gray-700 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  checked={registerNewbornAsPatient}
                  onChange={(e) => setRegisterNewbornAsPatient(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>
                  Register newborn as a patient
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Creates a chart with a placeholder name/phone ("Baby of {'{mother}'}") so immunizations and future
                    visits have somewhere to attach — update the name once decided.
                  </span>
                </span>
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes</label>
            <textarea rows={3} className="input w-full" value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700" disabled={loading}>
              {loading ? 'Saving...' : 'Confirm Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliveryOutcomeModal;
