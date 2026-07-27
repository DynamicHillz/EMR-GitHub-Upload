import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CalendarCheck } from 'lucide-react';
import reportsService from '../../services/reports.service';
import { NoShowReport, ReportPeriod } from '../../types/reports.types';
import StatCard from './StatCard';
import EmptyChartState from './EmptyChartState';

interface Props {
  startDate: string;
  endDate: string;
  period: ReportPeriod;
}

const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

const NoShowRateTab: React.FC<Props> = ({ startDate, endDate, period }) => {
  const [report, setReport] = useState<NoShowReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportsService
      .getNoShowRate({ startDate, endDate, period })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err) => console.error('Failed to load no-show report:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate, period]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading no-show report...</div>;
  }

  const chartData = (report?.series || []).map((s) => ({
    ...s,
    displayDate: s.label,
    noShowRatePercent: Number((s.noShowRate * 100).toFixed(1)),
  }));
  const hasData = chartData.some((d) => d.resolvedCount > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Overall No-Show Rate" value={formatPercent(report?.summary.overallNoShowRate ?? 0)} icon={AlertTriangle} color="red" />
        <StatCard label="Total No-Shows" value={report?.summary.totalNoShows ?? 0} icon={AlertTriangle} color="orange" />
        <StatCard label="Total Resolved Appointments" value={report?.summary.totalResolved ?? 0} icon={CalendarCheck} color="blue" />
      </div>

      {!hasData ? (
        <EmptyChartState />
      ) : (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} unit="%" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line yAxisId="left" type="monotone" dataKey="noShowRatePercent" name="No-Show Rate (%)" stroke="#ef4444" dot={{ r: 3 }} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="resolvedCount" name="Resolved Appointments" stroke="#3b82f6" dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoShowRateTab;
