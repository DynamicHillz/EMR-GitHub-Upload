/**
 * Insurance Providers Page
 * Admin CRUD for the insurance provider directory (NHIA/HMO/Private)
 */

import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import insuranceProviderService, { InsuranceProvider, InsuranceProviderInput } from '../services/insuranceProvider.service';
import ErrorAlert from '../components/common/ErrorAlert';
import Dropdown from '../components/common/Dropdown';

const emptyForm: InsuranceProviderInput = {
  name: '',
  type: 'HMO',
  contactPhone: '',
  contactEmail: '',
  address: '',
  isActive: true,
};

const InsuranceProvidersPage: React.FC = () => {
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<InsuranceProviderInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await insuranceProviderService.getProviders();
      setProviders(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load insurance providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEdit = (provider: InsuranceProvider) => {
    setEditingId(provider.id);
    setFormData({
      name: provider.name,
      type: provider.type,
      contactPhone: provider.contactPhone || '',
      contactEmail: provider.contactEmail || '',
      address: provider.address || '',
      isActive: provider.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      if (editingId) {
        await insuranceProviderService.updateProvider(editingId, formData);
      } else {
        await insuranceProviderService.createProvider(formData);
      }
      setShowForm(false);
      fetchProviders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save insurance provider');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (provider: InsuranceProvider) => {
    try {
      setError('');
      await insuranceProviderService.updateProvider(provider.id, { isActive: !provider.isActive });
      fetchProviders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update provider');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Providers</h1>
          <p className="text-gray-600 mt-1">Manage the NHIA/HMO/private insurance providers patients can be enrolled under</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Provider
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} severity="error" onDismiss={() => setError('')} />
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No insurance providers configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {providers.map((provider) => (
                  <tr key={provider.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{provider.name}</div>
                      {provider.address && <div className="text-sm text-gray-500">{provider.address}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{provider.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {provider.contactPhone && <div>{provider.contactPhone}</div>}
                      {provider.contactEmail && <div>{provider.contactEmail}</div>}
                      {!provider.contactPhone && !provider.contactEmail && '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${provider.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {provider.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-3">
                        <button onClick={() => openEdit(provider)} className="text-primary-600 hover:text-primary-900">
                          Edit
                        </button>
                        <button onClick={() => handleToggleActive(provider)} className={provider.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}>
                          {provider.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">{editingId ? 'Edit' : 'New'} Insurance Provider</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input w-full" required placeholder="e.g. AXA Mansard HMO" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <Dropdown value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as InsuranceProviderInput['type'] })} className="input w-full">
                  <option value="NHIA">NHIA</option>
                  <option value="HMO">HMO</option>
                  <option value="PRIVATE">Private</option>
                </Dropdown>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} className="input w-full" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input w-full" />
              </div>
              <label className="flex items-center">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                <span className="ml-2 text-sm font-medium text-gray-700">Active</span>
              </label>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary" disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsuranceProvidersPage;
