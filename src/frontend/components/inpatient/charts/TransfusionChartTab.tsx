import React, { useState } from 'react';
import InpatientService from '../../../services/InpatientService';
import { formatBloodGroup } from '../../../utils/formatters';
import Dropdown from '../../common/Dropdown';
import VoidRecordModal from './VoidRecordModal';

interface Props {
  data: any[];
  admissionId: string;
  onReload: () => void;
  isReadonly?: boolean;
}

const TransfusionChartTab: React.FC<Props> = ({ data, admissionId, onReload, isReadonly = false }) => {
  const [loading, setLoading] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    bloodGroup: '',
    unitNumber: '',
    productType: 'Whole Blood',
    startTime: '',
    reaction: false,
    reactionNotes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await InpatientService.addTransfusionChart(admissionId, {
        ...formData,
        startTime: new Date(formData.startTime).toISOString()
      });
      setFormData({ bloodGroup: '', unitNumber: '', productType: 'Whole Blood', startTime: '', reaction: false, reactionNotes: '' });
      onReload();
    } catch (err) {
      alert('Failed to save transfusion record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!isReadonly && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-800 mb-4">Start Blood Transfusion</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700">Blood Group</label>
            <Dropdown required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})}>
              <option value="">Select...</option>
              <option value="A_POSITIVE">A+</option>
              <option value="A_NEGATIVE">A-</option>
              <option value="B_POSITIVE">B+</option>
              <option value="B_NEGATIVE">B-</option>
              <option value="AB_POSITIVE">AB+</option>
              <option value="AB_NEGATIVE">AB-</option>
              <option value="O_POSITIVE">O+</option>
              <option value="O_NEGATIVE">O-</option>
            </Dropdown>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Unit Number</label>
            <input type="text" required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.unitNumber} onChange={e => setFormData({...formData, unitNumber: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Product Type</label>
            <Dropdown className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.productType} onChange={e => setFormData({...formData, productType: e.target.value})}>
              <option>Whole Blood</option>
              <option>Packed RBCs</option>
              <option>Fresh Frozen Plasma</option>
              <option>Platelets</option>
            </Dropdown>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Start Time</label>
            <input type="datetime-local" required className="mt-1 block w-full px-3 py-2 rounded-md border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none sm:text-sm" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t flex gap-4 items-end">
          <div className="flex items-center h-full pb-2">
            <input type="checkbox" id="reaction" className="rounded border-gray-300 text-red-600 focus:ring-red-500" checked={formData.reaction} onChange={e => setFormData({...formData, reaction: e.target.checked})} />
            <label htmlFor="reaction" className="ml-2 text-sm text-gray-700">Adverse Reaction?</label>
          </div>
          {formData.reaction && (
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700">Reaction Notes</label>
              <input type="text" required className="mt-1 block w-full rounded-md border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm" value={formData.reactionNotes} onChange={e => setFormData({...formData, reactionNotes: e.target.value})} />
            </div>
          )}
          <button type="submit" disabled={loading} className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700">
            {loading ? 'Saving...' : 'Record Transfusion'}
          </button>
        </div>
      </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blood Group</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit #</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
              {!isReadonly && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((record: any) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(record.startTime).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.productType}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatBloodGroup(record.bloodGroup)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.unitNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {record.reaction ? (
                    <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Reaction: {record.reactionNotes}</span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Monitored</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.transfusedBy?.firstName} {record.transfusedBy?.lastName}</td>
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
          title="Void Transfusion Chart Entry"
          onClose={() => setVoidingId(null)}
          onConfirm={async (reason) => {
            await InpatientService.voidTransfusionChart(admissionId, voidingId, reason);
            setVoidingId(null);
            onReload();
          }}
        />
      )}
    </div>
  );
};

export default TransfusionChartTab;
