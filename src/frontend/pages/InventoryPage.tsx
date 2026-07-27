/**
 * Inventory Management Page
 *
 * REQ-PHARM-4: View and manage medication inventory with batch tracking
 */

import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Plus, Calendar, TrendingDown } from 'lucide-react';
import AddBatchModal from '../components/pharmacy/AddBatchModal';
import { formatDate } from '../utils/formatters';

interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  status: string;
  daysUntilExpiry: number;
}

interface InventoryItem {
  medicationId: string;
  medicationName: string;
  totalStock: number;
  reorderLevel: number;
  batches: Batch[];
  lowStock: boolean;
  nearExpiry: boolean;
}

const InventoryPage: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/inventory`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setInventory(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatExpiryDate = (dateString: string, daysUntilExpiry: number) => {
    const date = formatDate(dateString);

    if (daysUntilExpiry < 0) {
      return <span className="text-red-600 font-semibold">Expired ({date})</span>;
    } else if (daysUntilExpiry <= 7) {
      return <span className="text-red-600 font-semibold">{date} ({daysUntilExpiry}d)</span>;
    } else if (daysUntilExpiry <= 30) {
      return <span className="text-orange-600 font-semibold">{date} ({daysUntilExpiry}d)</span>;
    }
    return <span>{date}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Package className="w-16 h-16 text-purple-600 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-600">Loading inventory...</p>
        </div>
      </div>
    );
  }

  const lowStockCount = inventory.filter(i => i.lowStock).length;
  const nearExpiryCount = inventory.filter(i => i.nearExpiry).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="w-8 h-8 text-purple-600" />
            Medication Inventory
          </h1>
          <p className="text-gray-600 mt-2">
            Track and manage medication stock levels
          </p>
        </div>
        <button
          onClick={() => setShowAddBatchModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Batch
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Medications</h3>
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
        {inventory.map((item) => (
          <div
            key={item.medicationId}
            className={`bg-white rounded-lg shadow-sm overflow-hidden ${
              item.lowStock ? 'border-2 border-red-200' : ''
            }`}
          >
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">{item.medicationName}</h3>
                <div className="flex gap-4 mt-1 text-sm">
                  <span className={item.lowStock ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                    Stock: {item.totalStock} units
                  </span>
                  <span className="text-gray-500">
                    Reorder Level: {item.reorderLevel}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {item.lowStock && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                    Low Stock
                  </span>
                )}
                {item.nearExpiry && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    Near Expiry
                  </span>
                )}
              </div>
            </div>

            {/* Batches Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Batch Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Expiry Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {item.batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {batch.batchNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {batch.quantity} units
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {formatExpiryDate(batch.expiryDate, batch.daysUntilExpiry)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          batch.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          batch.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {batch.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {inventory.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No inventory items found</p>
        </div>
      )}

      {/* Add Batch Modal */}
      <AddBatchModal
        isOpen={showAddBatchModal}
        onClose={() => setShowAddBatchModal(false)}
        onSuccess={fetchInventory}
      />
    </div>
  );
};

export default InventoryPage;
