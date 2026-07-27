/**
 * Add Consumable Batch Modal
 *
 * Modal for adding new stock (a batch) of a consumable to inventory.
 */

import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import Dropdown from '../common/Dropdown';
import { getErrorMessage } from '../../utils/errorHandler';
import { Consumable } from '../../types/pharmacy';

interface AddConsumableBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddConsumableBatchModal: React.FC<AddConsumableBatchModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    consumableId: '',
    batchNumber: '',
    expiryDate: '',
    quantity: '',
    unitCost: '',
    sellingPrice: '',
    supplier: '',
    purchaseDate: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');
  const [markupPercent, setMarkupPercent] = useState(40);
  // Tracks whether the pharmacist has typed into Selling Price directly —
  // once true, unit cost changes stop overwriting it, so a deliberate
  // override sticks.
  const [sellingPriceTouched, setSellingPriceTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchConsumables();
      fetchMarkupPercent();
      setSellingPriceTouched(false);
    }
  }, [isOpen]);

  const fetchConsumables = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/consumables`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        setConsumables(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching consumables:', error);
    }
  };

  const fetchMarkupPercent = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/billing/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        const pct = parseFloat(result.data?.defaultMarkupPercent);
        if (!isNaN(pct)) setMarkupPercent(pct);
      }
    } catch (error) {
      console.error('Error fetching markup percent:', error);
    }
  };

  const handleUnitCostChange = (value: string) => {
    setFormData((prev) => {
      const next = { ...prev, unitCost: value };
      if (!sellingPriceTouched) {
        const cost = parseFloat(value);
        next.sellingPrice = isNaN(cost) ? '' : (cost * (1 + markupPercent / 100)).toFixed(2);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/consumables/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          consumableId: formData.consumableId,
          batchNumber: formData.batchNumber,
          expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : null,
          quantity: parseInt(formData.quantity),
          unitCost: parseFloat(formData.unitCost),
          sellingPrice: parseFloat(formData.sellingPrice),
          supplier: formData.supplier || null,
          purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
        setFormData({
          consumableId: '',
          batchNumber: '',
          expiryDate: '',
          quantity: '',
          unitCost: '',
          sellingPrice: '',
          supplier: '',
          purchaseDate: new Date().toISOString().split('T')[0],
        });
        setSellingPriceTouched(false);
      } else {
        setError(result.message || 'Failed to add batch');
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Plus className="w-6 h-6 text-purple-600" />
            Add Consumable Stock
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consumable <span className="text-red-500">*</span>
            </label>
            <Dropdown
              value={formData.consumableId}
              onChange={(e) => setFormData({ ...formData, consumableId: e.target.value })}
              required
              className="input w-full"
            >
              <option value="">Select consumable...</option>
              {consumables.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Dropdown>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.batchNumber}
              onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
              required
              placeholder="e.g., BATCH-2026-001"
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date <span className="text-gray-400 font-normal">(if applicable)</span>
              </label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
                min="1"
                placeholder="e.g., 100"
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Cost (₦) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.unitCost}
                onChange={(e) => handleUnitCostChange(e.target.value)}
                required
                min="0"
                placeholder="e.g., 50.00"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selling Price (₦) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.sellingPrice}
                onChange={(e) => {
                  setSellingPriceTouched(true);
                  setFormData({ ...formData, sellingPrice: e.target.value });
                }}
                required
                min="0"
                placeholder="e.g., 100.00"
                className="input w-full"
              />
              <p className="mt-1 text-xs text-gray-500">
                Auto-filled at {markupPercent}% markup — edit to override.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                placeholder="e.g., MedSupply Co."
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
              <input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddConsumableBatchModal;
