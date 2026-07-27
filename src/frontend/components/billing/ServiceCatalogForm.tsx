/**
 * Service Catalog Form Component
 * Create and edit medical services
 */

import React, { useState, useEffect } from 'react';
import {
  ServiceCatalog,
  CreateServiceDto,
  UpdateServiceDto,
  ServiceCategory,
} from '../../types/billing.types';
import billingService from '../../services/billing.service';
import Dropdown from '../common/Dropdown';

interface ServiceCatalogFormProps {
  service?: ServiceCatalog;
  onSuccess?: (service: ServiceCatalog) => void;
  onCancel?: () => void;
}

const ServiceCatalogForm: React.FC<ServiceCatalogFormProps> = ({
  service,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<CreateServiceDto>({
    serviceCode: '',
    serviceName: '',
    description: '',
    category: ServiceCategory.CONSULTATION,
    basePrice: 0,
    taxRate: 7.5,
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (service) {
      setFormData({
        serviceCode: service.serviceCode,
        serviceName: service.serviceName,
        description: service.description,
        category: service.category,
        basePrice: service.basePrice,
        taxRate: service.taxRate,
        isActive: service.isActive,
      });
    }
  }, [service]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let result: ServiceCatalog;
      if (service) {
        // Update existing service
        const updateData: UpdateServiceDto = {
          serviceName: formData.serviceName,
          description: formData.description,
          category: formData.category,
          basePrice: formData.basePrice,
          taxRate: formData.taxRate,
          isActive: formData.isActive,
        };
        result = await billingService.updateService(service.id, updateData);
      } else {
        // Create new service
        result = await billingService.createService(formData);
      }
      onSuccess?.(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? parseFloat(value) || 0
          : type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900">
        {service ? 'Edit Service' : 'Create New Service'}
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Service Code */}
        <div>
          <label htmlFor="serviceCode" className="block text-sm font-medium text-gray-700">
            Service Code *
          </label>
          <input
            type="text"
            id="serviceCode"
            name="serviceCode"
            value={formData.serviceCode}
            onChange={handleChange}
            required
            disabled={!!service} // Cannot change service code after creation
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="e.g., CONSULT-001"
          />
        </div>

        {/* Service Name */}
        <div>
          <label htmlFor="serviceName" className="block text-sm font-medium text-gray-700">
            Service Name *
          </label>
          <input
            type="text"
            id="serviceName"
            name="serviceName"
            value={formData.serviceName}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., General Consultation"
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category *
          </label>
          <Dropdown
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="CONSULTATION">Consultation</option>
            <option value="LAB_TEST">Lab Test</option>
            <option value="MEDICATION">Medication</option>
            <option value="PROCEDURE">Procedure</option>
            <option value="IMAGING">Imaging</option>
            <option value="OTHER">Other</option>
          </Dropdown>
        </div>

        {/* Base Price */}
        <div>
          <label htmlFor="basePrice" className="block text-sm font-medium text-gray-700">
            Base Price (₦) *
          </label>
          <input
            type="number"
            id="basePrice"
            name="basePrice"
            value={formData.basePrice}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="0.00"
          />
        </div>

        {/* Tax Rate */}
        <div>
          <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700">
            Tax Rate (%)
          </label>
          <input
            type="number"
            id="taxRate"
            name="taxRate"
            value={formData.taxRate}
            onChange={handleChange}
            min="0"
            max="100"
            step="0.01"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="7.5"
          />
        </div>

        {/* Is Active */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            checked={formData.isActive}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
            Active
          </label>
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          placeholder="Optional description of the service"
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : service ? 'Update Service' : 'Create Service'}
        </button>
      </div>
    </form>
  );
};

export default ServiceCatalogForm;
