import React, { useState } from 'react';
import { X } from 'lucide-react';
import InpatientService from '../../services/InpatientService';
import { useToast } from '../ToastContainer';
import { Ward, Bed, Admission } from '../../types/inpatient';
import Dropdown from '../common/Dropdown';

interface BedTransferModalProps {
  admission: Admission;
  wards: Ward[];
  onClose: () => void;
  onSuccess: () => void;
}

const BedTransferModal: React.FC<BedTransferModalProps> = ({
  admission,
  wards,
  onClose,
  onSuccess
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [wardId, setWardId] = useState(admission.bed?.wardId || '');
  const [bedId, setBedId] = useState('');
  const [reason, setReason] = useState('');

  const selectedWard = wards.find(w => w.id === wardId);
  const availableBeds = selectedWard?.beds?.filter(b => b.status === 'AVAILABLE') || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedId || !reason) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      await InpatientService.transferPatient(admission.id, {
        toBedId: bedId,
        reason
      });
      toast.success('Patient transferred successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to transfer patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Transfer Bed</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700 mb-4">
            <div className="font-medium">Current Location:</div>
            <div>{admission.bed?.ward?.name} - Bed {admission.bed?.bedNumber}</div>
            {admission.isolationRequired && (
              <div className="text-orange-600 font-medium mt-1">
                ⚠️ Patient requires isolation ({admission.infectionRisk})
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select New Ward *</label>
            <Dropdown
              className="input w-full"
              value={wardId}
              onChange={e => {
                setWardId(e.target.value);
                setBedId('');
              }}
              required
            >
              <option value="">-- Select Ward --</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.type})
                </option>
              ))}
            </Dropdown>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select New Bed *</label>
            <Dropdown
              className="input w-full"
              value={bedId}
              onChange={e => setBedId(e.target.value)}
              required
              disabled={!wardId}
            >
              <option value="">-- Select Available Bed --</option>
              {availableBeds.map(b => (
                <option key={b.id} value={b.id}>
                  Bed {b.bedNumber} {b.type ? `(${b.type})` : ''} {b.isolationReady ? ' [Isolation Ready]' : ''}
                </option>
              ))}
            </Dropdown>
            {wardId && availableBeds.length === 0 && (
              <p className="mt-1 text-xs text-red-500">No available beds in this ward.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Transfer *</label>
            <input
              type="text"
              className="input w-full"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Needs ICU care, condition stable"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !bedId || !reason}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none disabled:opacity-50"
            >
              {loading ? 'Transferring...' : 'Confirm Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BedTransferModal;
