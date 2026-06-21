/**
 * Sync Engine
 *
 * Handles bi-directional synchronization between local SQLite and cloud PostgreSQL.
 * Implements incremental sync with conflict detection and resolution.
 */

import { OfflineDataService, SyncQueueItem } from './OfflineDataService';
import { getLocalDatabase } from '../database/LocalDatabase';
import { BrowserWindow } from 'electron';

export interface SyncConfig {
  apiBaseUrl: string;
  token: string;
  tenantId: string;
  batchSize: number;
  retryAttempts: number;
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
}

export class SyncEngine {
  private config: SyncConfig;
  private dataService: OfflineDataService;
  private isSyncing: boolean = false;
  private mainWindow: BrowserWindow | null = null;

  constructor(config: SyncConfig, mainWindow?: BrowserWindow) {
    this.config = config;
    this.dataService = new OfflineDataService(config.tenantId);
    this.mainWindow = mainWindow || null;
  }

  /**
   * Start incremental sync
   */
  async startSync(): Promise<{ success: boolean; synced: number; failed: number; error?: string }> {
    if (this.isSyncing) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        error: 'Sync already in progress',
      };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
      // Step 1: Push local changes to cloud
      const pushResult = await this.pushChanges();
      syncedCount += pushResult.synced;
      failedCount += pushResult.failed;

      // Step 2: Pull remote changes from cloud
      const pullResult = await this.pullChanges();
      syncedCount += pullResult.synced;
      failedCount += pullResult.failed;

      // Step 3: Update last sync time
      this.updateLastSyncTime();

      // Step 4: Clean up old completed sync items
      this.dataService.clearCompletedSyncItems();

      console.log(`Sync completed: ${syncedCount} synced, ${failedCount} failed`);

      return {
        success: true,
        synced: syncedCount,
        failed: failedCount,
      };
    } catch (error: any) {
      console.error('Sync error:', error);
      return {
        success: false,
        synced: syncedCount,
        failed: failedCount,
        error: error.message,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push local changes to cloud
   */
  private async pushChanges(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    // Get pending sync items
    const items = this.dataService.getPendingSyncItems(this.config.batchSize);

    if (items.length === 0) {
      console.log('No pending changes to push');
      return { synced, failed };
    }

    console.log(`Pushing ${items.length} changes to cloud...`);

    for (const item of items) {
      try {
        await this.syncItem(item);
        this.dataService.markSyncCompleted(item.id);
        synced++;

        // Send progress update
        this.sendProgress({
          total: items.length,
          completed: synced + failed,
          failed,
          current: `Syncing ${item.entityType}: ${item.entityId}`,
        });
      } catch (error: any) {
        console.error(`Failed to sync item ${item.id}:`, error);

        if (error.conflict) {
          this.dataService.markSyncConflict(item.id, error.message);
        } else {
          this.dataService.markSyncFailed(item.id, error.message);
        }

        failed++;
      }
    }

    return { synced, failed };
  }

  /**
   * Pull remote changes from cloud
   */
  private async pullChanges(): Promise<{ synced: number; failed: number }> {
    // Get last sync time
    const db = getLocalDatabase();
    const lastSyncResult = db.queryOne<{ value: string }>(
      "SELECT value FROM _metadata WHERE key = 'last_sync_time'"
    );

    const lastSyncTime = lastSyncResult?.value || '0';

    try {
      // Fetch changes from cloud since last sync
      const response = await fetch(
        `${this.config.apiBaseUrl}/sync/changes?since=${lastSyncTime}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch changes: ${response.statusText}`);
      }

      const changes = await response.json() as { data?: any[] };

      console.log(`Received ${changes.data?.length || 0} changes from cloud`);

      // Apply changes to local database
      let synced = 0;
      for (const change of changes.data || []) {
        try {
          await this.applyRemoteChange(change);
          synced++;
        } catch (error) {
          console.error('Failed to apply remote change:', error);
        }
      }

      return { synced, failed: 0 };
    } catch (error: any) {
      console.error('Error pulling changes:', error);
      return { synced: 0, failed: 0 };
    }
  }

  /**
   * Sync a single item to cloud
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    const endpoint = this.getSyncEndpoint(item);

    const requestConfig: RequestInit = {
      method: item.operation === 'CREATE' ? 'POST' : item.operation === 'UPDATE' ? 'PUT' : 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.token}`,
      },
    };

    if (item.operation !== 'DELETE') {
      requestConfig.body = JSON.stringify(item.data);
    }

    const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, requestConfig);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string };

      // Check for conflict (409 status)
      if (response.status === 409) {
        throw {
          conflict: true,
          message: errorData.message || 'Conflict detected',
        };
      }

      throw new Error(errorData.message || `Sync failed: ${response.statusText}`);
    }
  }

  /**
   * Apply remote change to local database
   */
  private async applyRemoteChange(change: any): Promise<void> {
    const db = getLocalDatabase();

    // Check if entity exists locally
    const tableName = this.getTableName(change.entityType);
    const existing = db.queryOne(
      `SELECT * FROM ${tableName} WHERE id = ?`,
      [change.entityId]
    );

    if (change.operation === 'DELETE') {
      // Soft delete
      db.execute(
        `UPDATE ${tableName} SET deleted_at = ?, is_synced = 1 WHERE id = ?`,
        [change.timestamp, change.entityId]
      );
    } else if (existing) {
      // Update existing record
      const columns = Object.keys(change.data);
      const values = Object.values(change.data);
      const setClause = columns.map(col => `${col} = ?`).join(', ');

      db.execute(
        `UPDATE ${tableName} SET ${setClause}, is_synced = 1 WHERE id = ?`,
        [...values, change.entityId]
      );
    } else {
      // Insert new record
      const columns = Object.keys(change.data);
      const values = Object.values(change.data);
      const placeholders = columns.map(() => '?').join(', ');

      db.execute(
        `INSERT INTO ${tableName} (${columns.join(', ')}, is_synced) VALUES (${placeholders}, 1)`,
        values
      );
    }
  }

  /**
   * Get sync endpoint for entity type
   */
  private getSyncEndpoint(item: SyncQueueItem): string {
    const endpoints: Record<string, string> = {
      patient: '/api/patients',
      appointment: '/api/appointments',
      consultation: '/api/consultations',
      prescription: '/api/prescriptions',
      lab_test: '/api/lab/tests',
      invoice: '/api/billing/invoices',
      payment: '/api/billing/payments',
    };

    const basePath = endpoints[item.entityType] || `/api/${item.entityType}s`;

    if (item.operation === 'CREATE') {
      return basePath;
    } else {
      return `${basePath}/${item.entityId}`;
    }
  }

  /**
   * Get table name for entity type
   */
  private getTableName(entityType: string): string {
    const tableMap: Record<string, string> = {
      patient: 'patients',
      appointment: 'appointments',
      consultation: 'consultations',
      prescription: 'prescriptions',
      lab_test: 'lab_tests',
      invoice: 'invoices',
      payment: 'payments',
    };

    return tableMap[entityType] || `${entityType}s`;
  }

  /**
   * Update last sync time
   */
  private updateLastSyncTime(): void {
    const db = getLocalDatabase();
    const now = Math.floor(Date.now() / 1000);

    db.execute(
      `INSERT OR REPLACE INTO _metadata (key, value, updated_at) VALUES ('last_sync_time', ?, ?)`,
      [now.toString(), now]
    );
  }

  /**
   * Send sync progress update to renderer
   */
  private sendProgress(progress: SyncProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:progress', progress);
    }
  }

  /**
   * Check if sync is in progress
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    return this.dataService.getSyncStats();
  }
}

/**
 * Create sync engine instance
 */
export function createSyncEngine(
  config: SyncConfig,
  mainWindow?: BrowserWindow
): SyncEngine {
  return new SyncEngine(config, mainWindow);
}
