import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Stethoscope, ClipboardList } from 'lucide-react';
import reportsService from '../../services/reports.service';
import { DiagnosisTrendsReport, ReportPeriod } from '../../types/reports.types';
import StatCard from './StatCard';
import EmptyChartState from './EmptyChartState';

interface Props {
  startDate: string;
  endDate: string;
  period: ReportPeriod;
}

const DiagnosisTrendsTab: React.FC<Props> = ({ startDate, endDate }) => {
  const [report, setReport] = useState<DiagnosisTrendsReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportsService
      .getDiagnosisTrends({ startDate, endDate, limit: 10 })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err) => console.error('Failed to load diagnosis trends report:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading diagnosis trends report...</div>;
  }

  const chartData = (report?.topDiagnoses || [])
    .map((d) => ({ name: `${d.name} (${d.code})`, count: d.count }))
    .reverse(); // recharts vertical bar renders top-to-bottom in array order — reverse so #1 is at the top

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard label="Total Diagnoses Recorded" value={report?.summary.totalDiagnosesRecorded ?? 0} icon={ClipboardList} color="blue" />
        <StatCard label="Distinct Diagnoses (Top 10 shown)" value={report?.topDiagnoses.length ?? 0} icon={Stethoscope} color="purple" />
      </div>

      {chartData.length === 0 ? (
        <EmptyChartState />
      ) : (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div style={{ height: Math.max(chartData.length * 40, 200) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="count" name="Diagnoses" fill="#3b82f6" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosisTrendsTab;
