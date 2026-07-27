import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import InpatientService from '../../../services/InpatientService';
import { Activity, Thermometer, Heart, Wind, AlertTriangle } from 'lucide-react';
import VoidRecordModal from './VoidRecordModal';

interface Props {
  data: any[];
  admissionId: string;
  onReload: () => void;
  isReadonly?: boolean;
}

// Threshold-based flags, not a validated early-warning score — a simple,
// transparent nudge that a reading is outside a common danger range.
const VITAL_THRESHOLDS: { key: string; label: string; test: (r: any) => boolean }[] = [
  { key: 'spO2', label: 'Low SpO2', test: (r) => r.spO2 != null && r.spO2 < 92 },
  { key: 'tempHigh', label: 'High Temp', test: (r) => r.temperature != null && r.temperature > 39 },
  { key: 'tempLow', label: 'Low Temp', test: (r) => r.temperature != null && r.temperature < 35 },
  { key: 'hrHigh', label: 'High HR', test: (r) => r.heartRate != null && r.heartRate > 120 },
  { key: 'hrLow', label: 'Low HR', test: (r) => r.heartRate != null && r.heartRate < 50 },
  { key: 'bpLow', label: 'Low BP', test: (r) => r.systolicBP != null && r.systolicBP < 90 },
  { key: 'bpHigh', label: 'High BP', test: (r) => r.systolicBP != null && r.systolicBP > 180 },
];

const getVitalFlags = (record: any): string[] =>
  VITAL_THRESHOLDS.filter((t) => t.test(record)).map((t) => t.label);

const VitalChartTab: React.FC<Props> = ({ data, admissionId, onReload, isReadonly = false }) => {
  const chartData = [...data]
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((d) => ({
      ...d,
      displayDate: new Date(d.recordedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    }));

  const [loading, setLoading] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    temperature: '',
    systolicBP: '',
    diastolicBP: '',
    heartRate: '',
    respiratoryRate: '',
    spO2: '',
    painScore: '',
    weight: '',
    height: '',
    headCircumference: '',
    muac: '',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await InpatientService.addVitalChart(admissionId, {
        temperature: parseFloat(formData.temperature),
        systolicBP: parseInt(formData.systolicBP),
        diastolicBP: parseInt(formData.diastolicBP),
        bloodPressure: formData.systolicBP && formData.diastolicBP ? `${formData.systolicBP}/${formData.diastolicBP}` : undefined,
        heartRate: parseInt(formData.heartRate),
        respiratoryRate: parseInt(formData.respiratoryRate),
        spO2: parseInt(formData.spO2),
        painScore: parseInt(formData.painScore),
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        headCircumference: formData.headCircumference ? parseFloat(formData.headCircumference) : undefined,
        muac: formData.muac ? parseFloat(formData.muac) : undefined,
        notes: formData.notes
      });
      setFormData({ temperature: '', systolicBP: '', diastolicBP: '', heartRate: '', respiratoryRate: '', spO2: '', painScore: '', weight: '', height: '', headCircumference: '', muac: '', notes: '' });
      onReload();
    } catch (err) {
      alert('Failed to save vitals');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!isReadonly && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="font-medium text-gray-800 mb-4">Record New Vitals</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700">Temp (°C)</label>
            <input type="number" step="0.1" required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.temperature} onChange={e => setFormData({...formData, temperature: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Sys BP</label>
            <input type="number" placeholder="120" required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.systolicBP} onChange={e => setFormData({...formData, systolicBP: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Dia BP</label>
            <input type="number" placeholder="80" required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.diastolicBP} onChange={e => setFormData({...formData, diastolicBP: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Pulse Rate</label>
            <input type="number" required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.heartRate} onChange={e => setFormData({...formData, heartRate: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Resp Rate</label>
            <input type="number" className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.respiratoryRate} onChange={e => setFormData({...formData, respiratoryRate: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">SpO2 (%)</label>
            <input type="number" className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.spO2} onChange={e => setFormData({...formData, spO2: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Pain (0-10)</label>
            <input type="number" min="0" max="10" className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.painScore} onChange={e => setFormData({...formData, painScore: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Wt (kg)</label>
            <input type="number" step="0.1" className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Ht (cm)</label>
            <input type="number" step="0.1" className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">HC (cm)</label>
            <input type="number" step="0.1" className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.headCircumference} onChange={e => setFormData({...formData, headCircumference: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">MUAC (cm)</label>
            <input type="number" step="0.1" className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.muac} onChange={e => setFormData({...formData, muac: e.target.value})} />
          </div>
        </div>
        <div className="mt-4 flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700">Notes</label>
            <input type="text" className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400">
              {loading ? 'Saving...' : 'Save Vitals'}
            </button>
          </div>
        </div>
      </form>
      )}

      {data.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-1">Vitals Trend</h3>
          <p className="text-xs text-gray-400 mb-4">
            Shaded flags below are simple threshold nudges, not a validated early-warning score — always use clinical judgement.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-64">
              <h4 className="text-sm font-medium text-gray-600 mb-2 text-center">Blood Pressure & Pulse Rate</h4>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="systolicBP" name="Systolic BP" stroke="#ef4444" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="diastolicBP" name="Diastolic BP" stroke="#f97316" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="heartRate" name="Pulse Rate" stroke="#3b82f6" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-64">
              <h4 className="text-sm font-medium text-gray-600 mb-2 text-center">Temperature & SpO2</h4>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#8b5cf6" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="spO2" name="SpO2 (%)" stroke="#10b981" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Temp</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BP</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pulse</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resp/SpO2</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recorded By</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flags</th>
              {!isReadonly && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((record: any) => {
              const flags = getVitalFlags(record);
              return (
                <tr key={record.id} className={flags.length > 0 ? 'bg-red-50' : undefined}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(record.recordedAt).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.temperature}°C</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.systolicBP && record.diastolicBP ? `${record.systolicBP}/${record.diastolicBP}` : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.heartRate} bpm</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.respiratoryRate} / {record.spO2}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.recordedBy?.firstName} {record.recordedBy?.lastName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {flags.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                        <AlertTriangle className="w-3.5 h-3.5" /> {flags.join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  {!isReadonly && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button onClick={() => setVoidingId(record.id)} className="inline-flex items-center px-2.5 py-1 border border-red-300 rounded text-xs font-medium text-red-700 bg-white hover:bg-red-50">
                        Void
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {voidingId && (
        <VoidRecordModal
          title="Void Vital Sign Entry"
          onClose={() => setVoidingId(null)}
          onConfirm={async (reason) => {
            await InpatientService.voidVitalChart(admissionId, voidingId, reason);
            setVoidingId(null);
            onReload();
          }}
        />
      )}
    </div>
  );
};

export default VitalChartTab;
