import React from 'react';

const EmptyChartState: React.FC = () => (
  <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
    <p className="text-gray-500">No data available for the selected date range.</p>
  </div>
);

export default EmptyChartState;
