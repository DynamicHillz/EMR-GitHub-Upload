/**
 * User Detail/Edit Page
 * View and edit user details
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/auth.service';
import { User, UpdateUserDto, UserSession } from '../../types/auth.types';
import Dropdown from '../../components/common/Dropdown';

const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, hasRole } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [resetPasswordInfo, setResetPasswordInfo] = useState<{ temporaryPassword?: string; note?: string } | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<UpdateUserDto>({
    firstName: '',
    lastName: '',
    phone: '',
    role: '',
    status: '',
  });

  useEffect(() => {
    if (id) {
      fetchUser();
      if (hasRole(['SUPER_ADMIN', 'ADMIN'])) {
        fetchSessions();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      const response = await authService.listUserSessions(id!);
      setSessions(response.sessions);
    } catch (err) {
      console.error('Fetch sessions error:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await authService.revokeUserSession(id!, sessionId);
      fetchSessions();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to revoke session');
    }
  };

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await authService.getUser(id!);
      const userData = response.data?.user || response.user;
      setUser(userData as any);
      setFormData({
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone || '',
        role: userData.role,
        status: userData.status,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load user');
      console.error('Fetch user error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await authService.updateUser(id!, formData);
      setSuccess('User updated successfully');
      setIsEditing(false);
      fetchUser(); // Refresh data
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    try {
      await authService.deactivateUser(id!);
      setSuccess('User deactivated successfully');
      fetchUser();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  const handleSuspend = async () => {
    if (!window.confirm('Are you sure you want to suspend this user?')) {
      return;
    }

    try {
      await authService.suspendUser(id!);
      setSuccess('User suspended successfully');
      fetchUser();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to suspend user');
    }
  };

  const handleReactivate = async () => {
    if (!window.confirm('Are you sure you want to reactivate this user?')) {
      return;
    }

    try {
      await authService.reactivateUser(id!);
      setSuccess('User reactivated successfully');
      fetchUser();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reactivate user');
    }
  };

  const handleResetPassword = async () => {
    if (!window.confirm("Are you sure you want to force-reset this user's password?")) {
      return;
    }

    try {
      setResetPasswordInfo(null);
      const response = await authService.forceResetPassword(id!);
      setSuccess(response.message || 'Password force-reset successfully');
      setResetPasswordInfo({
        temporaryPassword: response.temporaryPassword,
        note: response.note,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to force reset password');
    }
  };

  const canEdit = hasRole(['SUPER_ADMIN', 'ADMIN']) || currentUser?.id === id;
  const canManage = hasRole(['SUPER_ADMIN', 'ADMIN']);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="card">
          <p className="text-red-600">User not found</p>
          <Link to="/users" className="btn btn-secondary mt-4">
            Back to Users
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Details</h1>
          <p className="text-gray-600 mt-1">
            {user.firstName} {user.lastName}
          </p>
        </div>
        <div className="flex space-x-2">
          <Link to="/users" className="btn btn-secondary">
            Back
          </Link>
          {canEdit && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="btn btn-primary">
              Edit User
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}
      {resetPasswordInfo && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-bold text-blue-800">Temporary Password Generated</p>
          <p className="text-sm text-blue-600 mt-2">
            Password: <span className="font-mono bg-blue-100 px-2 py-1 rounded">{resetPasswordInfo.temporaryPassword}</span>
          </p>
          {resetPasswordInfo.note && (
            <p className="text-xs text-blue-500 mt-2 italic">{resetPasswordInfo.note}</p>
          )}
        </div>
      )}

      {/* User Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {isEditing ? 'Edit Information' : 'Information'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="input w-full"
                    />
                  ) : (
                    <p className="text-gray-900">{user.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="input w-full"
                    />
                  ) : (
                    <p className="text-gray-900">{user.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900">{user.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input w-full"
                  />
                ) : (
                  <p className="text-gray-900">{user.phone || 'Not provided'}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  {isEditing && canManage ? (
                    <Dropdown
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="input w-full"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="DOCTOR">Doctor</option>
                      <option value="NURSE">Nurse</option>
                      <option value="PHARMACIST">Pharmacist</option>
                      <option value="RECEPTIONIST">Receptionist</option>
                      <option value="CASHIER">Cashier</option>
                      <option value="LAB_TECH">Lab Technician</option>
                    </Dropdown>
                  ) : (
                    <p className="text-gray-900">{user.role}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {isEditing && canManage ? (
                    <Dropdown
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="input w-full"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SUSPENDED">Suspended</option>
                    </Dropdown>
                  ) : (
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : user.status === 'SUSPENDED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      firstName: user.firstName,
                      lastName: user.lastName,
                      phone: user.phone || '',
                      role: user.role,
                      status: user.status,
                    });
                  }}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Activity */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">Last Login</p>
                <p className="text-gray-900">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Created</p>
                <p className="text-gray-900">{new Date(user.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Last Updated</p>
                <p className="text-gray-900">{new Date(user.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Active Sessions */}
          {canManage && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Sessions</h2>
              {sessionsLoading ? (
                <p className="text-sm text-gray-500">Loading sessions...</p>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-gray-500">No active sessions.</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-start justify-between gap-3 text-sm border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-gray-900 truncate" title={session.userAgent || undefined}>
                          {session.userAgent || 'Unknown device'}
                        </p>
                        <p className="text-gray-500">{session.ipAddress || 'Unknown IP'}</p>
                        <p className="text-xs text-gray-400">
                          Signed in {new Date(session.createdAt).toLocaleString()} · Expires {new Date(session.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        className="text-red-600 hover:text-red-900 text-xs font-medium flex-shrink-0"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {canManage && user.id !== currentUser?.id && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-2">
                {user.status === 'ACTIVE' && (
                  <>
                    <button onClick={handleSuspend} className="btn btn-warning w-full">
                      Suspend User
                    </button>
                    <button onClick={handleDeactivate} className="btn btn-danger w-full">
                      Deactivate User
                    </button>
                  </>
                )}
                {(user.status === 'INACTIVE' || user.status === 'SUSPENDED') && (
                  <button onClick={handleReactivate} className="btn btn-success w-full">
                    Reactivate User
                  </button>
                )}
                <div className="border-t border-gray-200 my-4 pt-4">
                  <button onClick={handleResetPassword} className="btn w-full bg-blue-600 hover:bg-blue-700 text-white">
                    Force Reset Password
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetailPage;
