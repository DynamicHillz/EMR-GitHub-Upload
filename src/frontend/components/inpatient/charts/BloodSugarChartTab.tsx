import React, { useState } from 'react';
import InpatientService from '../../../services/InpatientService';
import Dropdown from '../../common/Dropdown';
import VoidRecordModal from './VoidRecordModal';

interface Props {
  data: any[];
  admissionId: string;
  onReload: () => void;
  isReadonly?: boolean;
}

const BloodSugarChartTab: React.FC<Props> = ({ data, admissionId, onReload, isReadonly = false }) => {
  const [loading, setLoading] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    bloodGlucose: '',
    measurementContext: 'Random',
    insulinGiven: '',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await InpatientService.addBloodSugarChart(admissionId, {
        bloodGlucose: parseFloat(formData.bloodGlucose),
        measurementContext: formData.measurementContext,
        insulinGiven: formData.insulinGiven,
        notes: formData.notes
      });
      setFormData({ bloodGlucose: '', measurementContext: 'Random', insulinGiven: '', notes: '' });
      onReload();
    } catch (err) {
      alert('Failed to save blood sugar record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!isReadonly && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-800 mb-4">Record Blood Sugar</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700">Glucose (mg/dL)</label>
            <input type="number" step="0.1" required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.bloodGlucose} onChange={e => setFormData({...formData, bloodGlucose: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Context</label>
            <Dropdown className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.measurementContext} onChange={e => setFormData({...formData, measurementContext: e.target.value})}>
              <option>Random</option>
              <option>Fasting</option>
              <option>Pre-prandial</option>
              <option>Post-prandial</option>
            </Dropdown>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Insulin Given (If any)</label>
            <input type="text" placeholder="e.g. 10 Units Actrapid" className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.insulinGiven} onChange={e => setFormData({...formData, insulinGiven: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Notes</label>
            <input type="text" className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          </div>
          <button type="submit" disabled={loading} className="w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Glucose</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Context</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insulin Given</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
              {!isReadonly && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((record: any) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(record.recordedAt).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{record.bloodGlucose} {record.unit}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.measurementContext}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.insulinGiven || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.notes || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.recordedBy?.firstName} {record.recordedBy?.lastName}</td>
                {!isReadonly && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button onClick={() => setVoidingId(record.id)} className="inline-flex items-center px-2.5 py-1 border border-red-300 rounded text-xs font-medium text-red-700 bg-white hover:bg-red-50">
                      Void
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {voidingId && (
        <VoidRecordModal
          title="Void Blood Sugar Entry"
          onClose={() => setVoidingId(null)}
          onConfirm={async (reason) => {
            await InpatientService.voidBloodSugarChart(admissionId, voidingId, reason);
            setVoidingId(null);
            onReload();
          }}
        />
      )}
    </div>
  );
};

export default BloodSugarChartTab;
