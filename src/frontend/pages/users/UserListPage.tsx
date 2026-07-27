/**
 * User List Page
 * Displays all users with filters and actions
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/auth.service';
import { formatDate } from '../../utils/formatters';
import { User, UserFilters } from '../../types/auth.types';
import ErrorAlert from '../../components/common/ErrorAlert';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import Dropdown from '../../components/common/Dropdown';

const UserListPage: React.FC = () => {
  const { user: currentUser, hasRole } = useAuth();
  const { confirm, isOpen, options, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [total, setTotal] = useState(0);

  // Filters
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    role: '',
    status: '',
    limit: 50,
    offset: 0,
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await authService.getUsers(filters);
      setUsers(response.users);
      setTotal(response.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load users');
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value, offset: 0 });
    setCurrentPage(1);
  };

  const handleRoleFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, role: e.target.value, offset: 0 });
    setCurrentPage(1);
  };

  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, status: e.target.value, offset: 0 });
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    const newOffset = (page - 1) * itemsPerPage;
    setFilters({ ...filters, offset: newOffset });
    setCurrentPage(page);
  };

  const handleDeactivate = async (userId: string) => {
    const confirmed = await confirm({
      title: 'Deactivate User',
      message: 'Are you sure you want to deactivate this user? They will no longer be able to access the system.',
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      setError('');
      setSuccessMessage('');
      await authService.deactivateUser(userId);
      setSuccessMessage('User deactivated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchUsers(); // Refresh list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  const handleSuspend = async (userId: string) => {
    const confirmed = await confirm({
      title: 'Suspend User',
      message: 'Are you sure you want to suspend this user? They will be temporarily locked out of the system.',
      confirmText: 'Suspend',
      cancelText: 'Cancel',
      variant: 'warning',
    });

    if (!confirmed) return;

    try {
      setError('');
      setSuccessMessage('');
      await authService.suspendUser(userId);
      setSuccessMessage('User suspended successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchUsers(); // Refresh list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to suspend user');
    }
  };

  const handleReactivate = async (userId: string) => {
    const confirmed = await confirm({
      title: 'Reactivate User',
      message: 'Are you sure you want to reactivate this user? They will regain access to the system.',
      confirmText: 'Reactivate',
      cancelText: 'Cancel',
      variant: 'success',
    });

    if (!confirmed) return;

    try {
      setError('');
      setSuccessMessage('');
      await authService.reactivateUser(userId);
      setSuccessMessage('User reactivated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchUsers(); // Refresh list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reactivate user');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'DOCTOR':
        return 'bg-blue-100 text-blue-800';
      case 'NURSE':
        return 'bg-teal-100 text-teal-800';
      case 'PHARMACIST':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalPages = Math.ceil(total / itemsPerPage);
  const canManageUsers = hasRole(['SUPER_ADMIN', 'ADMIN']);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage system users and permissions</p>
        </div>
        {hasRole(['SUPER_ADMIN', 'ADMIN']) && (
          <Link to="/users/new" className="btn btn-primary">
            + Add User
          </Link>
        )}
      </div>

      {/* Error/Success Alerts */}
      {error && (
        <div className="mb-4">
          <ErrorAlert
            message={error}
            severity="error"
            onDismiss={() => setError('')}
          />
        </div>
      )}

      {successMessage && (
        <div className="mb-4">
          <ErrorAlert
            message={successMessage}
            severity="info"
            onDismiss={() => setSuccessMessage('')}
          />
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={handleSearch}
              className="input w-full"
            />
          </div>
          <div>
            <Dropdown value={filters.role} onChange={handleRoleFilter} className="input w-full">
              <option value="">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="DOCTOR">Doctor</option>
              <option value="NURSE">Nurse</option>
              <option value="PHARMACIST">Pharmacist</option>
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="CASHIER">Cashier</option>
              <option value="LAB_TECH">Lab Technician</option>
            </Dropdown>
          </div>
          <div>
            <Dropdown value={filters.status} onChange={handleStatusFilter} className="input w-full">
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Users Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    {canManageUsers && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-primary-600 font-medium">
                                {user.firstName[0]}
                                {user.lastName[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeClass(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                            user.status
                          )}`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLogin
                          ? formatDate(user.lastLogin)
                          : 'Never'}
                      </td>
                      {canManageUsers && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Link
                              to={`/users/${user.id}`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              View
                            </Link>
                            {user.status === 'ACTIVE' && user.id !== currentUser?.id && (
                              <>
                                <button
                                  onClick={() => handleSuspend(user.id)}
                                  className="text-yellow-600 hover:text-yellow-900"
                                >
                                  Suspend
                                </button>
                                <button
                                  onClick={() => handleDeactivate(user.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Deactivate
                                </button>
                              </>
                            )}
                            {(user.status === 'INACTIVE' || user.status === 'SUSPENDED') && (
                              <button
                                onClick={() => handleReactivate(user.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, total)} of {total} results
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm Dialog */}
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

export default UserListPage;
