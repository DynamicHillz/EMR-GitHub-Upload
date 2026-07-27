import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Receipt, TrendingUp } from 'lucide-react';
import reportsService from '../../services/reports.service';
import { RevenueReport, ReportPeriod } from '../../types/reports.types';
import StatCard from './StatCard';
import EmptyChartState from './EmptyChartState';

interface Props {
  startDate: string;
  endDate: string;
  period: ReportPeriod;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);

const RevenueTab: React.FC<Props> = ({ startDate, endDate, period }) => {
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportsService
      .getRevenue({ startDate, endDate, period })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err) => console.error('Failed to load revenue report:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate, period]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading revenue report...</div>;
  }

  const chartData = (report?.series || []).map((s) => ({ ...s, displayDate: s.label }));
  const hasData = chartData.some((d) => d.revenue > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Revenue" value={formatCurrency(report?.summary.totalRevenue ?? 0)} icon={Receipt} color="green" />
        <StatCard label="Total Payments" value={report?.summary.totalPayments ?? 0} icon={TrendingUp} color="blue" />
        <StatCard label="Average per Period" value={formatCurrency(report?.summary.averagePerBucket ?? 0)} icon={TrendingUp} color="purple" />
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
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="revenue" name="Revenue (₦)" stroke="#10b981" dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueTab;
