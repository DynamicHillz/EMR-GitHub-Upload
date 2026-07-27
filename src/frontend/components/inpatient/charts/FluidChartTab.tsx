import React, { useState, useMemo } from 'react';
import InpatientService from '../../../services/InpatientService';
import Dropdown from '../../common/Dropdown';
import VoidRecordModal from './VoidRecordModal';

interface Props {
  data: any[];
  admissionId: string;
  onReload: () => void;
  isReadonly?: boolean;
}

// Route and fluid-substance options are genuinely different for what's
// going in vs what's coming out — keying both dropdowns off `type` instead
// of leaving them as free text keeps entries consistent (and sortable/
// reportable) instead of every nurse spelling "IV"/"Intravenous"/"iv" differently.
const ROUTE_OPTIONS: Record<string, string[]> = {
  INTAKE: ['Oral', 'Intravenous (IV)', 'IV Bolus', 'NG Tube', 'Subcutaneous', 'Other'],
  OUTPUT: ['Urine', 'Vomitus/Emesis', 'NG Aspirate', 'Drain', 'Stool', 'Blood Loss', 'Other'],
};

const FLUID_NAME_OPTIONS: Record<string, string[]> = {
  INTAKE: [
    'Water', 'Normal Saline (0.9%)', 'Half Normal Saline (0.45%)', 'Dextrose 5% (D5W)',
    "Ringer's Lactate", 'Dextrose Saline', 'Breast Milk', 'Formula', 'Juice', 'Other',
  ],
  OUTPUT: ['Urine', 'Vomitus', 'Gastric Aspirate', 'Drain Fluid', 'Blood', 'Stool', 'Other'],
};

const FluidChartTab: React.FC<Props> = ({ data, admissionId, onReload, isReadonly = false }) => {
  const [loading, setLoading] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: 'INTAKE',
    route: ROUTE_OPTIONS.INTAKE[0],
    fluidName: FLUID_NAME_OPTIONS.INTAKE[0],
    fluidNameOther: '',
    volumeMl: '',
    notes: ''
  });

  const handleTypeChange = (type: string) => {
    // Whatever route/fluid was selected under the old type almost certainly
    // isn't a valid option under the new one — reset both to that type's
    // first option rather than leaving a stale mismatched value selected.
    setFormData({
      ...formData,
      type,
      route: ROUTE_OPTIONS[type][0],
      fluidName: FLUID_NAME_OPTIONS[type][0],
      fluidNameOther: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const fluidName = formData.fluidName === 'Other' ? formData.fluidNameOther : formData.fluidName;
      await InpatientService.addFluidChart(admissionId, {
        type: formData.type,
        route: formData.route,
        fluidName,
        volumeMl: parseFloat(formData.volumeMl),
        notes: formData.notes
      });
      setFormData({
        type: 'INTAKE',
        route: ROUTE_OPTIONS.INTAKE[0],
        fluidName: FLUID_NAME_OPTIONS.INTAKE[0],
        fluidNameOther: '',
        volumeMl: '',
        notes: ''
      });
      onReload();
    } catch (err) {
      alert('Failed to save fluid record');
    } finally {
      setLoading(false);
    }
  };

  const balance = useMemo(() => {
    let intake = 0;
    let output = 0;
    data.forEach(record => {
      if (record.type === 'INTAKE') intake += record.volumeMl;
      else if (record.type === 'OUTPUT') output += record.volumeMl;
    });
    return { intake, output, net: intake - output };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm font-medium text-green-800">Total Intake</p>
          <p className="text-2xl font-bold text-green-900">{balance.intake} ml</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <p className="text-sm font-medium text-red-800">Total Output</p>
          <p className="text-2xl font-bold text-red-900">{balance.output} ml</p>
        </div>
        <div className={`p-4 rounded-lg border ${balance.net >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className={`text-sm font-medium ${balance.net >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>Net Balance</p>
          <p className={`text-2xl font-bold ${balance.net >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
            {balance.net > 0 ? '+' : ''}{balance.net} ml
          </p>
        </div>
      </div>

      {!isReadonly && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-800 mb-4">Record Fluid Entry</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700">Type</label>
            <Dropdown className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.type} onChange={e => handleTypeChange(e.target.value)}>
              <option value="INTAKE">Intake</option>
              <option value="OUTPUT">Output</option>
            </Dropdown>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Route</label>
            <Dropdown required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.route} onChange={e => setFormData({...formData, route: e.target.value})}>
              {ROUTE_OPTIONS[formData.type].map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Dropdown>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Fluid Details</label>
            <Dropdown required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.fluidName} onChange={e => setFormData({...formData, fluidName: e.target.value})}>
              {FLUID_NAME_OPTIONS[formData.type].map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Dropdown>
            {formData.fluidName === 'Other' && (
              <input
                type="text"
                required
                placeholder="Specify fluid"
                className="mt-2 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm"
                value={formData.fluidNameOther}
                onChange={e => setFormData({...formData, fluidNameOther: e.target.value})}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Volume (ml)</label>
            <input type="number" required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.volumeMl} onChange={e => setFormData({...formData, volumeMl: e.target.value})} />
          </div>
          <button type="submit" disabled={loading} className="w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700">
            {loading ? 'Saving...' : 'Save Record'}
          </button>
        </div>
      </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volume (ml)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
              {!isReadonly && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((record: any) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(record.recordedAt).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <span className={`px-2 py-1 rounded-full text-xs ${record.type === 'INTAKE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {record.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.route}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.fluidName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{record.volumeMl}</td>
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
          title="Void Fluid Chart Entry"
          onClose={() => setVoidingId(null)}
          onConfirm={async (reason) => {
            await InpatientService.voidFluidChart(admissionId, voidingId, reason);
            setVoidingId(null);
            onReload();
          }}
        />
      )}
    </div>
  );
};

export default FluidChartTab;
