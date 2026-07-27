import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, UserPlus } from 'lucide-react';
import reportsService from '../../services/reports.service';
import { PatientVolumeReport, ReportPeriod } from '../../types/reports.types';
import StatCard from './StatCard';
import EmptyChartState from './EmptyChartState';

interface Props {
  startDate: string;
  endDate: string;
  period: ReportPeriod;
}

const PatientVolumeTab: React.FC<Props> = ({ startDate, endDate, period }) => {
  const [report, setReport] = useState<PatientVolumeReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportsService
      .getPatientVolume({ startDate, endDate, period })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err) => console.error('Failed to load patient volume report:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate, period]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading patient volume report...</div>;
  }

  const chartData = (report?.series || []).map((s) => ({ ...s, displayDate: s.label }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="New Registrations" value={report?.summary.totalNewRegistrations ?? 0} icon={UserPlus} color="blue" />
        <StatCard label="Total Active Patients" value={report?.summary.totalActivePatients ?? 0} icon={Users} color="green" />
        <StatCard label="Average per Period" value={(report?.summary.averagePerBucket ?? 0).toFixed(1)} icon={Users} color="purple" />
      </div>

      {chartData.length === 0 || chartData.every((d) => d.newRegistrations === 0) ? (
        <EmptyChartState />
      ) : (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="newRegistrations" name="New Registrations" stroke="#3b82f6" dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientVolumeTab;
