import React, { useState, useEffect } from 'react';
import { Activity, Droplets, Droplet, TestTube, Pill } from 'lucide-react';
import InpatientService from '../../services/InpatientService';
import VitalChartTab from './charts/VitalChartTab';
import FluidChartTab from './charts/FluidChartTab';
import TransfusionChartTab from './charts/TransfusionChartTab';
import BloodSugarChartTab from './charts/BloodSugarChartTab';
import MedicationChartTab from './charts/MedicationChartTab';

type ChartTab = 'vitals' | 'fluids' | 'transfusion' | 'bloodsugar' | 'medication';

interface InpatientChartsProps {
  admissionId: string;
  isReadonly?: boolean;
  initialTab?: ChartTab;
}

const InpatientCharts: React.FC<InpatientChartsProps> = ({ admissionId, isReadonly = false, initialTab }) => {
  const [activeTab, setActiveTab] = useState<ChartTab>(initialTab || 'vitals');
  const [chartsData, setChartsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadCharts = async () => {
    try {
      setLoading(true);
      const data = await InpatientService.getCharts(admissionId);
      setChartsData(data);
    } catch (error) {
      console.error('Failed to load charts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharts();
  }, [admissionId]);

  if (loading) {
    return <div className="p-4 text-center">Loading charts...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px px-4 overflow-x-auto" aria-label="Tabs">
          <button onClick={() => setActiveTab('vitals')} className={`${activeTab === 'vitals' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center flex items-center justify-center`}>
            <Activity className="w-4 h-4 mr-2" /> Vitals
          </button>
          <button onClick={() => setActiveTab('fluids')} className={`${activeTab === 'fluids' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center flex items-center justify-center`}>
            <Droplet className="w-4 h-4 mr-2" /> Fluids (I/O)
          </button>
          <button onClick={() => setActiveTab('bloodsugar')} className={`${activeTab === 'bloodsugar' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center flex items-center justify-center`}>
            <TestTube className="w-4 h-4 mr-2" /> Blood Sugar
          </button>
          <button onClick={() => setActiveTab('transfusion')} className={`${activeTab === 'transfusion' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center flex items-center justify-center`}>
            <Droplets className="w-4 h-4 mr-2" /> Transfusion
          </button>
          <button onClick={() => setActiveTab('medication')} className={`${activeTab === 'medication' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center flex items-center justify-center`}>
            <Pill className="w-4 h-4 mr-2" /> Medication
          </button>
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'vitals' && <VitalChartTab data={chartsData?.vitals || []} admissionId={admissionId} onReload={loadCharts} isReadonly={isReadonly} />}
        {activeTab === 'fluids' && <FluidChartTab data={chartsData?.fluids || []} admissionId={admissionId} onReload={loadCharts} isReadonly={isReadonly} />}
        {activeTab === 'bloodsugar' && <BloodSugarChartTab data={chartsData?.bloodSugars || []} admissionId={admissionId} onReload={loadCharts} isReadonly={isReadonly} />}
        {activeTab === 'transfusion' && <TransfusionChartTab data={chartsData?.transfusions || []} admissionId={admissionId} onReload={loadCharts} isReadonly={isReadonly} />}
        {activeTab === 'medication' && <MedicationChartTab data={chartsData?.medications || []} activePrescriptions={chartsData?.activePrescriptions || []} admissionId={admissionId} onReload={loadCharts} isReadonly={isReadonly} />}
      </div>
    </div>
  );
};

export default InpatientCharts;
