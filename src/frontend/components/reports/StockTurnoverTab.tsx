import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Package, PackageCheck } from 'lucide-react';
import reportsService from '../../services/reports.service';
import { StockTurnoverReport, ReportPeriod } from '../../types/reports.types';
import StatCard from './StatCard';
import EmptyChartState from './EmptyChartState';

interface Props {
  startDate: string;
  endDate: string;
  period: ReportPeriod;
}

const StockTurnoverTab: React.FC<Props> = ({ startDate, endDate }) => {
  const [report, setReport] = useState<StockTurnoverReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportsService
      .getStockTurnover({ startDate, endDate, limit: 10 })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err) => console.error('Failed to load stock turnover report:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading stock turnover report...</div>;
  }

  const chartData = (report?.medications || [])
    .map((m) => ({ name: m.name, quantityDispensed: m.quantityDispensed, currentStock: m.currentStock }))
    .reverse();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard label="Total Units Dispensed" value={report?.summary.totalDispensed ?? 0} icon={PackageCheck} color="blue" />
        <StatCard label="Medications Tracked" value={report?.summary.totalMedicationsTracked ?? 0} icon={Package} color="purple" />
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
                <Bar dataKey="quantityDispensed" name="Dispensed" fill="#3b82f6" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                <Bar dataKey="currentStock" name="Current Stock" fill="#10b981" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {report && report.medications.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medication</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Dispensed</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Turnover Ratio</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {report.medications.map((m) => (
                <tr key={m.medicationId} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{m.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{m.category || '—'}</td>
                  <td className="px-6 py-3 text-sm text-right text-gray-900">{m.quantityDispensed}</td>
                  <td className="px-6 py-3 text-sm text-right text-gray-900">{m.currentStock}</td>
                  <td className="px-6 py-3 text-sm text-right text-gray-900">
                    {m.turnoverRatio != null ? m.turnoverRatio.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockTurnoverTab;
