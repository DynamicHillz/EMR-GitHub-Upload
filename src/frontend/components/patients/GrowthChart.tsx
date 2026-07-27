import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export interface GrowthDataPoint {
  date: string;
  weight: number | null;
  height: number | null;
  headCircumference: number | null;
  muac: number | null;
}

interface GrowthChartProps {
  data: GrowthDataPoint[];
}

const GrowthChart: React.FC<GrowthChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No growth data available yet.</p>
      </div>
    );
  }

  // Sort data chronologically
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Format dates for display
  const chartData = sortedData.map(d => ({
    ...d,
    displayDate: new Date(d.date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }));

  // Filter out records that have no anthropometric data
  const hasAnthropometricData = chartData.some(d => d.weight || d.height || d.headCircumference || d.muac);
  if (!hasAnthropometricData) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No anthropometric data recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-lg text-gray-800 mb-4">Patient Growth Trends (WHO Indicators)</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Weight & Height Chart */}
        <div className="h-72">
          <h4 className="text-sm font-medium text-gray-600 mb-2 text-center">Weight (kg) & Height (cm)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="displayDate" tick={{fontSize: 12}} />
              <YAxis yAxisId="left" tick={{fontSize: 12}} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12}} />
              <Tooltip />
              <Legend wrapperStyle={{fontSize: '12px'}} />
              <Line yAxisId="left" type="monotone" dataKey="weight" name="Weight (kg)" stroke="#3b82f6" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 0 }} isAnimationActive={false} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="height" name="Height (cm)" stroke="#10b981" dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#10b981', strokeWidth: 0 }} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Head Circumference & MUAC Chart */}
        <div className="h-72">
          <h4 className="text-sm font-medium text-gray-600 mb-2 text-center">Head Circumference & MUAC (cm)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="displayDate" tick={{fontSize: 12}} />
              <YAxis tick={{fontSize: 12}} />
              <Tooltip />
              <Legend wrapperStyle={{fontSize: '12px'}} />
              <Line type="monotone" dataKey="headCircumference" name="Head Circ (cm)" stroke="#8b5cf6" dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#8b5cf6', strokeWidth: 0 }} isAnimationActive={false} connectNulls />
              <Line type="monotone" dataKey="muac" name="MUAC (cm)" stroke="#f59e0b" dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#f59e0b', strokeWidth: 0 }} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default GrowthChart;
