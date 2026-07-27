import React, { useState } from 'react';
import InpatientService from '../../services/InpatientService';
import Dropdown from '../common/Dropdown';

interface EditBedModalProps {
  bed: any;
  onClose: () => void;
  onSuccess: () => void;
}

const EditBedModal: React.FC<EditBedModalProps> = ({ bed, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    bedNumber: bed.bedNumber || '',
    type: bed.type || 'Standard',
    status: bed.status || 'AVAILABLE'
  });
  const isOccupied = bed.status === 'OCCUPIED';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await InpatientService.updateBed(bed.id, formData);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update bed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Edit Bed</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bed Number/Label *</label>
              <input
                type="text"
                className="input w-full"
                value={formData.bedNumber}
                onChange={e => setFormData({ ...formData, bedNumber: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bed Type *</label>
              <Dropdown
                className="input w-full"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
                required
              >
                <option value="Standard">Standard</option>
                <option value="Private">Private</option>
                <option value="ICU">ICU</option>
                <option value="Maternity">Maternity</option>
              </Dropdown>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <Dropdown
                className="input w-full"
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                disabled={isOccupied}
              >
                <option value="AVAILABLE">Available</option>
                <option value="MAINTENANCE">Under Maintenance</option>
                {isOccupied && <option value="OCCUPIED">Occupied</option>}
              </Dropdown>
              {isOccupied && (
                <p className="text-xs text-gray-500 mt-1">This bed is occupied — discharge or transfer the patient before changing its status.</p>
              )}
            </div>

            <div className="pt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditBedModal;
