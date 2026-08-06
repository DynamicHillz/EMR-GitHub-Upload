import React, { useState, useEffect } from 'react';
import { auditService, AuditLog, InvoiceAuditLogEntry, PaymentAuditLogEntry } from '../../services/audit.service';
import InpatientService from '../../services/InpatientService';
import ErrorAlert from '../../components/common/ErrorAlert';
import { useConfirm } from '../../hooks/useConfirm';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { Search, Filter, Download, Eye, Activity, Users, Database, ShieldAlert, X } from 'lucide-react';
import Dropdown from '../../components/common/Dropdown';
import { getErrorMessage } from '../../utils/errorHandler';

const AuditDashboardPage: React.FC = () => {
  const { confirm, isOpen, options, loading: confirmLoading, handleConfirm, handleCancel } = useConfirm();
  const [activeTab, setActiveTab] = useState<'logs' | 'archive'>('logs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Logs state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Filters state
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    entityType: '',
    action: '',
    search: ''
  });
  // Uncommitted search text bound directly to the input — filters.search
  // (the value actually used to fetch) only ever gets set once, together
  // with the page reset, after the debounce below settles. Keeping them
  // as one atomic update avoids a race where an early, partially-typed
  // fetch (triggered because `page` resetting via handleFilterChange used
  // to fire the main effect immediately, before debounce) could resolve
  // after — and overwrite — the correct debounced result.
  const [searchInput, setSearchInput] = useState('');

  // Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  // Drill-down: richer InvoiceAuditLog/PaymentAuditLog history for the
  // selected log's entity — fetched on demand, supplementary to the main
  // log entry (never shown anywhere else in the app until now).
  const [entityAuditTrail, setEntityAuditTrail] = useState<(InvoiceAuditLogEntry | PaymentAuditLogEntry)[]>([]);

  // Archive state
  const [archiveType, setArchiveType] = useState('patients');
  const [archivedRecords, setArchivedRecords] = useState<any[]>([]);
  // Server defaults to the last 90 days — checked when hunting for
  // something older than that (rare enough not to warrant loading it by
  // default on every archive-tab open).
  const [archiveShowAllTime, setArchiveShowAllTime] = useState(false);

  // Dictionaries for UUID resolution
  const [uuidDict, setUuidDict] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load dictionaries silently in background
    const loadDictionaries = async () => {
      try {
        const newDict: Record<string, string> = {};
        
        // Fetch Wards and Beds
        const wards = await InpatientService.getWards();
        wards.forEach(w => {
          newDict[w.id] = `Ward: ${w.name}`;
          if (w.beds) {
            w.beds.forEach(b => {
              newDict[b.id] = `${w.name} - Bed ${b.bedNumber}`;
            });
          }
        });
        
        setUuidDict(newDict);
      } catch (err) {
        console.error("Failed to load audit dictionaries", err);
      }
    };
    loadDictionaries();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    } else {
      fetchArchive();
    }
  }, [activeTab, page, archiveType, archiveShowAllTime, filters.startDate, filters.endDate, filters.entityType, filters.action, filters.search]);

  // Debounced search: commits searchInput into filters.search (and resets
  // the page) as a single update once typing pauses. The effect above,
  // which depends on filters.search, is the only thing that ever triggers
  // the actual fetch for a search change — nothing here calls fetchLogs
  // directly, so there's no way for an intermediate, partially-typed fetch
  // to fire and race the final one.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
      setPage(1);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await auditService.getAuditLogs(page, 50, filters);
      setLogs(data.logs);
      setTotalPages(data.totalPages);
      setTotalLogs(data.total);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to fetch audit logs'));
    } finally {
      setLoading(false);
    }
  };

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const data = await auditService.getArchivedRecords(archiveType, {
        page,
        limit: 50,
        // Server defaults to the last 90 days when sinceDate is omitted —
        // going back to 2000 is just a simple way to say "no lower bound".
        sinceDate: archiveShowAllTime ? '2000-01-01' : undefined,
      });
      setArchivedRecords(data.records);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(getErrorMessage(err, `Failed to fetch archived ${archiveType}`));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    const confirmed = await confirm({
      title: 'Restore Record',
      message: 'Are you sure you want to restore this record? It will become active and visible again.',
      confirmText: 'Restore',
      confirmVariant: 'primary',
    });
    if (!confirmed) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await auditService.restoreRecord(archiveType, id);
      setSuccess('Record restored successfully');
      fetchArchive();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to restore record'));
      setLoading(false);
    }
  };

  useEffect(() => {
    setEntityAuditTrail([]);
    const entityId = selectedLog?.entityId;
    if (!selectedLog || !entityId) return;

    const fetchTrail = async () => {
      try {
        if (selectedLog.entityType === 'INVOICE') {
          setEntityAuditTrail(await auditService.getInvoiceAuditTrail(entityId));
        } else if (selectedLog.entityType === 'PAYMENT') {
          setEntityAuditTrail(await auditService.getPaymentAuditTrail(entityId));
        }
      } catch {
        // Supplementary detail only — a failed fetch just means the extra
        // section doesn't render below, not an error worth surfacing.
      }
    };
    fetchTrail();
  }, [selectedLog]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPage(1);
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity Name', 'User', 'IP Address', 'User Agent', 'Before', 'After', 'Metadata'];
    const csvCell = (value?: string | null) => (value ? `"${value.replace(/"/g, '""')}"` : '""');
    const csvRows = [
      headers.join(','),
      ...logs.map(log => {
        return [
          `"${new Date(log.timestamp).toLocaleString()}"`,
          `"${log.action}"`,
          `"${log.entityType}"`,
          `"${log.entityName || log.entityId || ''}"`,
          `"${log.userName || log.userId || 'System'}"`,
          `"${log.ipAddress || ''}"`,
          csvCell(log.userAgent),
          csvCell(log.oldValues),
          csvCell(log.newValues),
          csvCell(log.metadata)
        ].join(',');
      })
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Archived records have different shapes per entity type (Patient has
  // firstName/lastName, Appointment doesn't, etc.) — best-effort a readable
  // label rather than assuming one fixed shape.
  const getArchiveRecordLabel = (record: any): string => {
    if (record.firstName || record.lastName) {
      return [record.firstName, record.lastName].filter(Boolean).join(' ');
    }
    const patientName = record.patient ? [record.patient.firstName, record.patient.lastName].filter(Boolean).join(' ') : '';
    if (record.invoiceNumber) return `Invoice ${record.invoiceNumber}${patientName ? ` — ${patientName}` : ''}`;
    if (record.paymentNumber) return `Payment ${record.paymentNumber}${patientName ? ` — ${patientName}` : ''}`;
    if (record.medicationName) return `${record.medicationName}${patientName ? ` — ${patientName}` : ''}`;
    if (patientName) return patientName;
    if (record.reason) return record.reason;
    return record.id;
  };

  // Utility to replace UUIDs in a JSON string with readable names
  const renderReadableJson = (metadata: string) => {
    try {
      const parsed = JSON.parse(metadata);
      
      const recursivelyResolve = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(item => recursivelyResolve(item));
        } else if (obj !== null && typeof obj === 'object') {
          const resolvedObj: any = {};
          for (const key in obj) {
            const val = obj[key];
            if (typeof val === 'string' && uuidDict[val]) {
              resolvedObj[key] = `${uuidDict[val]} (${val})`; // Append readable name next to UUID
            } else if (typeof val === 'object') {
              resolvedObj[key] = recursivelyResolve(val);
            } else {
              resolvedObj[key] = val;
            }
          }
          return resolvedObj;
        }
        return obj;
      };

      const resolved = recursivelyResolve(parsed);
      return JSON.stringify(resolved, null, 2);
    } catch {
      return metadata; // Return raw if parsing fails
    }
  };

  // Derived from the currently-loaded page of logs only (not a server-side
  // aggregate) — labeled "this page" in the UI so it's honest about scope,
  // replacing what used to be static decorative text ("Global", "Strict").
  const distinctUserCount = new Set(logs.map((l) => l.userId).filter(Boolean)).size;
  const distinctEntityTypeCount = new Set(logs.map((l) => l.entityType).filter(Boolean)).size;
  const actionCounts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});
  const mostCommonAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security & Audit</h1>
          <p className="text-sm text-gray-500 mt-1">Super Admin dashboard for compliance and forensics</p>
        </div>
        {activeTab === 'logs' && (
          <button
            onClick={exportToCSV}
            className="btn btn-secondary flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        )}
      </div>

      {error && <ErrorAlert message={error} />}
      {success && (
        <div className="bg-green-50 text-green-800 p-4 rounded-md text-sm font-medium">
          {success}
        </div>
      )}

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-100 flex items-center">
          <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Events</p>
            <p className="text-2xl font-bold text-gray-900">{totalLogs.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-100 flex items-center">
          <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Distinct Users (this page)</p>
            <p className="text-2xl font-bold text-gray-900">{distinctUserCount}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-100 flex items-center">
          <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Entity Types (this page)</p>
            <p className="text-2xl font-bold text-gray-900">{distinctEntityTypeCount}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-100 flex items-center">
          <div className="p-3 rounded-full bg-orange-100 text-orange-600 mr-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Most Common Action (this page)</p>
            <p className="text-2xl font-bold text-gray-900">{mostCommonAction || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('logs')}
            className={`${
              activeTab === 'logs'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Comprehensive Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`${
              activeTab === 'archive'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Archived Records
          </button>
        </nav>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}


      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="input pl-10 w-full sm:w-64"
                  placeholder="Name, User ID, action, entity..."
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Entity Type</label>
              <Dropdown name="entityType" value={filters.entityType} onChange={handleFilterChange} className="input">
                <option value="">All Entities</option>
                <option value="USER">User</option>
                <option value="PATIENT">Patient</option>
                <option value="CONSULTATION">Consultation</option>
                <option value="APPOINTMENT">Appointment</option>
                <option value="PRESCRIPTION">Prescription</option>
                <option value="MEDICATION">Medication</option>
                <option value="INVOICE">Invoice</option>
                <option value="PAYMENT">Payment</option>
                <option value="REFUND">Refund</option>
                <option value="SERVICE_CATALOG">Service Catalog</option>
                <option value="BILLING">Billing (Other)</option>
                <option value="INPATIENT">Inpatient</option>
                <option value="WARD">Ward</option>
                <option value="LAB">Lab</option>
                <option value="PHARMACY">Pharmacy (Other)</option>
                <option value="CLINICAL">Clinical</option>
                <option value="INSURANCE_PROVIDER">Insurance Provider</option>
                <option value="PATIENT_INSURANCE">Patient Insurance (Copay)</option>
                <option value="INSURANCE_CLAIM">Insurance Claim</option>
                <option value="EXEMPTION_POLICY">Exemption Policy</option>
                <option value="ANC">ANC</option>
                <option value="IMMUNIZATION">Immunization</option>
                <option value="TRIAGE">Triage</option>
                <option value="OUTPATIENT_VITAL">Outpatient Vital</option>
                <option value="LABOR">Labor &amp; Delivery</option>
                <option value="TENANT">Tenant</option>
                <option value="FRAUD_PREVENTION_SETTINGS">Fraud Prevention Settings</option>
                <option value="NOTIFICATION">Notification</option>
                <option value="SYNC">Sync</option>
                <option value="VERIFICATION">Verification</option>
                <option value="INTEROPERABILITY">Interoperability</option>
                <option value="REPORT">Report</option>
                <option value="DASHBOARD">Dashboard</option>
                <option value="SYSTEM">System</option>
              </Dropdown>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
              <input
                type="text"
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
                className="input w-32"
                placeholder="e.g. CREATED"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="input" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="input" />
            </div>
            
            <button
              onClick={() => {
                setFilters({ startDate: '', endDate: '', entityType: '', action: '', search: '' });
                setSearchInput('');
                setPage(1);
              }}
              className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 ml-auto"
            >
              Clear Filters
            </button>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID / Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        log.action.includes('RESTORE') ? 'bg-green-100 text-green-800' :
                        log.action.includes('DELETE') ? 'bg-red-100 text-red-800' :
                        log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.entityType} <br/> <span className="text-xs text-gray-400">{(log.entityId && uuidDict[log.entityId]) ? uuidDict[log.entityId] : (log.entityName || '—')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.userName || log.userId || 'System'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ipAddress || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="text-primary-600 hover:text-primary-900 p-1"
                        title="View Payload"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No audit logs match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
                <div className="flex space-x-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Archive Tab */}
      {activeTab === 'archive' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Entity Type</label>
              <Dropdown value={archiveType} onChange={(e) => { setArchiveType(e.target.value); setPage(1); }} className="input">
                <option value="patients">Patients</option>
                <option value="appointments">Appointments</option>
                <option value="consultations">Consultations</option>
                <option value="prescriptions">Prescriptions</option>
                <option value="invoices">Invoices</option>
                <option value="payments">Payments</option>
              </Dropdown>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
              <input
                type="checkbox"
                checked={archiveShowAllTime}
                onChange={(e) => { setArchiveShowAllTime(e.target.checked); setPage(1); }}
              />
              Show all time (default: last 90 days)
            </label>
            <p className="text-sm text-gray-500 pb-2">Soft-deleted records — restoring one makes it active and visible again everywhere in the app.</p>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deleted At</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {archivedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getArchiveRecordLabel(record)}
                      <div className="text-xs text-gray-400">{record.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.deletedAt ? new Date(record.deletedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleRestore(record.id)} className="text-green-600 hover:text-green-900">
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
                {archivedRecords.length === 0 && !loading && (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      No archived {archiveType} found{archiveShowAllTime ? '' : ' in the last 90 days'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
                <div className="flex space-x-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* JSON Payload Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">Event Details: {selectedLog.action}</h3>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Timestamp</p>
                  <p className="text-sm font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">User</p>
                  <p className="text-sm font-medium">{selectedLog.userName || selectedLog.userId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Entity</p>
                  <p className="text-sm font-medium">{selectedLog.entityType}</p>
                  <p className="text-xs text-gray-500">
                    {selectedLog.entityId
                      ? (uuidDict[selectedLog.entityId] ? `${uuidDict[selectedLog.entityId]} (${selectedLog.entityId})` : selectedLog.entityId)
                      : 'No single record — a list/aggregate view'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">IP Address</p>
                  <p className="text-sm font-medium">{selectedLog.ipAddress || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">User Agent</p>
                  <p className="text-sm font-medium break-all">{selectedLog.userAgent || 'N/A'}</p>
                </div>
              </div>
              {(selectedLog.oldValues || selectedLog.newValues) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Before</p>
                    <div className="bg-gray-900 rounded-md p-4 overflow-x-auto text-sm text-red-400 font-mono">
                      <pre>{selectedLog.oldValues ? renderReadableJson(selectedLog.oldValues) : 'N/A'}</pre>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">After</p>
                    <div className="bg-gray-900 rounded-md p-4 overflow-x-auto text-sm text-green-400 font-mono">
                      <pre>{selectedLog.newValues ? renderReadableJson(selectedLog.newValues) : 'N/A'}</pre>
                    </div>
                  </div>
                </div>
              )}
              {entityAuditTrail.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Full {selectedLog.entityType === 'INVOICE' ? 'Invoice' : 'Payment'} Audit History
                  </p>
                  <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                    {entityAuditTrail.map((entry) => (
                      <div key={entry.id} className="p-3 text-sm">
                        <div className="flex justify-between items-baseline">
                          <span className="font-semibold text-gray-900">{entry.action}</span>
                          <span className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</span>
                        </div>
                        {('changesSummary' in entry ? entry.changesSummary : entry.notes) && (
                          <p className="text-gray-600 mt-1">{('changesSummary' in entry ? entry.changesSummary : entry.notes)}</p>
                        )}
                        {(entry.previousValues || entry.newValues) && (
                          <pre className="mt-2 bg-gray-900 text-green-400 text-xs font-mono rounded p-2 overflow-x-auto">
                            {JSON.stringify({ before: entry.previousValues, after: entry.newValues }, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Request Payload / Metadata</p>
                <div className="bg-gray-900 rounded-md p-4 overflow-x-auto text-sm text-green-400 font-mono">
                  <pre>
                    {selectedLog.metadata ? renderReadableJson(selectedLog.metadata) : 'No payload data associated with this event.'}
                  </pre>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        confirmVariant={options.confirmVariant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isLoading={confirmLoading}
      />
    </div>
  );
};

export default AuditDashboardPage;
