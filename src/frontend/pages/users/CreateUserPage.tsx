/**
 * Create User Page
 * Form for creating new users
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/auth.service';
import { CreateUserDto } from '../../types/auth.types';
import ErrorAlert from '../../components/common/ErrorAlert';
import Dropdown from '../../components/common/Dropdown';

const CreateUserPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<CreateUserDto>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'RECEPTIONIST',
    tenantId: currentUser?.tenantId || 'default-tenant',
    sendWelcomeEmail: true,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.createUser(formData);
      navigate('/users');
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.errors?.join(', ') || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New User</h1>
            <p className="text-gray-600 mt-1">Add a new user to the system</p>
          </div>
          <Link to="/users" className="btn btn-secondary">
            Cancel
          </Link>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            title="User Creation Failed"
            severity="error"
            onDismiss={() => setError('')}
            className="mb-6"
          />
        )}

        <form onSubmit={handleSubmit} className="card">
          <div className="space-y-6">
            {/* Personal Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="input w-full"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="input w-full"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input w-full"
                    required
                    disabled={loading}
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input w-full"
                    disabled={loading}
                    placeholder="+1234567890"
                  />
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <Dropdown
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="input w-full"
                    required
                    disabled={loading}
                  >
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temporary Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="input w-full"
                    required
                    disabled={loading}
                    placeholder="Min. 8 characters"
                    minLength={8}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Must be at least 8 characters with uppercase, lowercase, number, and special character
                  </p>
                </div>
              </div>
            </div>

            {/* Email Notification */}
            <div>
              <div className="flex items-center">
                <input
                  id="sendWelcomeEmail"
                  type="checkbox"
                  name="sendWelcomeEmail"
                  checked={formData.sendWelcomeEmail}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  disabled={loading}
                />
                <label htmlFor="sendWelcomeEmail" className="ml-2 block text-sm text-gray-700">
                  Send welcome email with login credentials
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Link to="/users" className="btn btn-secondary" tabIndex={-1}>
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserPage;
