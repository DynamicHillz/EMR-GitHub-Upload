import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PartographObservation } from '../../../types/labor';
import { getAlertActionLineValues } from '../../../utils/partographAlertLine';

// The observation being actively typed into ObservationEntryModal, not yet
// saved — carried through so its point renders distinctly (amber, larger)
// instead of looking like a confirmed reading.
type DraftablePartographObservation = PartographObservation & { isDraft?: boolean };

interface DilationChartProps {
  observations: DraftablePartographObservation[];
  activePhaseOnsetAt?: string;
}

const DilationDot: React.FC<any> = ({ cx, cy, payload }) => {
  if (cx == null || cy == null) return null;
  return payload.isDraft
    ? <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
    : <circle cx={cx} cy={cy} r={4} fill="#3b82f6" />;
};

const DilationChart: React.FC<DilationChartProps> = ({ observations, activePhaseOnsetAt }) => {
  const withDilation = observations.filter((o) => o.cervicalDilation != null);

  if (withDilation.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No dilation readings recorded yet.</p>
      </div>
    );
  }

  const onsetDate = activePhaseOnsetAt ? new Date(activePhaseOnsetAt) : null;

  const sorted = [...withDilation].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  const chartData = sorted.map((o) => {
    const recordedAt = new Date(o.recordedAt);
    const { alertLine, actionLine } = getAlertActionLineValues(onsetDate, recordedAt);
    return {
      displayDate: o.isDraft ? 'Now (unsaved)' : recordedAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      cervicalDilation: o.cervicalDilation,
      alertLine: onsetDate ? alertLine : undefined,
      actionLine: onsetDate ? actionLine : undefined,
      isDraft: o.isDraft,
    };
  });

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-lg text-gray-800 mb-1">Cervical Dilation</h3>
      {!onsetDate && (
        <p className="text-xs text-gray-500 mb-3">
          Alert/action lines appear once active labour (≥4cm dilation) is recorded.
        </p>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="cervicalDilation" name="Dilation (cm)" stroke="#3b82f6" dot={<DilationDot />} isAnimationActive={false} />
            {onsetDate && (
              <>
                <Line type="monotone" dataKey="alertLine" name="Alert Line" stroke="#f59e0b" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="actionLine" name="Action Line" stroke="#ef4444" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DilationChart;
