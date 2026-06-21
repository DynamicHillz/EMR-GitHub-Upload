/**
 * Service Catalog List Component
 * Displays and manages medical services pricing catalog
 */

import React, { useState, useEffect } from 'react';
import {
  ServiceCatalog,
  ServiceCategory,
  ServiceCatalogFilters,
} from '../../types/billing.types';
import billingService from '../../services/billing.service';
import ErrorAlert from '../common/ErrorAlert';

interface ServiceCatalogListProps {
  onSelectService?: (service: ServiceCatalog) => void;
  onEditService?: (service: ServiceCatalog) => void;
}

const ServiceCatalogList: React.FC<ServiceCatalogListProps> = ({
  onSelectService,
  onEditService,
}) => {
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const [filters, setFilters] = useState<ServiceCatalogFilters>({
    isActive: true,
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadServices();
  }, [filters]);

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await billingService.getServices(filters);
      setServices(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      setActionError('');
      await billingService.deleteService(id);
      loadServices();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to delete service');
    }
  };

  const handleToggleActive = async (service: ServiceCatalog) => {
    try {
      setActionError('');
      await billingService.updateService(service.id, {
        isActive: !service.isActive,
      });
      loadServices();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to update service');
    }
  };

  const filteredServices = services.filter((service) =>
    service.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.serviceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const getCategoryColor = (category: ServiceCategory) => {
    const colors = {
      CONSULTATION: 'bg-blue-100 text-blue-800',
      LAB_TEST: 'bg-purple-100 text-purple-800',
      MEDICATION: 'bg-green-100 text-green-800',
      PROCEDURE: 'bg-orange-100 text-orange-800',
      IMAGING: 'bg-pink-100 text-pink-800',
      OTHER: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.OTHER;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Error Alert */}
      {actionError && (
        <div className="mb-4">
          <ErrorAlert
            message={actionError}
            severity="error"
            onDismiss={() => setActionError('')}
          />
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={filters.category || ''}
          onChange={(e) =>
            setFilters({ ...filters, category: e.target.value as ServiceCategory || undefined })
          }
          className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Categories</option>
          <option value="CONSULTATION">Consultation</option>
          <option value="LAB_TEST">Lab Test</option>
          <option value="MEDICATION">Medication</option>
          <option value="PROCEDURE">Procedure</option>
          <option value="IMAGING">Imaging</option>
          <option value="OTHER">Other</option>
        </select>
        <select
          value={filters.isActive === undefined ? '' : filters.isActive.toString()}
          onChange={(e) =>
            setFilters({
              ...filters,
              isActive: e.target.value === '' ? undefined : e.target.value === 'true',
            })
          }
          className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Services Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Base Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tax Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredServices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No services found. Create your first service to get started.
                </td>
              </tr>
            ) : (
              filteredServices.map((service) => (
                <tr
                  key={service.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onSelectService?.(service)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {service.serviceCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{service.serviceName}</div>
                      {service.description && (
                        <div className="text-gray-500 text-xs">{service.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getCategoryColor(
                        service.category
                      )}`}
                    >
                      {service.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(service.basePrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.taxRate}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        service.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {service.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditService?.(service);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(service);
                      }}
                      className="text-yellow-600 hover:text-yellow-900"
                    >
                      {service.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(service.id);
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <div>
          Showing {filteredServices.length} of {services.length} services
        </div>
        <button
          onClick={loadServices}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default ServiceCatalogList;
