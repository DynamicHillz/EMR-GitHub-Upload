/**
 * Tenants Page
 * SUPER_ADMIN-only clinic (tenant) management — list + suspend/reactivate
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import tenantService, { Tenant } from '../services/tenant.service';
import { formatDate } from '../utils/formatters';
import ErrorAlert from '../components/common/ErrorAlert';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';

const TenantsPage: React.FC = () => {
  const { confirm, isOpen, options, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');

  const fetchTenants = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await tenantService.listTenants({ search: search || undefined });
      setTenants(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTenants();
  };

  const handleStatusChange = async (tenant: Tenant, newStatus: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE') => {
    const verb = newStatus === 'ACTIVE' ? 'reactivate' : newStatus === 'SUSPENDED' ? 'suspend' : 'deactivate';
    const confirmed = await confirm({
      title: `${verb.charAt(0).toUpperCase() + verb.slice(1)} Clinic`,
      message:
        newStatus === 'ACTIVE'
          ? `Reactivate "${tenant.clinicName}"? Its users will be able to log in again immediately.`
          : `${verb.charAt(0).toUpperCase() + verb.slice(1)} "${tenant.clinicName}"? All of its users will be logged out and unable to log back in until it's reactivated.`,
      confirmText: verb.charAt(0).toUpperCase() + verb.slice(1),
      cancelText: 'Cancel',
      variant: newStatus === 'ACTIVE' ? 'success' : 'danger',
    });

    if (!confirmed) return;

    try {
      setError('');
      setSuccessMessage('');
      await tenantService.updateTenantStatus(tenant.id, newStatus);
      setSuccessMessage(`${tenant.clinicName} is now ${newStatus.toLowerCase()}.`);
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchTenants();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to update ${tenant.clinicName}`);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'SUSPENDED':
        return 'bg-yellow-100 text-yellow-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinics (Tenants)</h1>
          <p className="text-gray-600 mt-1">Onboard and manage every clinic on this platform</p>
        </div>
        <Link to="/tenants/new" className="btn btn-primary">
          + New Clinic
        </Link>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} severity="error" onDismiss={() => setError('')} />
        </div>
      )}
      {successMessage && (
        <div className="mb-4">
          <ErrorAlert message={successMessage} severity="info" onDismiss={() => setSuccessMessage('')} />
        </div>
      )}

      <form onSubmit={handleSearchSubmit} className="card mb-6">
        <input
          type="text"
          placeholder="Search by name, clinic name, or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full"
        />
      </form>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No clinics found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clinic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{tenant.clinicName}</div>
                      <div className="text-sm text-gray-500">{tenant.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(tenant.status)}`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.subscriptionTier}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant._count?.users ?? '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(tenant.createdAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {tenant.status === 'ACTIVE' && (
                          <>
                            <button onClick={() => handleStatusChange(tenant, 'SUSPENDED')} className="text-yellow-600 hover:text-yellow-900">
                              Suspend
                            </button>
                            <button onClick={() => handleStatusChange(tenant, 'INACTIVE')} className="text-red-600 hover:text-red-900">
                              Deactivate
                            </button>
                          </>
                        )}
                        {tenant.status !== 'ACTIVE' && (
                          <button onClick={() => handleStatusChange(tenant, 'ACTIVE')} className="text-green-600 hover:text-green-900">
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        loading={confirmLoading}
      />
    </div>
  );
};

export default TenantsPage;
