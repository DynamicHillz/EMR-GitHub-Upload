import React, { useState } from 'react';
import { X } from 'lucide-react';
import laborService from '../../../services/labor.service';
import { LaborRecord } from '../../../types/labor';
import { useToast } from '../../ToastContainer';
import Dropdown from '../../common/Dropdown';

interface StartLaborModalProps {
  admissionId: string;
  onClose: () => void;
  onSuccess: (laborRecord: LaborRecord) => void;
}

const toDatetimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const StartLaborModal: React.FC<StartLaborModalProps> = ({ admissionId, onClose, onSuccess }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [laborOnsetAt, setLaborOnsetAt] = useState(toDatetimeLocal(new Date()));
  const [onsetType, setOnsetType] = useState('SPONTANEOUS');
  const [romAt, setRomAt] = useState('');
  const [romType, setRomType] = useState('');
  const [liquorAtRom, setLiquorAtRom] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const laborRecord = await laborService.startLabor(admissionId, {
        laborOnsetAt: laborOnsetAt ? new Date(laborOnsetAt).toISOString() : undefined,
        onsetType,
        romAt: romAt ? new Date(romAt).toISOString() : undefined,
        romType: romType || undefined,
        liquorAtRom: liquorAtRom || undefined,
      });
      toast.success(
        laborRecord.pregnancyId ? 'Labor tracking started — antenatal record linked' : 'Labor tracking started — no antenatal record found for this patient'
      );
      onSuccess(laborRecord);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to start labor tracking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Start Labor Tracking</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Labor Onset *</label>
            <input
              type="datetime-local"
              required
              className="input w-full"
              value={laborOnsetAt}
              onChange={(e) => setLaborOnsetAt(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Onset Type</label>
            <Dropdown className="input w-full" value={onsetType} onChange={(e) => setOnsetType(e.target.value)}>
              <option value="SPONTANEOUS">Spontaneous</option>
              <option value="INDUCED">Induced</option>
              <option value="AUGMENTED">Augmented</option>
            </Dropdown>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rupture of Membranes</label>
              <input type="datetime-local" className="input w-full" value={romAt} onChange={(e) => setRomAt(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ROM Type</label>
              <Dropdown className="input w-full" value={romType} onChange={(e) => setRomType(e.target.value)}>
                <option value="">Not recorded</option>
                <option value="SPONTANEOUS">Spontaneous</option>
                <option value="ARTIFICIAL">Artificial</option>
              </Dropdown>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Liquor at ROM</label>
            <Dropdown className="input w-full" value={liquorAtRom} onChange={(e) => setLiquorAtRom(e.target.value)}>
              <option value="">Not recorded</option>
              <option value="CLEAR">Clear</option>
              <option value="MECONIUM_STAINED">Meconium Stained</option>
              <option value="BLOOD_STAINED">Blood Stained</option>
            </Dropdown>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700" disabled={loading}>
              {loading ? 'Starting...' : 'Start Labor Tracking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StartLaborModal;
