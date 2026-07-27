import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { PartographObservation } from '../../../types/labor';

// The observation being actively typed into ObservationEntryModal, not yet
// saved — carried through so its point renders distinctly (amber, larger)
// instead of looking like a confirmed reading.
type DraftablePartographObservation = PartographObservation & { isDraft?: boolean };

interface FetalHeartRateChartProps {
  observations: DraftablePartographObservation[];
}

export const isAbnormalFHR = (fhr?: number) => fhr != null && (fhr < 110 || fhr > 160);

const FhrDot: React.FC<any> = ({ cx, cy, payload }) => {
  if (cx == null || cy == null) return null;
  if (payload.isDraft) return <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />;
  return <circle cx={cx} cy={cy} r={4} fill={payload.abnormal ? '#dc2626' : '#8b5cf6'} />;
};

const FetalHeartRateChart: React.FC<FetalHeartRateChartProps> = ({ observations }) => {
  const withFhr = observations.filter((o) => o.fetalHeartRate != null);

  if (withFhr.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No fetal heart rate readings recorded yet.</p>
      </div>
    );
  }

  const sorted = [...withFhr].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  const chartData = sorted.map((o) => ({
    displayDate: o.isDraft ? 'Now (unsaved)' : new Date(o.recordedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    fetalHeartRate: o.fetalHeartRate,
    abnormal: isAbnormalFHR(o.fetalHeartRate),
    isDraft: o.isDraft,
  }));

  const anyAbnormal = chartData.some((d) => d.abnormal);

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-lg text-gray-800 mb-1 flex items-center gap-2">
        Fetal Heart Rate
        {anyAbnormal && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
            <AlertTriangle className="w-3.5 h-3.5" /> Abnormal reading(s) — normal range 110-160bpm
          </span>
        )}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
            <YAxis domain={[80, 180]} tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="fetalHeartRate" name="FHR (bpm)" stroke="#8b5cf6" dot={<FhrDot />} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default FetalHeartRateChart;
