import React, { useState } from 'react';
import { Network, RefreshCw, CheckCircle, AlertTriangle, Code, ExternalLink } from 'lucide-react';
import Dropdown from '../components/common/Dropdown';
import { getErrorMessage } from '../utils/errorHandler';

const InteroperabilityPage: React.FC = () => {
  // Force HMR recompile
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`}/api/interoperability/dhis2/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync with DHIS2');
      }
      
      setSyncResult(data);
    } catch (err: any) {
      setSyncError(getErrorMessage(err, 'Failed to sync with DHIS2'));
    } finally {
      setSyncing(false);
    }
  };

  const currentHost = window.location.origin;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Network className="w-7 h-7 text-primary-600" />
          Interoperability & External Reporting
        </h1>
        <p className="text-gray-600 mt-2">Manage data exchange with external health information systems (DHIS2 & FHIR).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* DHIS2 Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-green-600" />
              DHIS2 Aggregate Sync
            </h2>
            <p className="text-sm text-gray-500 mt-1">Push monthly aggregated clinic data to the national DHIS2 instance.</p>
          </div>
          
          <div className="p-6">
            <div className="flex items-end gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <Dropdown
                  className="w-32 px-3 py-2 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </Dropdown>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  className="w-24 px-3 py-2 rounded-lg border-2 border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                />
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {syncing ? 'Syncing...' : 'Push to DHIS2'}
              </button>
            </div>

            {syncError && (
              <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">Sync Failed</h4>
                  <p className="text-sm">{syncError}</p>
                </div>
              </div>
            )}

            {syncResult && (
              <div className="mb-4 p-4 bg-green-50 text-green-800 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold">Sync Successful</h4>
                </div>
                <p className="text-sm mb-3">Pushed data for period: {syncResult.period}</p>
                <div className="bg-white p-3 rounded border border-green-100 overflow-x-auto text-xs font-mono">
                  <pre>{JSON.stringify(syncResult.payload.dataValues, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FHIR API Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-blue-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Code className="w-5 h-5 text-blue-600" />
              HL7 FHIR (R4) Endpoints
            </h2>
            <p className="text-sm text-gray-500 mt-1">Standardized API for third-party integrations.</p>
          </div>
          
          <div className="p-6 space-y-6">
            <p className="text-sm text-gray-600">
              The EMR exposes a subset of read-only FHIR R4 resources for secure patient data exchange.
              These endpoints require a valid Bearer token for authentication.
            </p>

            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded">GET</span>
                  <a href="#" className="text-xs text-primary-600 flex items-center gap-1 hover:underline">Documentation <ExternalLink className="w-3 h-3"/></a>
                </div>
                <p className="font-mono text-sm text-gray-800 mb-1">{currentHost}/api/interoperability/fhir/Patient/[id]</p>
                <p className="text-xs text-gray-500">Retrieves a Patient resource mapped to the FHIR R4 standard.</p>
              </div>

              {/* Placeholder for future endpoints */}
              <div className="border rounded-lg p-4 bg-gray-50 opacity-60">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded">GET</span>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Coming Soon</span>
                </div>
                <p className="font-mono text-sm text-gray-800 mb-1">{currentHost}/api/interoperability/fhir/Encounter</p>
                <p className="text-xs text-gray-500">Retrieves consultation encounters.</p>
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
};

export default InteroperabilityPage;
