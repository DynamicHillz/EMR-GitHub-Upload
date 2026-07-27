/**
 * Network Status Indicator
 *
 * Displays the current network connectivity status.
 * Shows online/offline status with visual feedback.
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { getAllQueuedWrites } from '../services/offlineQueue';
import { replayQueuedWrites } from '../services/offlineSync';

interface NetworkStatus {
  online: boolean;
  lastChecked: Date;
  latency?: number;
}

const NetworkStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    online: true,
    lastChecked: new Date(),
  });
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    const electronAvailable = typeof window !== 'undefined' && 'electron' in window;
    setIsElectron(electronAvailable);

    if (electronAvailable) {
      // Get initial status
      getNetworkStatus();

      // Listen for status changes
      const cleanup = (window as any).electron.network.onStatusChange((newStatus: NetworkStatus) => {
        setStatus(newStatus);
      });

      // Poll status every 30 seconds as backup
      const interval = setInterval(getNetworkStatus, 30000);

      return () => {
        cleanup();
        clearInterval(interval);
      };
    } else {
      // Fallback for web browser (use browser's navigator.onLine)
      const handleOnline = () => setStatus({ online: true, lastChecked: new Date() });
      const handleOffline = () => setStatus({ online: false, lastChecked: new Date() });

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Initial status
      setStatus({ online: navigator.onLine, lastChecked: new Date() });

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const getNetworkStatus = async () => {
    if (typeof window !== 'undefined' && 'electron' in window) {
      try {
        const newStatus = await (window as any).electron.network.getStatus();
        setStatus(newStatus);
      } catch (error) {
        console.error('Error getting network status:', error);
      }
    }
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
        status.online
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}
      title={`Last checked: ${new Date(status.lastChecked).toLocaleTimeString()}`}
    >
      {status.online ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Online</span>
          {status.latency && (
            <span className="text-xs opacity-75">({status.latency}ms)</span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
};

export default NetworkStatusIndicator;

/**
 * Compact Network Status Badge
 * Minimal version for space-constrained areas
 */
export const NetworkStatusBadge: React.FC = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    online: true,
    lastChecked: new Date(),
  });

  useEffect(() => {
    const electronAvailable = typeof window !== 'undefined' && 'electron' in window;

    if (electronAvailable) {
      const getStatus = async () => {
        try {
          const newStatus = await (window as any).electron.network.getStatus();
          setStatus(newStatus);
        } catch (error) {
          console.error('Error getting network status:', error);
        }
      };

      getStatus();

      const cleanup = (window as any).electron.network.onStatusChange((newStatus: NetworkStatus) => {
        setStatus(newStatus);
      });

      const interval = setInterval(getStatus, 30000);

      return () => {
        cleanup();
        clearInterval(interval);
      };
    } else {
      const handleOnline = () => setStatus({ online: true, lastChecked: new Date() });
      const handleOffline = () => setStatus({ online: false, lastChecked: new Date() });

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      setStatus({ online: navigator.onLine, lastChecked: new Date() });

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return (
    <div
      className={`w-2 h-2 rounded-full ${status.online ? 'bg-green-500' : 'bg-red-500'}`}
      title={status.online ? 'Online' : 'Offline'}
    />
  );
};

/**
 * Sync Status Indicator
 * Shows pending sync items and sync status
 */
export const SyncStatusIndicator: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState({
    lastSync: null as Date | null,
    pendingChanges: 0,
    failedChanges: 0,
    conflictChanges: 0,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Previously this whole component was a no-op in the web app — every
  // branch below only ever ran `if (electronAvailable)`, so there was no
  // persistent indication anywhere that an offline write was pending,
  // failed, or in conflict; a stuck FAILED write (e.g. a phone-number
  // collision on replay) retried silently every 60s forever with nothing on
  // screen to notice. getPendingWriteCount/getAllQueuedWrites existed in
  // offlineQueue.ts specifically for this but were never imported anywhere.
  const getWebSyncStatus = async () => {
    try {
      const all = await getAllQueuedWrites();
      setSyncStatus((prev) => ({
        ...prev,
        pendingChanges: all.filter((w) => w.status === 'PENDING').length,
        failedChanges: all.filter((w) => w.status === 'FAILED').length,
        conflictChanges: all.filter((w) => w.status === 'CONFLICT').length,
      }));
    } catch (error) {
      console.error('Error reading offline write queue:', error);
    }
  };

  useEffect(() => {
    const electronAvailable = typeof window !== 'undefined' && 'electron' in window;

    if (electronAvailable) {
      // Get initial sync status
      getSyncStatus();

      // Poll sync status every 10 seconds
      const interval = setInterval(getSyncStatus, 10000);

      // Listen for sync progress
      const cleanup = (window as any).electron.sync.onProgress((progress: any) => {
        console.log('Sync progress:', progress);
        setIsSyncing(true);
      });

      return () => {
        cleanup();
        clearInterval(interval);
      };
    } else {
      getWebSyncStatus();
      const interval = setInterval(getWebSyncStatus, 10000);
      window.addEventListener('online', getWebSyncStatus);
      return () => {
        clearInterval(interval);
        window.removeEventListener('online', getWebSyncStatus);
      };
    }
  }, []);

  const getSyncStatus = async () => {
    if (typeof window !== 'undefined' && 'electron' in window) {
      try {
        const status = await (window as any).electron.sync.getStatus();
        setSyncStatus(status);
      } catch (error) {
        console.error('Error getting sync status:', error);
      }
    }
  };

  const handleSyncNow = async () => {
    if (typeof window !== 'undefined' && 'electron' in window) {
      try {
        setIsSyncing(true);
        await (window as any).electron.sync.start();
        await getSyncStatus();
      } catch (error) {
        console.error('Error starting sync:', error);
      } finally {
        setIsSyncing(false);
      }
    } else {
      try {
        setIsSyncing(true);
        await replayQueuedWrites();
        setSyncStatus((prev) => ({ ...prev, lastSync: new Date() }));
        await getWebSyncStatus();
      } catch (error) {
        console.error('Error starting sync:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const hasConflicts = syncStatus.conflictChanges > 0;
  const hasOutstanding = hasConflicts || syncStatus.pendingChanges > 0 || syncStatus.failedChanges > 0;

  return (
    <button
      onClick={handleSyncNow}
      disabled={isSyncing}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        hasConflicts
          ? 'bg-red-100 text-red-800 hover:bg-red-200 border border-red-200'
          : hasOutstanding
          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={
        syncStatus.lastSync
          ? `Last synced: ${new Date(syncStatus.lastSync).toLocaleString()}`
          : 'Click to sync now'
      }
    >
      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
      {hasConflicts ? (
        <span>{syncStatus.conflictChanges} conflict{syncStatus.conflictChanges === 1 ? '' : 's'} — needs review</span>
      ) : hasOutstanding ? (
        <span>{syncStatus.pendingChanges + syncStatus.failedChanges} pending</span>
      ) : (
        <span>Synced</span>
      )}
    </button>
  );
};
