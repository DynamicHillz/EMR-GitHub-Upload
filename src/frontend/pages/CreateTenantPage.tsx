/**
 * Create Tenant Page
 * SUPER_ADMIN-only form for onboarding a new clinic + its first ADMIN user
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import tenantService, { CreateTenantDto } from '../services/tenant.service';
import ErrorAlert from '../components/common/ErrorAlert';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const CreateTenantPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  const [formData, setFormData] = useState<CreateTenantDto>({
    name: '',
    slug: '',
    clinicName: '',
    address: '',
    phone: '',
    email: '',
    licenseNumber: '',
    subscriptionTier: 'BASIC',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
    adminPhone: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Auto-derive the slug from the clinic name until the admin edits it directly.
      if (name === 'name' && !slugTouched) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugTouched(true);
    setFormData((prev) => ({ ...prev, slug: slugify(e.target.value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await tenantService.createTenant(formData);
      navigate('/tenants');
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.errors?.join(', ') || 'Failed to create clinic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboard New Clinic</h1>
            <p className="text-gray-600 mt-1">Create a new clinic and its first admin account</p>
          </div>
          <Link to="/tenants" className="btn btn-secondary">
            Cancel
          </Link>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            title="Clinic Creation Failed"
            severity="error"
            onDismiss={() => setError('')}
            className="mb-6"
          />
        )}

        <form onSubmit={handleSubmit} className="card">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Clinic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="input w-full" required disabled={loading} placeholder="St. Stephen Hospital" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="slug" value={formData.slug} onChange={handleSlugChange} className="input w-full" required disabled={loading} placeholder="st-stephen-hospital" />
                  <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and hyphens only</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clinic Display Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="clinicName" value={formData.clinicName} onChange={handleInputChange} className="input w-full" required disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                  <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleInputChange} className="input w-full" disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="input w-full" disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="input w-full" disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="input w-full" disabled={loading} />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">First Admin Account</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="adminFirstName" value={formData.adminFirstName} onChange={handleInputChange} className="input w-full" required disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="adminLastName" value={formData.adminLastName} onChange={handleInputChange} className="input w-full" required disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input type="email" name="adminEmail" value={formData.adminEmail} onChange={handleInputChange} className="input w-full" required disabled={loading} placeholder="admin@clinic.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" name="adminPhone" value={formData.adminPhone} onChange={handleInputChange} className="input w-full" disabled={loading} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temporary Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="adminPassword"
                    value={formData.adminPassword}
                    onChange={handleInputChange}
                    className="input w-full"
                    required
                    disabled={loading}
                    placeholder="Min. 8 characters"
                    minLength={8}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Must be at least 8 characters with uppercase, lowercase, number, and special character. The admin will be required to change it on first login.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Link to="/tenants" className="btn btn-secondary" tabIndex={-1}>
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Clinic'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTenantPage;
