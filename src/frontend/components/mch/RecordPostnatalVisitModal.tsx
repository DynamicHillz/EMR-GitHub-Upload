import React, { useState } from 'react';
import { X } from 'lucide-react';
import postnatalService from '../../services/postnatal.service';
import { PostnatalVisit, RecordPostnatalVisitDto } from '../../types/postnatal';
import { useToast } from '../ToastContainer';
import Dropdown from '../common/Dropdown';
import DangerSignBanner from '../common/DangerSignBanner';

interface RecordPostnatalVisitModalProps {
  patientId: string;
  pregnancyId?: string;
  // Set when opened from a booked 'Postnatal Follow-up' appointment — no
  // current UI entry point does this yet, but the field is wired through
  // so that integration can be added without another backend round-trip.
  appointmentId?: string;
  // AncPregnancy.outcome — 'LIVE_BIRTH' | 'STILLBIRTH_FRESH' | 'STILLBIRTH_MACERATED' | undefined.
  // When it's a stillbirth, the Newborn tab (feeding, jaundice, cord
  // condition) doesn't apply to a baby who didn't survive and shouldn't be
  // presented on a bereaved mother's chart.
  pregnancyOutcome?: string;
  onClose: () => void;
  onSuccess: (visit: PostnatalVisit) => void;
}

const isStillbirthOutcome = (outcome?: string): boolean => !!outcome && outcome.startsWith('STILLBIRTH');

const toDatetimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

// Tri-state helper for fields where "not recorded" must stay distinct from
// "normal" — defaulting an unobserved field to true would silently assert
// normalcy that was never actually checked.
const triStateToBoolean = (value: string): boolean | undefined => (value === '' ? undefined : value === 'true');

interface FormState {
  contactType: string;
  visitDate: string;
  maternalTemperature: string;
  maternalSystolicBP: string;
  maternalDiastolicBP: string;
  lochiaStatus: string;
  uterineInvolutionNormal: string;
  perinealWoundStatus: string;
  breastfeedingStatus: string;
  moodScreeningConcern: boolean;
  newbornWeightGrams: string;
  newbornTemperature: string;
  newbornFeedingWell: string;
  cordConditionNormal: string;
  jaundiceObserved: boolean;
  newbornDangerSigns: string;
  familyPlanningCounselingDone: boolean;
  notes: string;
}

const getPostnatalDangerSigns = (formData: FormState): string[] => {
  const signs: string[] = [];
  const systolic = parseInt(formData.maternalSystolicBP, 10);
  const diastolic = parseInt(formData.maternalDiastolicBP, 10);
  if ((!isNaN(systolic) && systolic >= 140) || (!isNaN(diastolic) && diastolic >= 90)) {
    signs.push('Maternal blood pressure is elevated');
  }
  if (formData.lochiaStatus === 'HEAVY' || formData.lochiaStatus === 'OFFENSIVE') {
    signs.push(`Lochia is ${formData.lochiaStatus.toLowerCase()} — possible PPH/infection`);
  }
  if (formData.uterineInvolutionNormal === 'false') signs.push('Uterine involution is not progressing normally');
  if (formData.perinealWoundStatus === 'INFECTED' || formData.perinealWoundStatus === 'BREAKDOWN') {
    signs.push(`Perineal wound is ${formData.perinealWoundStatus.toLowerCase()}`);
  }
  if (formData.moodScreeningConcern) signs.push('Mood screening flagged a concern');
  if (formData.newbornFeedingWell === 'false') signs.push('Newborn is not feeding well');
  if (formData.jaundiceObserved) signs.push('Jaundice observed in the newborn');
  if (formData.cordConditionNormal === 'false') signs.push('Newborn cord condition is abnormal');
  if (formData.newbornDangerSigns.trim()) signs.push(`Newborn danger sign(s): ${formData.newbornDangerSigns.trim()}`);
  return signs;
};

const RecordPostnatalVisitModal: React.FC<RecordPostnatalVisitModalProps> = ({ patientId, pregnancyId, appointmentId, pregnancyOutcome, onClose, onSuccess }) => {
  const toast = useToast();
  const isStillbirth = isStillbirthOutcome(pregnancyOutcome);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'maternal' | 'newborn' | 'counseling'>('maternal');
  const [formData, setFormData] = useState<FormState>({
    contactType: 'PNC_24H',
    visitDate: toDatetimeLocal(new Date()),
    maternalTemperature: '',
    maternalSystolicBP: '',
    maternalDiastolicBP: '',
    lochiaStatus: '',
    uterineInvolutionNormal: '',
    perinealWoundStatus: '',
    breastfeedingStatus: '',
    moodScreeningConcern: false,
    newbornWeightGrams: '',
    newbornTemperature: '',
    newbornFeedingWell: '',
    cordConditionNormal: '',
    jaundiceObserved: false,
    newbornDangerSigns: '',
    familyPlanningCounselingDone: false,
    notes: '',
  });

  const dangerSigns = getPostnatalDangerSigns(formData);
  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => setFormData((prev) => ({ ...prev, [field]: value }));
  const toNumber = (value: string): number | undefined => (value === '' ? undefined : Number(value));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const dto: RecordPostnatalVisitDto = {
        pregnancyId,
        appointmentId,
        contactType: formData.contactType as RecordPostnatalVisitDto['contactType'],
        visitDate: formData.visitDate ? new Date(formData.visitDate).toISOString() : undefined,
        maternalTemperature: toNumber(formData.maternalTemperature),
        maternalSystolicBP: toNumber(formData.maternalSystolicBP),
        maternalDiastolicBP: toNumber(formData.maternalDiastolicBP),
        lochiaStatus: formData.lochiaStatus || undefined,
        uterineInvolutionNormal: triStateToBoolean(formData.uterineInvolutionNormal),
        perinealWoundStatus: formData.perinealWoundStatus || undefined,
        breastfeedingStatus: formData.breastfeedingStatus || undefined,
        moodScreeningConcern: formData.moodScreeningConcern,
        newbornWeightGrams: toNumber(formData.newbornWeightGrams),
        newbornTemperature: toNumber(formData.newbornTemperature),
        newbornFeedingWell: triStateToBoolean(formData.newbornFeedingWell),
        cordConditionNormal: triStateToBoolean(formData.cordConditionNormal),
        jaundiceObserved: formData.jaundiceObserved,
        newbornDangerSigns: formData.newbornDangerSigns.trim()
          ? formData.newbornDangerSigns.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        familyPlanningCounselingDone: formData.familyPlanningCounselingDone,
        notes: formData.notes || undefined,
      };
      const visit = await postnatalService.recordVisit(patientId, dto);
      toast.success('Postnatal visit recorded');
      onSuccess(visit);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to record postnatal visit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Record Postnatal Visit</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <DangerSignBanner signs={dangerSigns} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact *</label>
              <Dropdown required className="input w-full" value={formData.contactType} onChange={(e) => update('contactType', e.target.value)}>
                <option value="PNC_24H">24 Hours</option>
                <option value="PNC_DAY3">Day 3</option>
                <option value="PNC_WEEK1">Week 1</option>
                <option value="PNC_WEEK6">Week 6</option>
                <option value="OTHER">Other</option>
              </Dropdown>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date/Time *</label>
              <input type="datetime-local" required className="input w-full" value={formData.visitDate} onChange={(e) => update('visitDate', e.target.value)} />
            </div>
          </div>

          <div className="flex gap-1 border-b">
            {(['maternal', 'newborn', 'counseling'] as const)
              .filter((tab) => tab !== 'newborn' || !isStillbirth)
              .map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium capitalize ${activeTab === tab ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {tab}
                </button>
              ))}
          </div>

          {isStillbirth && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
              Newborn observations aren't shown — this pregnancy's outcome was recorded as a stillbirth.
            </p>
          )}

          <div className={activeTab === 'maternal' ? 'block' : 'hidden'}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Temperature (°C)</label>
                <input type="number" step="0.1" className="input w-full text-sm py-1.5" value={formData.maternalTemperature} onChange={(e) => update('maternalTemperature', e.target.value)} />
              </div>
              <div />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Systolic BP</label>
                <input type="number" className="input w-full text-sm py-1.5" value={formData.maternalSystolicBP} onChange={(e) => update('maternalSystolicBP', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Diastolic BP</label>
                <input type="number" className="input w-full text-sm py-1.5" value={formData.maternalDiastolicBP} onChange={(e) => update('maternalDiastolicBP', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lochia</label>
                <Dropdown className="input w-full text-sm py-1.5" value={formData.lochiaStatus} onChange={(e) => update('lochiaStatus', e.target.value)}>
                  <option value="">Not recorded</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HEAVY">Heavy</option>
                  <option value="OFFENSIVE">Offensive</option>
                </Dropdown>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Uterine Involution</label>
                <Dropdown className="input w-full text-sm py-1.5" value={formData.uterineInvolutionNormal} onChange={(e) => update('uterineInvolutionNormal', e.target.value)}>
                  <option value="">Not recorded</option>
                  <option value="true">Normal</option>
                  <option value="false">Abnormal</option>
                </Dropdown>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Perineal Wound</label>
                <Dropdown className="input w-full text-sm py-1.5" value={formData.perinealWoundStatus} onChange={(e) => update('perinealWoundStatus', e.target.value)}>
                  <option value="">Not recorded / no wound</option>
                  <option value="NORMAL">Normal</option>
                  <option value="INTACT">Intact</option>
                  <option value="INFECTED">Infected</option>
                  <option value="BREAKDOWN">Breakdown</option>
                </Dropdown>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Breastfeeding</label>
                <Dropdown className="input w-full text-sm py-1.5" value={formData.breastfeedingStatus} onChange={(e) => update('breastfeedingStatus', e.target.value)}>
                  <option value="">Not recorded</option>
                  <option value="EXCLUSIVE">Exclusive</option>
                  <option value="MIXED">Mixed</option>
                  <option value="NOT_BREASTFEEDING">Not Breastfeeding</option>
                </Dropdown>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 mt-3">
              <input type="checkbox" checked={formData.moodScreeningConcern} onChange={(e) => update('moodScreeningConcern', e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Mood screening flagged a concern
            </label>
          </div>

          <div className={activeTab === 'newborn' ? 'block' : 'hidden'}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Weight (g)</label>
                <input type="number" min="0" className="input w-full text-sm py-1.5" value={formData.newbornWeightGrams} onChange={(e) => update('newbornWeightGrams', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Temperature (°C)</label>
                <input type="number" step="0.1" className="input w-full text-sm py-1.5" value={formData.newbornTemperature} onChange={(e) => update('newbornTemperature', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Feeding</label>
                <Dropdown className="input w-full text-sm py-1.5" value={formData.newbornFeedingWell} onChange={(e) => update('newbornFeedingWell', e.target.value)}>
                  <option value="">Not recorded</option>
                  <option value="true">Feeding well</option>
                  <option value="false">Not feeding well</option>
                </Dropdown>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cord Condition</label>
                <Dropdown className="input w-full text-sm py-1.5" value={formData.cordConditionNormal} onChange={(e) => update('cordConditionNormal', e.target.value)}>
                  <option value="">Not recorded</option>
                  <option value="true">Normal</option>
                  <option value="false">Abnormal</option>
                </Dropdown>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 mt-3">
              <input type="checkbox" checked={formData.jaundiceObserved} onChange={(e) => update('jaundiceObserved', e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Jaundice observed
            </label>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Other Newborn Danger Signs (comma-separated)</label>
              <input type="text" placeholder="e.g. difficulty breathing, convulsions" className="input w-full text-sm py-1.5" value={formData.newbornDangerSigns} onChange={(e) => update('newbornDangerSigns', e.target.value)} />
            </div>
          </div>

          <div className={activeTab === 'counseling' ? 'block' : 'hidden'}>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={formData.familyPlanningCounselingDone} onChange={(e) => update('familyPlanningCounselingDone', e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Family planning counseling done
            </label>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea rows={3} className="input w-full" value={formData.notes} onChange={(e) => update('notes', e.target.value)} />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700" disabled={loading}>
              {loading ? 'Saving...' : 'Save Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordPostnatalVisitModal;
