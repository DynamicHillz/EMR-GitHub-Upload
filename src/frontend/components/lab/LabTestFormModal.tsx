import React, { useState } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { LabTestDictionaryItem } from '../../pages/lab/LabCatalogPage';
import Dropdown from '../common/Dropdown';

interface LabTestFormModalProps {
  test: LabTestDictionaryItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const LabTestFormModal: React.FC<LabTestFormModalProps> = ({ test, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: test?.name || '',
    category: test?.category || 'Hematology',
    price: test?.price || 0,
    isActive: test ? test.isActive : true,
  });

  // Map parameters from the test structure or start with an empty array
  const [parameters, setParameters] = useState<any[]>(
    test?.parameters?.map(p => ({
      id: p.parameter.id,
      name: p.parameter.name,
      unit: p.parameter.unit || '',
      refRangeMale: p.parameter.refRangeMale || '',
      refRangeFemale: p.parameter.refRangeFemale || '',
      displayOrder: p.displayOrder
    })) || []
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAddParameter = () => {
    setParameters([
      ...parameters,
      {
        id: '',
        name: '',
        unit: '',
        refRangeMale: '',
        refRangeFemale: '',
        displayOrder: parameters.length
      }
    ]);
  };

  const handleRemoveParameter = (index: number) => {
    const newParams = [...parameters];
    newParams.splice(index, 1);
    // Re-adjust display orders
    newParams.forEach((p, i) => p.displayOrder = i);
    setParameters(newParams);
  };

  const handleParamChange = (index: number, field: string, value: string) => {
    const newParams = [...parameters];
    newParams[index][field] = value;
    setParameters(newParams);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const url = test 
        ? `${window.location.protocol}//${window.location.hostname}:3000/api/lab/dictionary/${test.id}`
        : `${window.location.protocol}//${window.location.hostname}:3000/api/lab/dictionary`;
      
      const method = test ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        parameters
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        onSuccess();
      } else {
        const result = await response.json();
        setError(result.message || 'Failed to save lab test');
      }
    } catch (err) {
      setError('An error occurred while saving the test');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {test ? 'Edit Lab Test' : 'Add New Lab Test'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
              {error}
            </div>
          )}

          <form id="labTestForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
                <input
                  type="text"
                  required
                  className="input w-full"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Full Blood Count"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <Dropdown
                  className="input w-full"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Hematology">Hematology</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Serology">Serology</option>
                  <option value="Microbiology">Microbiology</option>
                  <option value="Hormone">Hormone</option>
                  <option value="Pathology">Pathology</option>
                  <option value="Immunology">Immunology</option>
                  <option value="Other">Other</option>
                </Dropdown>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₦)</label>
                <input
                  type="number"
                  min="0"
                  required
                  className="input w-full"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center mt-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span className="ml-2 text-sm text-gray-700">Test is Active (Orderable)</span>
                </label>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Test Parameters</h3>
                <button
                  type="button"
                  onClick={handleAddParameter}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Parameter
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                {parameters.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No parameters defined. Add a parameter if this test requires multiple numeric or textual results (e.g., WBC, RBC for a Full Blood Count).</p>
                ) : (
                  <div className="space-y-4">
                    {parameters.map((param, index) => (
                      <div key={index} className="flex items-start space-x-3 bg-white p-3 rounded shadow-sm border border-gray-100">
                        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="col-span-2 lg:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Parameter Name</label>
                            <input
                              type="text"
                              required
                              className="input w-full py-1.5 text-sm"
                              value={param.name}
                              onChange={e => handleParamChange(index, 'name', e.target.value)}
                              placeholder="e.g. WBC"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                            <input
                              type="text"
                              className="input w-full py-1.5 text-sm"
                              value={param.unit}
                              onChange={e => handleParamChange(index, 'unit', e.target.value)}
                              placeholder="e.g. 10^9/L"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Male Range</label>
                            <input
                              type="text"
                              className="input w-full py-1.5 text-sm"
                              value={param.refRangeMale}
                              onChange={e => handleParamChange(index, 'refRangeMale', e.target.value)}
                              placeholder="e.g. 4.5 - 11.0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Female Range</label>
                            <input
                              type="text"
                              className="input w-full py-1.5 text-sm"
                              value={param.refRangeFemale}
                              onChange={e => handleParamChange(index, 'refRangeFemale', e.target.value)}
                              placeholder="e.g. 4.0 - 10.0"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveParameter(index)}
                          className="mt-6 text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="labTestForm"
            className="btn-primary flex items-center"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Test
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LabTestFormModal;
