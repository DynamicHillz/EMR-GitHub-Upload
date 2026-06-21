/**
 * Service Catalog Page
 * Main page for managing medical services pricing catalog
 */

import React, { useState } from 'react';
import { ServiceCatalog } from '../../types/billing.types';
import ServiceCatalogList from '../../components/billing/ServiceCatalogList';
import ServiceCatalogForm from '../../components/billing/ServiceCatalogForm';

const ServiceCatalogPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceCatalog | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreate = () => {
    setSelectedService(undefined);
    setShowForm(true);
  };

  const handleEdit = (service: ServiceCatalog) => {
    setSelectedService(service);
    setShowForm(true);
  };

  const handleSuccess = () => {
    setShowForm(false);
    setSelectedService(undefined);
    setRefreshKey((prev) => prev + 1); // Trigger list refresh
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedService(undefined);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Service Catalog</h1>
          <p className="text-gray-600 mt-1">Manage medical services and pricing</p>
        </div>
        {!showForm && (
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            + Add Service
          </button>
        )}
      </div>

      {showForm ? (
        <ServiceCatalogForm
          service={selectedService}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      ) : (
        <ServiceCatalogList
          key={refreshKey}
          onEditService={handleEdit}
        />
      )}
    </div>
  );
};

export default ServiceCatalogPage;
