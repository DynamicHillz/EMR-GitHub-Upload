import React, { useState, useEffect } from 'react';
import { Network, RefreshCw, CheckCircle, AlertTriangle, Code, ExternalLink, Settings, History, XCircle } from 'lucide-react';
import Dropdown from '../components/common/Dropdown';
import { getErrorMessage } from '../utils/errorHandler';

interface Dhis2Config {
  dhis2Enabled: boolean;
  dhis2BaseUrl: string | null;
  dhis2Username: string | null;
  dhis2PasswordSet: boolean;
  dhis2OrgUnitId: string | null;
  dhis2DataElementTotalVisits: string | null;
  dhis2DataElementPediatricUnder5: string | null;
  dhis2DataElementSevereMalnutrition: string | null;
  dhis2DataElementLiveBirths: string | null;
  dhis2DataElementSeverePostpartumHemorrhage: string | null;
  dhis2CategoryOptionCombo: string | null;
}

interface Dhis2SyncLogEntry {
  id: string;
  period: string;
  status: string;
  responseSummary: any;
  createdAt: string;
  triggeredBy?: { firstName: string; lastName: string };
}

const API_BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

// Statuses the backend can return for a sync attempt — matches
// Dhis2Client's Dhis2PushResult reasons plus DHIS2's own SUCCESS/WARNING.
const STATUS_STYLES: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  SUCCESS: { label: 'Success', className: 'bg-green-50 text-green-800 border-green-200', icon: <CheckCircle className="w-5 h-5 text-green-600" /> },
  WARNING: { label: 'Warning', className: 'bg-yellow-50 text-yellow-800 border-yellow-200', icon: <AlertTriangle className="w-5 h-5 text-yellow-600" /> },
  REJECTED: { label: 'Rejected by DHIS2', className: 'bg-red-50 text-red-800 border-red-200', icon: <XCircle className="w-5 h-5 text-red-600" /> },
  AUTH_ERROR: { label: 'Authentication failed', className: 'bg-red-50 text-red-800 border-red-200', icon: <XCircle className="w-5 h-5 text-red-600" /> },
  NETWORK_ERROR: { label: 'Could not reach DHIS2', className: 'bg-red-50 text-red-800 border-red-200', icon: <XCircle className="w-5 h-5 text-red-600" /> },
  NOT_CONFIGURED: { label: 'Not configured', className: 'bg-gray-50 text-gray-700 border-gray-200', icon: <AlertTriangle className="w-5 h-5 text-gray-500" /> },
};

const statusBadge = (status: string) => {
  const style = STATUS_STYLES[status] || { label: status, className: 'bg-gray-50 text-gray-700 border-gray-200', icon: null };
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${style.className}`}>
      {style.label}
    </span>
  );
};

const InteroperabilityPage: React.FC = () => {
  // ==================== DHIS2 Configuration ====================
  const [config, setConfig] = useState<Dhis2Config | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/interoperability/dhis2/config`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load DHIS2 configuration');
      setConfig(data);
    } catch (err: any) {
      setConfigError(getErrorMessage(err, 'Failed to load DHIS2 configuration'));
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateConfigField = <K extends keyof Dhis2Config>(key: K, value: Dhis2Config[K]) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setConfigSaving(true);
    setConfigError(null);
    setConfigSaved(false);
    try {
      const res = await fetch(`${API_BASE}/api/interoperability/dhis2/config`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          dhis2Enabled: config.dhis2Enabled,
          dhis2BaseUrl: config.dhis2BaseUrl,
          dhis2Username: config.dhis2Username,
          ...(passwordInput.trim() ? { dhis2Password: passwordInput.trim() } : {}),
          dhis2OrgUnitId: config.dhis2OrgUnitId,
          dhis2DataElementTotalVisits: config.dhis2DataElementTotalVisits,
          dhis2DataElementPediatricUnder5: config.dhis2DataElementPediatricUnder5,
          dhis2DataElementSevereMalnutrition: config.dhis2DataElementSevereMalnutrition,
          dhis2DataElementLiveBirths: config.dhis2DataElementLiveBirths,
          dhis2DataElementSeverePostpartumHemorrhage: config.dhis2DataElementSeverePostpartumHemorrhage,
          dhis2CategoryOptionCombo: config.dhis2CategoryOptionCombo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save DHIS2 configuration');
      setConfig(data);
      setPasswordInput('');
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err: any) {
      setConfigError(getErrorMessage(err, 'Failed to save DHIS2 configuration'));
    } finally {
      setConfigSaving(false);
    }
  };

  // ==================== Sync ====================
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
      const response = await fetch(`${API_BASE}/api/interoperability/dhis2/sync`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ month: selectedMonth, year: selectedYear }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync with DHIS2');
      }

      setSyncResult(data);
      fetchHistory();
    } catch (err: any) {
      setSyncError(getErrorMessage(err, 'Failed to sync with DHIS2'));
    } finally {
      setSyncing(false);
    }
  };

  // ==================== Sync History ====================
  const [history, setHistory] = useState<Dhis2SyncLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/interoperability/dhis2/history`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setHistory(data);
    } catch {
      // Non-critical — history is a convenience view, don't block the page on it.
    } finally {
      setHistoryLoading(false);
    }
  };

  const currentHost = window.location.origin;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Network className="w-7 h-7 text-primary-600" />
          Interoperability & External Reporting
        </h1>
        <p className="text-gray-600 mt-2">Manage data exchange with external health information systems (DHIS2 & FHIR).</p>
      </div>

      {/* DHIS2 Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            DHIS2 Configuration
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Connection details and metadata mapping for this clinic's DHIS2 instance — every clinic may report to a
            different DHIS2 server with different org unit and data element IDs.
          </p>
        </div>

        <div className="p-6">
          {configLoading ? (
            <p className="text-sm text-gray-500">Loading configuration...</p>
          ) : config ? (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={config.dhis2Enabled}
                  onChange={(e) => updateConfigField('dhis2Enabled', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Enable DHIS2 sync for this clinic
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DHIS2 Base URL</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="https://your-dhis2-instance.org"
                    value={config.dhis2BaseUrl || ''}
                    onChange={(e) => updateConfigField('dhis2BaseUrl', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={config.dhis2Username || ''}
                    onChange={(e) => updateConfigField('dhis2Username', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    className="input w-full"
                    placeholder={config.dhis2PasswordSet ? '•••••••• (configured — leave blank to keep)' : 'Enter password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Org Unit ID</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="This clinic's real DHIS2 org unit UID"
                    value={config.dhis2OrgUnitId || ''}
                    onChange={(e) => updateConfigField('dhis2OrgUnitId', e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Data Element Mapping</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Outpatient Visits — Data Element UID</label>
                    <input
                      type="text"
                      className="input w-full"
                      value={config.dhis2DataElementTotalVisits || ''}
                      onChange={(e) => updateConfigField('dhis2DataElementTotalVisits', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pediatric Under-5 Visits — Data Element UID</label>
                    <input
                      type="text"
                      className="input w-full"
                      value={config.dhis2DataElementPediatricUnder5 || ''}
                      onChange={(e) => updateConfigField('dhis2DataElementPediatricUnder5', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Severe Acute Malnutrition Cases — Data Element UID</label>
                    <input
                      type="text"
                      className="input w-full"
                      value={config.dhis2DataElementSevereMalnutrition || ''}
                      onChange={(e) => updateConfigField('dhis2DataElementSevereMalnutrition', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Live Births — Data Element UID (optional)</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Leave blank to skip this metric"
                      value={config.dhis2DataElementLiveBirths || ''}
                      onChange={(e) => updateConfigField('dhis2DataElementLiveBirths', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Severe Postpartum Hemorrhage — Data Element UID (optional)</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Leave blank to skip this metric"
                      value={config.dhis2DataElementSeverePostpartumHemorrhage || ''}
                      onChange={(e) => updateConfigField('dhis2DataElementSeverePostpartumHemorrhage', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category Option Combo UID</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Applied to all data values above"
                      value={config.dhis2CategoryOptionCombo || ''}
                      onChange={(e) => updateConfigField('dhis2CategoryOptionCombo', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {configError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{configError}</div>
              )}
              {configSaved && (
                <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">Configuration saved.</div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  disabled={configSaving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {configSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-600">{configError || 'Could not load configuration.'}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* DHIS2 Sync */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-green-600" />
              DHIS2 Aggregate Sync
            </h2>
            <p className="text-sm text-gray-500 mt-1">Push monthly aggregated clinic data to the configured DHIS2 instance.</p>
          </div>

          <div className="p-6">
            {config && !config.dhis2Enabled && (
              <div className="mb-4 p-3 bg-gray-50 text-gray-600 text-sm rounded-lg border border-gray-200">
                DHIS2 sync is disabled — configure and enable it above first.
              </div>
            )}

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
                disabled={syncing || !config?.dhis2Enabled}
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
                  <h4 className="font-medium">Request Failed</h4>
                  <p className="text-sm">{syncError}</p>
                </div>
              </div>
            )}

            {syncResult && (
              <div className={`mb-4 p-4 rounded-lg border ${STATUS_STYLES[syncResult.status]?.className || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {STATUS_STYLES[syncResult.status]?.icon}
                  <h4 className="font-semibold">{STATUS_STYLES[syncResult.status]?.label || syncResult.status}</h4>
                </div>
                <p className="text-sm mb-2">{syncResult.message}</p>
                {syncResult.importCount && (
                  <p className="text-xs font-mono">
                    Imported: {syncResult.importCount.imported} · Updated: {syncResult.importCount.updated} ·
                    Ignored: {syncResult.importCount.ignored} · Deleted: {syncResult.importCount.deleted}
                  </p>
                )}
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

      {/* DHIS2 Sync History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-gray-600" />
            Sync History
          </h2>
          <p className="text-sm text-gray-500 mt-1">Every DHIS2 push attempt for this clinic, most recent first.</p>
        </div>
        <div className="overflow-x-auto">
          {historyLoading ? (
            <p className="p-6 text-sm text-gray-500">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No DHIS2 sync attempts yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Triggered By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{entry.period}</td>
                    <td className="px-4 py-3 text-sm">{statusBadge(entry.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.triggeredBy ? `${entry.triggeredBy.firstName} ${entry.triggeredBy.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono max-w-xs truncate" title={JSON.stringify(entry.responseSummary)}>
                      {entry.responseSummary?.message
                        ? entry.responseSummary.message
                        : entry.responseSummary?.importCount
                        ? `Imported ${entry.responseSummary.importCount.imported}, Updated ${entry.responseSummary.importCount.updated}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteroperabilityPage;
