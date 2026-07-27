/**
 * Medications Management Page
 *
 * Manage medications catalog - add, view, edit medications
 */

import React, { useState, useEffect } from 'react';
import { Pill, Plus, Search, Edit2 } from 'lucide-react';
import Dropdown from '../components/common/Dropdown';
import { getErrorMessage } from '../utils/errorHandler';

interface Medication {
  id: string;
  name: string;
  genericName?: string;
  brandName?: string;
  category?: string;
  dosageForm: string;
  strength: string;
  reorderPoint?: number;
  unitPrice: number;
}

const MedicationsPage: React.FC = () => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    brandName: '',
    activeIngredient: '',
    category: '',
    dosageForm: '',
    strength: '',
    drugClass: '',
    reorderPoint: '10',
    unitPrice: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchMedications();
  }, []);

  const fetchMedications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/medications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setMedications(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching medications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/pharmacy/medications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          unitPrice: parseFloat(formData.unitPrice),
          reorderPoint: parseInt(formData.reorderPoint),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('Medication added successfully!');
        setShowAddModal(false);
        setFormData({
          name: '',
          genericName: '',
          brandName: '',
          activeIngredient: '',
          category: '',
          dosageForm: '',
          strength: '',
          drugClass: '',
          reorderPoint: '10',
          unitPrice: '',
        });
        fetchMedications();
      } else {
        setError(result.message || 'Failed to add medication');
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'An error occurred'));
    }
  };

  const filteredMedications = medications.filter((med) =>
    med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (med.genericName && med.genericName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Pill className="w-16 h-16 text-purple-600 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-600">Loading medications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Pill className="w-8 h-8 text-purple-600" />
            Medications Catalog
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your medications database
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Medication
        </button>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medications..."
            className="input flex-1"
          />
        </div>
      </div>

      {/* Medications Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Medication Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Generic Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Strength
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Form
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Unit Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredMedications.map((med) => (
              <tr key={med.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {med.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {med.genericName || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {med.strength || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {med.dosageForm || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {med.category || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  ₦{med.unitPrice ? med.unitPrice.toFixed(2) : '0.00'}
                </td>
                <td className="px-6 py-4 text-sm">
                  <button className="text-purple-600 hover:text-purple-900">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredMedications.length === 0 && (
          <div className="text-center py-12">
            <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No medications found</p>
            <p className="text-gray-400 text-sm mt-2">
              Add your first medication to get started
            </p>
          </div>
        )}
      </div>

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-xl font-semibold">Add New Medication</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medication Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Paracetamol 500mg"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <Dropdown
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Select category...</option>
                    <option value="Analgesic">Analgesic</option>
                    <option value="Antibiotic">Antibiotic</option>
                    <option value="Antifungal">Antifungal</option>
                    <option value="Antihypertensive">Antihypertensive</option>
                    <option value="Antimalarial">Antimalarial</option>
                    <option value="Antihistamine">Antihistamine</option>
                    <option value="Anti-inflammatory">Anti-inflammatory</option>
                    <option value="Antiretroviral">Antiretroviral</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Dermatological">Dermatological</option>
                    <option value="Gastrointestinal">Gastrointestinal</option>
                    <option value="Hormonal">Hormonal</option>
                    <option value="Respiratory">Respiratory</option>
                    <option value="Supplement">Vitamin / Supplement</option>
                    <option value="Vaccine">Vaccine</option>
                    <option value="Other">Other</option>
                  </Dropdown>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dosage Form <span className="text-red-500">*</span>
                  </label>
                  <Dropdown
                    value={formData.dosageForm}
                    onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })}
                    required
                    className="input w-full"
                  >
                    <option value="">Select form...</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Cream">Cream</option>
                    <option value="Ointment">Ointment</option>
                    <option value="Drops">Drops</option>
                    <option value="Inhaler">Inhaler</option>
                  </Dropdown>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Generic Name
                  </label>
                  <input
                    type="text"
                    value={formData.genericName}
                    onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                    placeholder="e.g., Paracetamol"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    placeholder="e.g., Panadol"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Strength <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.strength}
                    onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                    required
                    placeholder="e.g., 500mg"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Drug Class
                  </label>
                  <input
                    type="text"
                    value={formData.drugClass}
                    onChange={(e) => setFormData({ ...formData, drugClass: e.target.value })}
                    placeholder="e.g., Non-opioid analgesic"
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
                    placeholder="e.g., 5.00"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reorder Point
                  </label>
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
                  onClick={() => {
                    setShowAddModal(false);
                    setError('');
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Medication
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationsPage;
