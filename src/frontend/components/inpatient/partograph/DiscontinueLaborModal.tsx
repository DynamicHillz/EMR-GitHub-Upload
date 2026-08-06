import React, { useState } from 'react';
import { X } from 'lucide-react';
import laborService from '../../../services/labor.service';
import { LaborRecord } from '../../../types/labor';
import { useToast } from '../../ToastContainer';
import Dropdown from '../../common/Dropdown';

interface DiscontinueLaborModalProps {
  laborRecordId: string;
  onClose: () => void;
  onSuccess: (laborRecord: LaborRecord) => void;
}

// The escape hatch for a mid-labor transfer/discontinuation — without this,
// discharging the admission before a delivery outcome is recorded would be
// a hard dead end (see InpatientService.dischargePatient's guard).
const DiscontinueLaborModal: React.FC<DiscontinueLaborModalProps> = ({ laborRecordId, onClose, onSuccess }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'TRANSFERRED' | 'DISCONTINUED'>('TRANSFERRED');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const laborRecord = await laborService.discontinueLabor(laborRecordId, { status, reason });
      toast.success('Labor record closed out');
      onSuccess(laborRecord);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to close out labor record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Mark as Transferred / Discontinued</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for closing out *</label>
            <Dropdown required className="input w-full" value={status} onChange={(e) => setStatus(e.target.value as 'TRANSFERRED' | 'DISCONTINUED')}>
              <option value="TRANSFERRED">Transferred to another facility</option>
              <option value="DISCONTINUED">Discontinued (other clinical reason)</option>
            </Dropdown>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Details *</label>
            <textarea
              required
              rows={3}
              className="input w-full"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Transferred to General Hospital for CS — obstructed labor"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700" disabled={loading}>
              {loading ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiscontinueLaborModal;
