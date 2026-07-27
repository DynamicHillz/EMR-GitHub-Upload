/**
 * Consumables Management Page
 *
 * Non-drug supplies (syringes, gloves, gauze, cannula, IV giving sets, etc.)
 * stocked and billed to patients like medications, but without dosage
 * form/strength or a prescription step — see RecordConsumableUsageModal.
 */

import React, { useState, useEffect } from 'react';
import { Package, Plus, TrendingDown, Calendar, ClipboardList, Edit2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/errorHandler';
import AddConsumableBatchModal from '../components/pharmacy/AddConsumableBatchModal';
import RecordConsumableUsageModal from '../components/pharmacy/RecordConsumableUsageModal';
import { Consumable, ConsumableInventoryItem } from '../types/pharmacy';

const ConsumablesPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [inventory, setInventory] = useState<ConsumableInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showRecordUsageModal, setShowRecordUsageModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: 'piece',
    reorderPoint: '10',
    unitPrice: '',
    stockLevel: '0',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchConsumables(), fetchInventory()]);
    setLoading(false);
  };

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
    } catch (err) {
      console.error('Error fetching consumables:', err);
    }
  };

  const fetchInventory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/consumables/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setInventory(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching consumable inventory:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const isEditing = editingId !== null;
      const url = isEditing
        ? `${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/consumables/${editingId}`
        : `${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/consumables`;

      const payload = {
        name: formData.name,
        category: formData.category || undefined,
        unit: formData.unit || 'piece',
        reorderPoint: parseInt(formData.reorderPoint) || 0,
        unitPrice: parseFloat(formData.unitPrice) || 0,
        stockLevel: parseInt(formData.stockLevel) || 0,
      };

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(isEditing ? 'Item updated successfully!' : 'Item added successfully!');
        setShowAddModal(false);
        setEditingId(null);
        setFormData({ name: '', category: '', unit: 'piece', reorderPoint: '10', unitPrice: '', stockLevel: '0' });
        fetchAll();
      } else {
        setError(result.message || `Failed to ${isEditing ? 'update' : 'add'} item`);
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'An error occurred'));
    }
  };

  const handleEdit = (item: Consumable) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      category: item.category || '',
      unit: item.unit,
      reorderPoint: item.reorderPoint.toString(),
      unitPrice: item.unitPrice.toString(),
      stockLevel: item.stockLevel.toString(),
    });
    setShowAddModal(true);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', category: '', unit: 'piece', reorderPoint: '10', unitPrice: '', stockLevel: '0' });
    setShowAddModal(true);
  };

  const formatExpiryDate = (dateString: string | null, daysUntilExpiry: number | null) => {
    if (!dateString || daysUntilExpiry === null) return <span className="text-gray-400">No expiry tracked</span>;
    const date = formatDate(dateString);
    if (daysUntilExpiry < 0) return <span className="text-red-600 font-semibold">Expired ({date})</span>;
    if (daysUntilExpiry <= 7) return <span className="text-red-600 font-semibold">{date} ({daysUntilExpiry}d)</span>;
    if (daysUntilExpiry <= 30) return <span className="text-orange-600 font-semibold">{date} ({daysUntilExpiry}d)</span>;
    return <span>{date}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Package className="w-16 h-16 text-purple-600 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-600">Loading consumables...</p>
        </div>
      </div>
    );
  }

  const lowStockCount = inventory.filter((i) => i.lowStock).length;
  const nearExpiryCount = inventory.filter((i) => i.nearExpiry).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="w-8 h-8 text-purple-600" />
            Consumables & Supplies
          </h1>
          <p className="text-gray-600 mt-2">Non-drug supplies stocked and billed to patients</p>
        </div>
        <div className="flex gap-2">
          {hasRole(['SUPER_ADMIN', 'ADMIN', 'PHARMACIST', 'NURSE']) && (
            <button onClick={() => setShowRecordUsageModal(true)} className="btn btn-primary flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Record Usage
            </button>
          )}
          {hasRole(['SUPER_ADMIN', 'ADMIN', 'PHARMACIST']) && (
            <>
              <button onClick={() => setShowAddBatchModal(true)} className="btn btn-secondary flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Stock
              </button>
              <button onClick={openAddModal} className="btn btn-secondary flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Item
              </button>
            </>
          )}
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">{success}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Items</h3>
          <p className="text-3xl font-bold text-gray-900">{inventory.length}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <h3 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Low Stock
          </h3>
          <p className="text-3xl font-bold text-red-700">{lowStockCount}</p>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
          <h3 className="text-sm font-medium text-orange-600 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Near Expiry
          </h3>
          <p className="text-3xl font-bold text-orange-700">{nearExpiryCount}</p>
        </div>
      </div>

      {/* Inventory List */}
      <div className="space-y-4">
        {inventory.map((item) => {
          const consumable = consumables.find((c) => c.id === item.consumableId);
          return (
            <div
              key={item.consumableId}
              className={`bg-white rounded-lg shadow-sm overflow-hidden ${item.lowStock ? 'border-2 border-red-200' : ''}`}
            >
              <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {item.consumableName}
                    {consumable?.category && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {consumable.category}
                      </span>
                    )}
                  </h3>
                  <div className="flex gap-4 mt-1 text-sm">
                    <span className={item.lowStock ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                      Stock: {item.totalStock} {consumable?.unit || 'units'}
                    </span>
                    <span className="text-gray-500">Reorder Level: {item.reorderLevel}</span>
                    {consumable && <span className="text-gray-500">{formatCurrency(consumable.unitPrice)} / {consumable.unit}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.lowStock && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">Low Stock</span>
                  )}
                  {item.nearExpiry && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">Near Expiry</span>
                  )}
                  {hasRole(['SUPER_ADMIN', 'ADMIN', 'PHARMACIST']) && consumable && (
                    <button onClick={() => handleEdit(consumable)} className="text-gray-400 hover:text-primary-600">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {item.batches.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {item.batches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{batch.batchNumber}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{batch.quantity} {consumable?.unit || 'units'}</td>
                          <td className="px-6 py-4 text-sm">{formatExpiryDate(batch.expiryDate, batch.daysUntilExpiry)}</td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                batch.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800'
                                  : batch.status === 'EXPIRED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {batch.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {inventory.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No consumables found</p>
          <p className="text-gray-400 text-sm mt-2">Add your first consumable item to get started</p>
        </div>
      )}

      {/* Add/Edit Consumable Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {editingId ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setError(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Syringe 5ml"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Injection Supplies"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g., piece, box, pack"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price (₦) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                    required
                    min="0"
                    placeholder="e.g., 50.00"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Quantity</label>
                  <input
                    type="number"
                    value={formData.stockLevel}
                    onChange={(e) => setFormData({ ...formData, stockLevel: e.target.value })}
                    min="0"
                    placeholder="e.g., 50"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
                  <input
                    type="number"
                    value={formData.reorderPoint}
                    onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
                    min="0"
                    placeholder="e.g., 10"
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setError(''); }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Save Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddConsumableBatchModal
        isOpen={showAddBatchModal}
        onClose={() => setShowAddBatchModal(false)}
        onSuccess={fetchAll}
      />

      <RecordConsumableUsageModal
        isOpen={showRecordUsageModal}
        onClose={() => setShowRecordUsageModal(false)}
        onSuccess={fetchAll}
      />
    </div>
  );
};

export default ConsumablesPage;
