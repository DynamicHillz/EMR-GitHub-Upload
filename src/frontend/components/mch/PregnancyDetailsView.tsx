import React, { useEffect, useMemo, useState } from 'react';
import { ancService } from '../../services/anc.service';
import postnatalService from '../../services/postnatal.service';
import { AncPregnancy, AncVisit } from '../../types/anc';
import { PostnatalVisit } from '../../types/postnatal';
import { ArrowLeft, Plus, Calendar, Activity, CheckCircle, FileText, Pill, Baby } from 'lucide-react';
import RecordAncVisitModal from './RecordAncVisitModal';
import RecordPostnatalVisitModal from './RecordPostnatalVisitModal';
import PrescriptionModal from '../consultations/PrescriptionModal';

const PNC_CONTACT_LABELS: Record<string, string> = {
  PNC_24H: '24 Hours',
  PNC_DAY3: 'Day 3',
  PNC_WEEK1: 'Week 1',
  PNC_WEEK6: 'Week 6',
  OTHER: 'Other',
};

interface PregnancyDetailsViewProps {
  pregnancy: AncPregnancy;
  onBack: () => void;
}

// WHO's 2016 ANC model recommends 8 contacts, targeted at these gestational
// weeks. Not a substitute for clinical judgement — a scheduling aid only.
const WHO_CONTACT_TARGET_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getNextAncContact = (pregnancy: AncPregnancy, visitCount: number): { date: Date; week: number } | null => {
  if (visitCount >= WHO_CONTACT_TARGET_WEEKS.length) return null;

  const lmp = pregnancy.lmp
    ? new Date(pregnancy.lmp)
    : pregnancy.edd
    ? new Date(new Date(pregnancy.edd).getTime() - 280 * MS_PER_DAY)
    : null;

  if (!lmp || isNaN(lmp.getTime())) return null;

  const week = WHO_CONTACT_TARGET_WEEKS[visitCount];
  return { date: new Date(lmp.getTime() + week * 7 * MS_PER_DAY), week };
};

const PregnancyDetailsView: React.FC<PregnancyDetailsViewProps> = ({ pregnancy, onBack }) => {
  const [visits, setVisits] = useState<AncVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [patient, setPatient] = useState<{ id: string; firstName: string; lastName: string; fullName: string; allergies: string[] } | null>(null);
  const [prescribeForVisitId, setPrescribeForVisitId] = useState<string | null>(null);
  const [postnatalVisits, setPostnatalVisits] = useState<PostnatalVisit[]>([]);
  const [loadingPostnatal, setLoadingPostnatal] = useState(false);
  const [showPostnatalModal, setShowPostnatalModal] = useState(false);

  useEffect(() => {
    const fetchVisits = async () => {
      try {
        const data = await ancService.getVisits(pregnancy.id);
        setVisits(data);
      } catch (error) {
        console.error('Failed to load visits', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVisits();
  }, [pregnancy.id]);

  useEffect(() => {
    if (!pregnancy.deliveryDate) return;
    const fetchPostnatalVisits = async () => {
      try {
        setLoadingPostnatal(true);
        const data = await postnatalService.getVisitsByPatient(pregnancy.patientId, pregnancy.id);
        setPostnatalVisits(data);
      } catch (error) {
        console.error('Failed to load postnatal visits', error);
      } finally {
        setLoadingPostnatal(false);
      }
    };
    fetchPostnatalVisits();
  }, [pregnancy.deliveryDate, pregnancy.patientId, pregnancy.id]);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
        const res = await fetch(`${apiBaseUrl}/api/patients/${pregnancy.patientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const result = await res.json();
          const p = result.data || result;
          setPatient({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            fullName: `${p.firstName} ${p.lastName}`,
            allergies: p.allergies || [],
          });
        }
      } catch (error) {
        console.error('Failed to load patient', error);
      }
    };
    fetchPatient();
  }, [pregnancy.patientId]);

  const handleVisitRecorded = (newVisit: any) => {
    setVisits([newVisit, ...visits]);
    setShowRecordModal(false);
  };

  const nextContact = useMemo(() => getNextAncContact(pregnancy, visits.length), [pregnancy, visits.length]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-900 flex items-center text-sm font-medium">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Pregnancies
        </button>
        <button onClick={() => setShowRecordModal(true)} className="btn btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Record ANC Visit
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Pregnancy Profile (G{pregnancy.gravidity} P{pregnancy.parity})
            </h2>
            <div className="text-sm text-gray-500 mt-1 flex gap-4">
              <span>LMP: {pregnancy.lmp ? new Date(pregnancy.lmp).toLocaleDateString() : 'N/A'}</span>
              <span>EDD: {pregnancy.edd ? new Date(pregnancy.edd).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${pregnancy.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {pregnancy.isActive ? 'Active' : 'Closed'}
            </span>
            <div className="text-sm text-gray-500 mt-2">
              Total Contacts: <span className="font-bold text-gray-900">{visits.length}</span> / 8+ (WHO)
            </div>
            {pregnancy.isActive && nextContact && (
              <div className="text-sm text-primary-700 font-medium mt-1">
                Next contact due: {nextContact.date.toLocaleDateString()} (~{nextContact.week} wks)
              </div>
            )}
          </div>
        </div>
        
        {/* Risk Profile & History Badges */}
        <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Obstetric History</h4>
            <div className="text-sm text-gray-600 grid grid-cols-2 gap-y-1">
              <span>Living Children: <b>{pregnancy.livingChildren || 0}</b></span>
              <span>Miscarriages/Abortions: <b>{pregnancy.abortionsMiscarriages || 0}</b></span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {pregnancy.historyOfCSection && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-md border border-red-200">Previous C-Section</span>}
              {pregnancy.historyOfPPH && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-md border border-red-200">History of PPH</span>}
              {pregnancy.historyOfPreEclampsia && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-md border border-red-200">Pre-Eclampsia</span>}
              {pregnancy.historyOfStillbirth && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-md border border-red-200">Stillbirth</span>}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Medical Risk Profile</h4>
            <div className="flex flex-wrap gap-2">
              {pregnancy.preExistingDiabetes && <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-md border border-orange-200">Diabetes</span>}
              {pregnancy.preExistingHypertension && <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-md border border-orange-200">Hypertension</span>}
              {pregnancy.cardiacDisease && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-md border border-red-200">Cardiac Disease</span>}
              {pregnancy.multipleGestation && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-md border border-yellow-200">Multiple Gestation</span>}
              {!pregnancy.preExistingDiabetes && !pregnancy.preExistingHypertension && !pregnancy.cardiacDisease && !pregnancy.multipleGestation && (
                 <span className="text-sm text-green-600 font-medium">Standard Risk</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-primary-600" /> Visit History
        </h3>
        
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading visit history...</div>
        ) : visits.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 border-2 border-dashed rounded-lg text-gray-500">
            No ANC visits recorded yet. Click "Record ANC Visit" to start tracking.
          </div>
        ) : (
          <div className="space-y-4">
            {visits.map((visit, index) => (
              <div key={visit.id} className="bg-white rounded-lg border p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-gray-900">Visit #{visits.length - index}</h4>
                    <span className="text-xs text-gray-500">{new Date(visit.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    {visit.recordedBy && (
                      <div className="text-xs text-gray-500 text-right">
                        Recorded by:<br/>
                        <span className="font-medium text-gray-700">{visit.recordedBy.firstName} {visit.recordedBy.lastName}</span>
                      </div>
                    )}
                    {patient && (
                      <button
                        onClick={() => setPrescribeForVisitId(visit.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs flex items-center gap-1.5"
                      >
                        <Pill className="w-3.5 h-3.5" /> Prescribe
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-4">
                  <div className="space-y-2">
                    <h5 className="font-semibold text-gray-700 border-b pb-1 flex items-center"><Activity className="w-4 h-4 mr-1"/> Vitals</h5>
                    <div><span className="text-gray-500">Gestational Age:</span> {visit.gestationalAgeWeeks ? `${visit.gestationalAgeWeeks} wks` : '-'}</div>
                    <div><span className="text-gray-500">BP:</span> {visit.systolicBP && visit.diastolicBP ? `${visit.systolicBP}/${visit.diastolicBP}` : '-'}</div>
                    <div><span className="text-gray-500">Weight:</span> {visit.weight ? `${visit.weight}kg` : '-'}</div>
                    <div><span className="text-gray-500">Fundal Height:</span> {visit.fundalHeight ? `${visit.fundalHeight}cm` : '-'}</div>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="font-semibold text-gray-700 border-b pb-1 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> Screenings</h5>
                    <div><span className="text-gray-500">Urine Protein:</span> {visit.urineProtein || '-'}</div>
                    <div><span className="text-gray-500">HIV:</span> {visit.hivTestResult || '-'}</div>
                    <div><span className="text-gray-500">Syphilis:</span> {visit.syphilisTestResult || '-'}</div>
                    <div><span className="text-gray-500">Malaria:</span> {visit.malariaRdtResult || '-'}</div>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="font-semibold text-gray-700 border-b pb-1 flex items-center"><FileText className="w-4 h-4 mr-1"/> Interventions</h5>
                    <div><span className="text-gray-500">Iron/Folic:</span> {visit.ironFolicAcidProvided ? 'Yes' : 'No'}</div>
                    <div><span className="text-gray-500">IPTp Dose:</span> {visit.iptpDose || 'None'}</div>
                    <div><span className="text-gray-500">TT Doses:</span> {visit.ttDoseGivenToday ? `Given Today (Total: ${visit.ttDosesToDate})` : (visit.ttDosesToDate ? `Total: ${visit.ttDosesToDate}` : 'None')}</div>
                    <div><span className="text-gray-500">Ultrasound:</span> {visit.ultrasoundDone ? 'Done' : 'No'}</div>
                    <div><span className="text-gray-500">Counseling:</span> {visit.counselingDone ? 'Done' : 'No'}</div>
                  </div>
                </div>
                
                {visit.notes && (
                  <div className="mt-4 pt-3 border-t text-sm">
                    <span className="font-medium text-gray-700">Clinical Notes:</span>
                    <p className="text-gray-600 mt-1">{visit.notes}</p>
                  </div>
                )}
                {visit.others && (
                  <div className="mt-2 text-sm">
                    <span className="font-medium text-gray-700">Others:</span>
                    <p className="text-gray-600 mt-1">{visit.others}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {pregnancy.deliveryDate && (
        <div className="space-y-4 mt-8">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Baby className="w-5 h-5 mr-2 text-primary-600" /> Postnatal Visits
            </h3>
            <button onClick={() => setShowPostnatalModal(true)} className="btn btn-secondary flex items-center">
              <Plus className="w-4 h-4 mr-2" /> Record Postnatal Visit
            </button>
          </div>

          {loadingPostnatal ? (
            <div className="text-center py-8 text-gray-500">Loading postnatal visits...</div>
          ) : postnatalVisits.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 border-2 border-dashed rounded-lg text-gray-500">
              No postnatal visits recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {postnatalVisits.map((visit) => (
                <div key={visit.id} className="bg-white rounded-lg border p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-900">{PNC_CONTACT_LABELS[visit.contactType] || visit.contactType}</h4>
                    <span className="text-xs text-gray-500">{new Date(visit.visitDate).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div><span className="text-gray-500">Maternal BP:</span> {visit.maternalSystolicBP && visit.maternalDiastolicBP ? `${visit.maternalSystolicBP}/${visit.maternalDiastolicBP}` : '-'}</div>
                      <div><span className="text-gray-500">Lochia:</span> {visit.lochiaStatus || '-'}</div>
                      <div><span className="text-gray-500">Breastfeeding:</span> {visit.breastfeedingStatus || '-'}</div>
                    </div>
                    <div className="space-y-1">
                      <div><span className="text-gray-500">Newborn Weight:</span> {visit.newbornWeightGrams != null ? `${visit.newbornWeightGrams}g` : '-'}</div>
                      <div><span className="text-gray-500">Feeding Well:</span> {visit.newbornFeedingWell == null ? '-' : (visit.newbornFeedingWell ? 'Yes' : 'No')}</div>
                      <div><span className="text-gray-500">Jaundice:</span> {visit.jaundiceObserved ? 'Observed' : 'No'}</div>
                    </div>
                  </div>
                  {visit.newbornDangerSigns.length > 0 && (
                    <p className="mt-2 text-sm text-red-700">Danger signs: {visit.newbornDangerSigns.join(', ')}</p>
                  )}
                  {visit.notes && <p className="mt-2 text-sm text-gray-600">{visit.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showRecordModal && (
        <RecordAncVisitModal
          patientId={pregnancy.patientId}
          pregnancyId={pregnancy.id}
          onClose={() => setShowRecordModal(false)}
          onSuccess={handleVisitRecorded}
        />
      )}

      {showPostnatalModal && (
        <RecordPostnatalVisitModal
          patientId={pregnancy.patientId}
          pregnancyId={pregnancy.id}
          pregnancyOutcome={pregnancy.outcome}
          onClose={() => setShowPostnatalModal(false)}
          onSuccess={(visit) => {
            setPostnatalVisits([visit, ...postnatalVisits]);
            setShowPostnatalModal(false);
          }}
        />
      )}

      {prescribeForVisitId && patient && (
        <PrescriptionModal
          context={{ type: 'ancVisit', ancVisitId: prescribeForVisitId }}
          patient={patient}
          onClose={() => setPrescribeForVisitId(null)}
          onSuccess={() => setPrescribeForVisitId(null)}
        />
      )}
    </div>
  );
};

export default PregnancyDetailsView;
