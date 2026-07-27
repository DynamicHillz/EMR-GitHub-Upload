import React, { useState, useEffect } from 'react'; 
import { formatCurrency, formatBloodGroup } from '../utils/formatters';
import { useLocation } from 'react-router-dom';
import { CheckCircle, Shield, AlertTriangle, Lock } from 'lucide-react';

export const VerificationPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedData, setVerifiedData] = useState<any>(null);

  // Extract token from URL
  const location = useLocation();
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError('No verification token found in URL.');
    }
  }, [location]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`}/api/verification/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, pin }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setVerifiedData(data.data);
      } else {
        setError(data.message || 'Verification failed. Please check the PIN.');
      }
    } catch (err: any) {
      setError('Network error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  if (!token && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-pulse flex items-center text-primary-600">
          <Shield className="w-8 h-8 mr-2" />
          <span className="text-xl font-semibold">Initializing secure portal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-primary-700 p-6 text-center text-white">
          <Shield className="w-12 h-12 mx-auto mb-3 text-primary-200" />
          <h1 className="text-2xl font-bold">Secure Document Verification</h1>
          <p className="text-primary-200 text-sm mt-1">St. Stephen Medical Centre</p>
        </div>

        <div className="p-6">
          {error && !verifiedData && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 mb-6">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {!verifiedData ? (
            <form onSubmit={handleVerify}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="w-4 h-4 inline mr-1 text-gray-400" />
                  Verification PIN (Patient Date of Birth)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  To protect patient privacy, please enter the patient's Date of Birth (YYYY-MM-DD) to unlock this document.
                </p>
                <input
                  type="date"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-primary-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying...' : 'Verify Document Authenticity'}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg border border-green-100">
                <CheckCircle className="w-6 h-6" />
                <span className="font-bold text-lg">VERIFIED AUTHENTIC</span>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-4">
                  Canonical Document Data
                </h3>
                
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-3">
                    <span className="text-gray-500 col-span-1">Doc Type:</span>
                    <span className="font-medium text-gray-900 col-span-2">{verifiedData.type}</span>
                  </div>
                  <div className="grid grid-cols-3">
                    <span className="text-gray-500 col-span-1">Patient:</span>
                    <span className="font-medium text-gray-900 col-span-2">{verifiedData.patientName}</span>
                  </div>
                  
                  {verifiedData.type === 'INVOICE' && (
                    <>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500 col-span-1">Invoice #:</span>
                        <span className="font-medium text-gray-900 col-span-2">{verifiedData.invoiceNumber}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500 col-span-1">Total:</span>
                        <span className="font-medium text-gray-900 col-span-2">{formatCurrency(verifiedData.totalAmount)}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500 col-span-1">Status:</span>
                        <span className={`font-semibold col-span-2 ${
                          verifiedData.status === 'PAID' ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {verifiedData.status}
                        </span>
                      </div>
                    </>
                  )}

                  {verifiedData.type === 'PATIENT' && (
                    <>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500 col-span-1">Patient ID:</span>
                        <span className="font-medium text-gray-900 col-span-2">{verifiedData.patientId}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500 col-span-1">Gender:</span>
                        <span className="font-medium text-gray-900 col-span-2">{verifiedData.gender}</span>
                      </div>
                      <div className="grid grid-cols-3">
                        <span className="text-gray-500 col-span-1">Blood Group:</span>
                        <span className="font-medium text-gray-900 col-span-2">{formatBloodGroup(verifiedData.bloodGroup) || 'N/A'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setVerifiedData(null);
                  setPin('');
                }}
                className="w-full mt-6 bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Scan Another Document
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="mt-8 text-sm text-gray-400">
        This portal cryptographically verifies documents generated by {verifiedData?.clinicName || 'St. Stephen Medical Centre'}.
      </p>
    </div>
  );
};

export default VerificationPage;
