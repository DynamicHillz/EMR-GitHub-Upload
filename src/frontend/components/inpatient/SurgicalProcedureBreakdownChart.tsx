import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Scissors, ListOrdered } from 'lucide-react';
import InpatientService from '../../services/InpatientService';
import StatCard from '../reports/StatCard';
import EmptyChartState from '../reports/EmptyChartState';

interface Props {
  from: string;
  to: string;
}

interface Breakdown {
  topProcedures: { name: string; count: number }[];
  summary: { totalOperationsRecorded: number; startDate: string | null; endDate: string | null };
}

const SurgicalProcedureBreakdownChart: React.FC<Props> = ({ from, to }) => {
  const [report, setReport] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    InpatientService.getSurgicalProcedureBreakdown({ from: from || undefined, to: to || undefined, limit: 10 })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err) => console.error('Failed to load surgical procedure breakdown:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading surgical procedure analytics...</div>;
  }

  const chartData = (report?.topProcedures || [])
    .map((p) => ({ name: p.name, count: p.count }))
    .reverse(); // recharts vertical bar renders top-to-bottom in array order — reverse so #1 is at the top

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard label="Total Operations Recorded" value={report?.summary.totalOperationsRecorded ?? 0} icon={Scissors} color="blue" />
        <StatCard label="Distinct Procedures (Top 10 shown)" value={report?.topProcedures.length ?? 0} icon={ListOrdered} color="purple" />
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
                <Bar dataKey="count" name="Operations" fill="#3b82f6" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurgicalProcedureBreakdownChart;
