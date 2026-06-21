import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import ErrorAlert from '../components/common/ErrorAlert';

interface BrandingSettings {
  clinicName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [branding, setBranding] = useState<BrandingSettings | null>(null);

  const { login } = useAuth();

  // Fetch branding settings on mount (no auth required for login page)
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/branding/public');
        if (response.ok) {
          const result = await response.json();
          setBranding(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch branding:', error);
        // Use defaults if branding fetch fails
      }
    };
    fetchBranding();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Only include tenantId if provided
      const loginData: any = { email, password, rememberMe };
      if (tenantId) {
        loginData.tenantId = tenantId;
      }
      await login(loginData);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic background gradient based on branding colors
  const bgGradient = branding?.primaryColor
    ? `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.secondaryColor || branding.primaryColor})`
    : 'linear-gradient(to bottom right, rgb(37, 99, 235), rgb(30, 64, 175))'; // Default blue

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bgGradient }}>
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
        <div className="text-center mb-8">
          {/* Logo */}
          {branding?.logoUrl && (
            <div className="mb-4 flex justify-center">
              <img
                src={branding.logoUrl}
                alt="Clinic Logo"
                className="max-h-20 object-contain"
                onError={(e) => {
                  console.error('Logo failed to load');
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          {/* Clinic Name */}
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: branding?.primaryColor || 'rgb(37, 99, 235)' }}
          >
            {branding?.clinicName || 'SSMC EMR'}
          </h1>
          <p className="text-gray-600">Electronic Medical Records System</p>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            title="Login Failed"
            severity="error"
            onDismiss={() => setError('')}
            className="mb-6"
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="doctor@clinic.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                disabled={loading}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                Remember me
              </label>
            </div>

            <Link
              to="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="w-full px-4 py-3 text-white font-semibold rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: branding?.primaryColor || 'rgb(37, 99, 235)' }}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t text-center text-sm text-gray-600">
          Works offline • Syncs automatically
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
