import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { PartographObservation } from '../../../types/labor';
import { crossesActionLine } from '../../../utils/partographAlertLine';
import { isAbnormalFHR } from './FetalHeartRateChart';

interface ObservationsTableProps {
  observations: PartographObservation[];
  activePhaseOnsetAt?: string;
}

const isAbnormalBP = (systolic?: number, diastolic?: number) =>
  (systolic != null && systolic >= 140) || (diastolic != null && diastolic >= 90);

const ObservationsTable: React.FC<ObservationsTableProps> = ({ observations, activePhaseOnsetAt }) => {
  if (observations.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No observations recorded yet.</p>
      </div>
    );
  }

  const onsetDate = activePhaseOnsetAt ? new Date(activePhaseOnsetAt) : null;
  const sorted = [...observations].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descent</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Liquor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moulding</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contractions</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pulse</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BP</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Temp</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urine</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Drugs / IV</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recorded By</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flags</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sorted.map((o) => {
              const abnormalFHR = isAbnormalFHR(o.fetalHeartRate);
              const abnormalBP = isAbnormalBP(o.maternalSystolicBP, o.maternalDiastolicBP);
              const actionCrossed = crossesActionLine(onsetDate, new Date(o.recordedAt), o.cervicalDilation);
              const flagged = abnormalFHR || abnormalBP || actionCrossed;

              return (
                <tr key={o.id} className={flagged ? 'bg-red-50' : undefined}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {new Date(o.recordedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{o.descentOfHead || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{o.liquor || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{o.moulding || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {o.contractionsFrequencyPer10Min != null ? `${o.contractionsFrequencyPer10Min}/10min` : '—'}
                    {o.contractionsDurationSeconds != null ? `, ${o.contractionsDurationSeconds}s` : ''}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{o.maternalPulse ?? '—'}</td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm ${abnormalBP ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                    {o.maternalSystolicBP != null && o.maternalDiastolicBP != null ? `${o.maternalSystolicBP}/${o.maternalDiastolicBP}` : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{o.maternalTemperature ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {o.urineProtein || o.urineAcetone
                      ? `P:${o.urineProtein || '—'} A:${o.urineAcetone || '—'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {[o.oxytocinDose, o.drugsGiven, o.ivFluids].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {o.recordedBy ? `${o.recordedBy.firstName} ${o.recordedBy.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {flagged ? (
                      <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {[actionCrossed && 'Action line', abnormalFHR && 'FHR', abnormalBP && 'BP'].filter(Boolean).join(', ')}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ObservationsTable;
