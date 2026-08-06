import React, { useEffect, useState } from 'react';
import { Plus, Heart, Baby, LogOut } from 'lucide-react';
import laborService from '../../../services/labor.service';
import { LaborRecord } from '../../../types/labor';
import StartLaborModal from './StartLaborModal';
import ObservationEntryModal from './ObservationEntryModal';
import DeliveryOutcomeModal from './DeliveryOutcomeModal';
import DiscontinueLaborModal from './DiscontinueLaborModal';
import DilationChart from './DilationChart';
import FetalHeartRateChart from './FetalHeartRateChart';
import ObservationsTable from './ObservationsTable';

interface PartographTabProps {
  admissionId: string;
  isReadonly?: boolean;
}

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '—');

const PartographTab: React.FC<PartographTabProps> = ({ admissionId, isReadonly }) => {
  const [laborRecord, setLaborRecord] = useState<LaborRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showDiscontinueModal, setShowDiscontinueModal] = useState(false);

  const loadLaborRecord = async () => {
    try {
      setLoading(true);
      const record = await laborService.getLaborRecordByAdmission(admissionId);
      setLaborRecord(record);
    } catch (err) {
      console.error('Failed to load labor record:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLaborRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading partograph...</div>;
  }

  if (!laborRecord) {
    return (
      <div className="text-center py-12 bg-gray-50 border-2 border-dashed rounded-lg">
        <Heart className="w-10 h-10 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 mb-4">No labor tracking started for this admission.</p>
        {!isReadonly && (
          <button onClick={() => setShowStartModal(true)} className="btn btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Start Labor Tracking
          </button>
        )}
        {showStartModal && (
          <StartLaborModal
            admissionId={admissionId}
            onClose={() => setShowStartModal(false)}
            onSuccess={(record) => {
              setShowStartModal(false);
              setLaborRecord(record);
            }}
          />
        )}
      </div>
    );
  }

  const canManage = !isReadonly && laborRecord.status === 'IN_LABOR';
  const observations = laborRecord.observations || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-5 flex flex-wrap justify-between items-start gap-4">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
              laborRecord.status === 'IN_LABOR' ? 'bg-amber-100 text-amber-800' :
              laborRecord.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {laborRecord.status.replace('_', ' ')}
            </span>
            {laborRecord.pregnancy && <span className="text-xs text-gray-500">Antenatal record linked</span>}
          </div>
          <div className="text-gray-700">Labor onset: <span className="font-medium">{formatDateTime(laborRecord.laborOnsetAt)}</span></div>
          <div className="text-gray-700">
            Active phase: <span className="font-medium">{laborRecord.activePhaseOnsetAt ? formatDateTime(laborRecord.activePhaseOnsetAt) : 'Not yet in active phase'}</span>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-3">
            <button onClick={() => setShowObservationModal(true)} className="btn btn-secondary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Record Observation
            </button>
            <button onClick={() => setShowDeliveryModal(true)} className="btn btn-primary flex items-center gap-2">
              <Baby className="w-4 h-4" /> Record Delivery Outcome
            </button>
            <button onClick={() => setShowDiscontinueModal(true)} className="btn btn-secondary flex items-center gap-2 text-amber-700">
              <LogOut className="w-4 h-4" /> Mark Transferred/Discontinued
            </button>
          </div>
        )}
      </div>

      {(laborRecord.status === 'TRANSFERRED' || laborRecord.status === 'DISCONTINUED') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="font-semibold text-amber-900 mb-1 flex items-center gap-2">
            <LogOut className="w-5 h-5" /> Labor {laborRecord.status === 'TRANSFERRED' ? 'Transferred' : 'Discontinued'}
          </h3>
          {laborRecord.deliveryNotes && <p className="text-sm text-amber-800 mt-2">{laborRecord.deliveryNotes}</p>}
        </div>
      )}

      {laborRecord.status === 'DELIVERED' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2"><Baby className="w-5 h-5" /> Delivery Outcome</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-green-900">
            <div>Delivered: <span className="font-medium">{formatDateTime(laborRecord.deliveredAt)}</span></div>
            <div>Mode: <span className="font-medium">{laborRecord.modeOfDelivery || '—'}</span></div>
            <div>Outcome: <span className="font-medium">{laborRecord.babyOutcome || '—'}</span></div>
            <div>Sex: <span className="font-medium">{laborRecord.babySex || '—'}</span></div>
            <div>Birth Weight: <span className="font-medium">{laborRecord.babyBirthWeightGrams != null ? `${laborRecord.babyBirthWeightGrams}g` : '—'}</span></div>
            <div>Apgar: <span className="font-medium">{laborRecord.apgarScore1Min ?? '—'} / {laborRecord.apgarScore5Min ?? '—'}</span></div>
            <div>Perineum: <span className="font-medium">{laborRecord.perineumStatus || '—'}</span></div>
            <div>Est. Blood Loss: <span className="font-medium">{laborRecord.estimatedBloodLossMl != null ? `${laborRecord.estimatedBloodLossMl}ml` : '—'}</span></div>
          </div>
          {laborRecord.deliveryNotes && <p className="text-sm text-green-800 mt-3">{laborRecord.deliveryNotes}</p>}
        </div>
      )}

      <DilationChart observations={observations} activePhaseOnsetAt={laborRecord.activePhaseOnsetAt} />
      <FetalHeartRateChart observations={observations} />
      <ObservationsTable observations={observations} activePhaseOnsetAt={laborRecord.activePhaseOnsetAt} />

      {showObservationModal && (
        <ObservationEntryModal
          laborRecordId={laborRecord.id}
          observations={observations}
          activePhaseOnsetAt={laborRecord.activePhaseOnsetAt}
          onClose={() => setShowObservationModal(false)}
          onSuccess={() => {
            setShowObservationModal(false);
            loadLaborRecord();
          }}
        />
      )}

      {showDeliveryModal && (
        <DeliveryOutcomeModal
          laborRecordId={laborRecord.id}
          admissionId={admissionId}
          onClose={() => setShowDeliveryModal(false)}
          onSuccess={() => {
            setShowDeliveryModal(false);
            loadLaborRecord();
          }}
        />
      )}

      {showDiscontinueModal && (
        <DiscontinueLaborModal
          laborRecordId={laborRecord.id}
          onClose={() => setShowDiscontinueModal(false)}
          onSuccess={() => {
            setShowDiscontinueModal(false);
            loadLaborRecord();
          }}
        />
      )}
    </div>
  );
};

export default PartographTab;
