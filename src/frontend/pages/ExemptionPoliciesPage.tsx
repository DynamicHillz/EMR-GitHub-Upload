/**
 * Exemption Policies Page
 * Admin CRUD for fee exemption/discount policies (e.g. free care for under-5s)
 */

import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import exemptionService, { ExemptionPolicy, ExemptionPolicyInput } from '../services/exemption.service';
import ErrorAlert from '../components/common/ErrorAlert';
import Dropdown from '../components/common/Dropdown';

const emptyForm: ExemptionPolicyInput = {
  name: '',
  description: '',
  criteriaType: 'AGE',
  criteriaValue: '',
  discountPercentage: 100,
  isActive: true,
};

const criteriaPlaceholder = (type: string) => {
  switch (type) {
    case 'AGE':
      return 'e.g. "<5" or ">65"';
    case 'CONDITION':
      return 'e.g. PREGNANT';
    default:
      return 'Free-text criteria';
  }
};

const ExemptionPoliciesPage: React.FC = () => {
  const [policies, setPolicies] = useState<ExemptionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExemptionPolicyInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await exemptionService.getPolicies();
      setPolicies(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load exemption policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEdit = (policy: ExemptionPolicy) => {
    setEditingId(policy.id);
    setFormData({
      name: policy.name,
      description: policy.description || '',
      criteriaType: policy.criteriaType,
      criteriaValue: policy.criteriaValue,
      discountPercentage: policy.discountPercentage,
      isActive: policy.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      if (editingId) {
        await exemptionService.updatePolicy(editingId, formData);
      } else {
        await exemptionService.createPolicy(formData);
      }
      setShowForm(false);
      fetchPolicies();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save exemption policy');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (policy: ExemptionPolicy) => {
    try {
      setError('');
      await exemptionService.updatePolicy(policy.id, { isActive: !policy.isActive });
      fetchPolicies();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update policy');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exemption Policies</h1>
          <p className="text-gray-600 mt-1">Manage fee exemptions and discounts (e.g. free care for under-5s, pregnancy)</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Policy
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
        ) : policies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No exemption policies configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criteria</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {policies.map((policy) => (
                  <tr key={policy.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{policy.name}</div>
                      {policy.description && <div className="text-sm text-gray-500">{policy.description}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {policy.criteriaType}: {policy.criteriaValue}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{policy.discountPercentage}%</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${policy.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {policy.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-3">
                        <button onClick={() => openEdit(policy)} className="text-primary-600 hover:text-primary-900">
                          Edit
                        </button>
                        <button onClick={() => handleToggleActive(policy)} className={policy.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}>
                          {policy.isActive ? 'Deactivate' : 'Reactivate'}
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
              <h2 className="text-lg font-semibold text-gray-800">{editingId ? 'Edit' : 'New'} Exemption Policy</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input w-full" required placeholder="e.g. Under-5 Free Care" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input w-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Type</label>
                  <Dropdown value={formData.criteriaType} onChange={(e) => setFormData({ ...formData, criteriaType: e.target.value as ExemptionPolicyInput['criteriaType'] })} className="input w-full">
                    <option value="AGE">Age</option>
                    <option value="CONDITION">Condition</option>
                    <option value="CUSTOM">Custom</option>
                  </Dropdown>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Criteria Value <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={formData.criteriaValue} onChange={(e) => setFormData({ ...formData, criteriaValue: e.target.value })} className="input w-full" required placeholder={criteriaPlaceholder(formData.criteriaType)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Percentage <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({ ...formData, discountPercentage: Number(e.target.value) })}
                  className="input w-full"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">100% means fully free</p>
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
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExemptionPoliciesPage;
