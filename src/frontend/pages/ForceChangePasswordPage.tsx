import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getRoleHomePage } from '../contexts/AuthContext';
import authService from '../services/auth.service';
import ErrorAlert from '../components/common/ErrorAlert';

const ForceChangePasswordPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      return setError('New passwords do not match.');
    }

    if (currentPassword === newPassword) {
      return setError('New password must be different from the temporary password.');
    }

    // Basic password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return setError('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
    }

    setLoading(true);

    try {
      await authService.changePassword({
        currentPassword,
        newPassword
      });

      // Update local context user
      if (user) {
        const updatedUser = { ...user, requirePasswordChange: false };
        setUser(updatedUser);
        
        // Ensure local storage is also updated if it holds the user object
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        navigate(getRoleHomePage(user.role));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to change password. Please verify your temporary password is correct.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-xl border border-gray-100">
        <div>
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Action Required
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            For security reasons, you must change your temporary password before accessing the system.
          </p>
        </div>

        {error && <ErrorAlert message={error} />}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Temporary Password</label>
              <input
                type="password"
                required
                className="input mt-1"
                placeholder="Enter temporary password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                required
                className="input mt-1"
                placeholder="New strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
              <input
                type="password"
                required
                className="input mt-1"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Updating Password...' : 'Change Password & Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForceChangePasswordPage;
