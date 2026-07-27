import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import InpatientService from '../../services/InpatientService';
import { useToast } from '../ToastContainer';
import { Ward } from '../../types/inpatient';
import Dropdown from '../common/Dropdown';

interface WardModalProps {
  ward?: Ward | null;
  onClose: () => void;
  onSuccess: () => void;
}

const WardModal: React.FC<WardModalProps> = ({ ward, onClose, onSuccess }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'General',
    capacity: 10,
    dailyCost: 0
  });

  useEffect(() => {
    if (ward) {
      setFormData({
        name: ward.name,
        type: ward.type,
        capacity: ward.capacity,
        dailyCost: ward.dailyCost || 0
      });
    }
  }, [ward]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (ward) {
        await InpatientService.updateWard(ward.id, formData);
        toast.success('Ward updated successfully');
      } else {
        await InpatientService.createWard(formData);
        toast.success('Ward created successfully');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Error saving ward');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            {ward ? 'Edit Ward' : 'Create New Ward'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ward Name *</label>
            <input
              type="text"
              required
              className="input w-full"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ward A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ward Type *</label>
            <Dropdown
              required
              className="input w-full"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="General">General</option>
              <option value="Private">Private</option>
              <option value="ICU">ICU</option>
              <option value="Maternity">Maternity</option>
              <option value="Pediatric">Pediatric</option>
              <option value="Emergency">Emergency</option>
            </Dropdown>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (Number of Beds) *</label>
            <input
              type="number"
              required
              min="1"
              className="input w-full"
              value={formData.capacity}
              onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
            />
            {ward && (
              <p className="text-xs text-yellow-600 mt-1">
                Warning: Reducing capacity will delete empty beds. It will fail if deleted beds are currently occupied.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Daily Room Cost (₦) *</label>
            <input
              type="number"
              required
              min="0"
              className="input w-full"
              value={formData.dailyCost}
              onChange={e => setFormData({ ...formData, dailyCost: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Ward'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WardModal;
