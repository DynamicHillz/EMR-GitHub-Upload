import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ReportPeriod } from '../types/reports.types';
import PatientVolumeTab from '../components/reports/PatientVolumeTab';
import RevenueTab from '../components/reports/RevenueTab';
import DiagnosisTrendsTab from '../components/reports/DiagnosisTrendsTab';
import StockTurnoverTab from '../components/reports/StockTurnoverTab';
import NoShowRateTab from '../components/reports/NoShowRateTab';
import NhmisMonthlyReturnTab from '../components/reports/NhmisMonthlyReturnTab';
import Dropdown from '../components/common/Dropdown';

type ReportTab = 'volume' | 'revenue' | 'diagnoses' | 'stock' | 'noshows' | 'nhmis';

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'volume', label: 'Patient Volume' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'diagnoses', label: 'Diagnoses' },
  { id: 'stock', label: 'Stock Turnover' },
  { id: 'noshows', label: 'No-Shows' },
  { id: 'nhmis', label: 'NHMIS Return' },
];

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('volume');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateInputValue(d);
  });
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [period, setPeriod] = useState<ReportPeriod>('day');

  const isRankingTab = activeTab === 'diagnoses' || activeTab === 'stock';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary-600" />
          Reports & Analytics
        </h1>
        <p className="text-gray-600 mt-1">Patient volume, revenue, diagnosis trends, stock turnover, and no-show rate</p>
      </div>

      {activeTab !== 'nhmis' && (
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={toDateInputValue(new Date())}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className={`block text-sm font-medium mb-1 ${isRankingTab ? 'text-gray-400' : 'text-gray-700'}`}>
            Group By
          </label>
          <Dropdown
            value={period}
            disabled={isRankingTab}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            className="input disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </Dropdown>
        </div>
        {isRankingTab && (
          <p className="text-xs text-gray-400 pb-2">Grouping doesn't apply to ranked reports — this tab shows totals for the selected range.</p>
        )}
      </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'volume' && <PatientVolumeTab startDate={startDate} endDate={endDate} period={period} />}
      {activeTab === 'revenue' && <RevenueTab startDate={startDate} endDate={endDate} period={period} />}
      {activeTab === 'diagnoses' && <DiagnosisTrendsTab startDate={startDate} endDate={endDate} period={period} />}
      {activeTab === 'stock' && <StockTurnoverTab startDate={startDate} endDate={endDate} period={period} />}
      {activeTab === 'noshows' && <NoShowRateTab startDate={startDate} endDate={endDate} period={period} />}
      {activeTab === 'nhmis' && <NhmisMonthlyReturnTab />}
    </div>
  );
};

export default ReportsPage;
