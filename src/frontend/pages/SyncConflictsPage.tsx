import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, Server, Smartphone, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface SyncConflict {
  id: string;
  tenantId: string;
  syncQueueId: string | null;
  entityType: string;
  entityId: string;
  localPayload: Record<string, any>;
  serverPayload: Record<string, any>;
  localVersion: number;
  serverVersion: number;
  status: string;
  createdAt: string;
}

const getEntityDisplayTitle = (conflict: SyncConflict): string => {
  const payload = conflict.localPayload || conflict.serverPayload || {};

  switch (conflict.entityType) {
    case 'PATIENT':
      return `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || `Unknown Patient`;
    case 'CONSULTATION':
      return `Consultation ${payload.consultationDate ? format(new Date(payload.consultationDate), 'MMM d, yyyy') : ''}`.trim();
    case 'APPOINTMENT':
      return `Appointment ${payload.appointmentDate ? format(new Date(payload.appointmentDate), 'MMM d, yyyy') : ''}`.trim();
    case 'INVOICE':
      return payload.invoiceNumber || `Invoice ID: ${conflict.entityId.substring(0, 8)}`;
    default:
      return `ID: ${conflict.entityId.substring(0, 8)}`;
  }
};

const SyncConflictsPage: React.FC = () => {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);

  useEffect(() => {
    fetchConflicts();
  }, []);

  const fetchConflicts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`}/api/sync/conflicts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setConflicts(result.data || []);
      }
    } catch (err) {
      setError('Failed to load conflicts.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: string, resolution: 'KEEP_LOCAL' | 'KEEP_SERVER') => {
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`}/api/sync/conflicts/${id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ resolution })
      });

      if (response.ok) {
        setSuccess('Conflict resolved successfully.');
        setSelectedConflict(null);
        fetchConflicts();
      } else {
        const res = await response.json();
        setError(res.message || 'Failed to resolve conflict.');
      }
    } catch (err) {
      setError('An error occurred during resolution.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-600">Loading conflicts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <AlertTriangle className="w-6 h-6 text-yellow-500 mr-2" />
          Sync Conflict Resolution
        </h1>
        <p className="text-gray-600">Review and resolve data conflicts from offline devices.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-start">
          <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex items-start">
          <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          {success}
        </div>
      )}

      {conflicts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Conflicts Detected</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            All offline devices have synced successfully. There are no data conflicts requiring manual review at this time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-700">Pending Reviews</h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {conflicts.map((conflict) => (
                <button
                  key={conflict.id}
                  onClick={() => setSelectedConflict(conflict)}
                  className={`w-full text-left px-4 py-4 transition-colors hover:bg-yellow-50 ${selectedConflict?.id === conflict.id ? 'bg-yellow-50 border-l-4 border-yellow-500' : 'border-l-4 border-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-800 text-sm">
                      {conflict.entityType}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {format(new Date(conflict.createdAt), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-1 font-medium">{getEntityDisplayTitle(conflict)}</p>
                  <p className="text-xs text-gray-400 mt-1 truncate" title={conflict.entityId}>ID: {conflict.entityId.substring(0, 8)}...</p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedConflict ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h3 className="font-semibold text-gray-800">Resolve Conflict</h3>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                    {selectedConflict.entityType}
                  </span>
                </div>
                
                <div className="p-6">
                  <p className="text-sm text-gray-600 mb-6">
                    A device submitted changes that conflict with newer data on the server. Please review both versions below and select the correct data to keep.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Server Version */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center text-sm font-medium text-gray-700">
                        <Server className="w-4 h-4 mr-2" />
                        Server Version (v{selectedConflict.serverVersion})
                      </div>
                      <pre className="p-4 text-xs bg-gray-50 overflow-x-auto h-64 text-gray-700 font-mono">
                        {JSON.stringify(selectedConflict.serverPayload, null, 2)}
                      </pre>
                      <div className="p-3 bg-white border-t border-gray-200 text-center">
                        <button
                          onClick={() => handleResolve(selectedConflict.id, 'KEEP_SERVER')}
                          className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm w-full"
                        >
                          Keep Server Data
                        </button>
                      </div>
                    </div>

                    {/* Offline Device Version */}
                    <div className="border border-yellow-200 rounded-lg overflow-hidden">
                      <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-200 flex items-center text-sm font-medium text-yellow-800">
                        <Smartphone className="w-4 h-4 mr-2" />
                        Offline Device Version (based on v{selectedConflict.localVersion})
                      </div>
                      <pre className="p-4 text-xs bg-yellow-50/30 overflow-x-auto h-64 text-gray-700 font-mono">
                        {JSON.stringify(selectedConflict.localPayload, null, 2)}
                      </pre>
                      <div className="p-3 bg-white border-t border-gray-200 text-center">
                        <button
                          onClick={() => handleResolve(selectedConflict.id, 'KEEP_LOCAL')}
                          className="btn bg-yellow-100 text-yellow-800 hover:bg-yellow-200 text-sm w-full"
                        >
                          Accept Device Data
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-200 border-dashed h-full flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                <ArrowRight className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-700">Select a Conflict</h3>
                <p className="text-gray-500 max-w-sm">
                  Choose an item from the pending reviews list to compare the conflicting data and resolve it.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncConflictsPage;
