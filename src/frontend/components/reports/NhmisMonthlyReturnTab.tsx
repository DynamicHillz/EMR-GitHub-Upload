import React, { useEffect, useState } from 'react';
import { Users, Stethoscope, Printer } from 'lucide-react';
import reportsService from '../../services/reports.service';
import { NhmisMonthlyReturnReport } from '../../types/reports.types';
import Dropdown from '../common/Dropdown';
import StatCard from './StatCard';

const NhmisMonthlyReturnTab: React.FC = () => {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [report, setReport] = useState<NhmisMonthlyReturnReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportsService
      .getNhmisMonthlyReturn({ month, year })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err) => console.error('Failed to load NHMIS monthly return:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, year]);

  const handlePrint = () => {
    window.open(`/reports/nhmis-monthly-return?month=${month}&year=${year}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <Dropdown
            className="w-40 input"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </Dropdown>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <input
            type="number"
            className="w-24 input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Print / Export Return
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading NHMIS monthly return...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard label="Total OPD Attendance" value={report?.attendance.grandTotal ?? 0} icon={Users} color="blue" />
            <StatCard label="New Attendance" value={report?.attendance.totalNew ?? 0} icon={Users} color="green" />
            <StatCard label="Repeat Attendance" value={report?.attendance.totalRepeat ?? 0} icon={Users} color="purple" />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700">Top Conditions This Month</h3>
            </div>
            {(report?.topConditions.length ?? 0) === 0 ? (
              <p className="p-6 text-sm text-gray-500">No diagnoses recorded for this period.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report!.topConditions.map((c) => (
                    <tr key={c.diagnosisId}>
                      <td className="px-4 py-2 text-sm font-mono text-gray-700">{c.code}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{c.name}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="text-xs text-gray-400">
            This is a preview — use "Print / Export Return" for the full NHMIS-formatted form, including the age-group
            breakdown and the referrals section (still filled in by hand — this EMR doesn't capture referrals yet).
          </p>
        </>
      )}
    </div>
  );
};

export default NhmisMonthlyReturnTab;
