/**
 * Offline Data Service
 *
 * Handles offline CRUD operations and sync queue management.
 * All data modifications are queued for synchronization when online.
 */

import { getLocalDatabase } from '../database/LocalDatabase';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncStatus = 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'CONFLICT';
export type EntityType =
  | 'patient'
  | 'appointment'
  | 'consultation'
  | 'prescription'
  | 'lab_test'
  | 'invoice'
  | 'payment';

export interface SyncQueueItem {
  id: string;
  tenantId: string;
  entityType: EntityType;
  entityId: string;
  operation: SyncOperation;
  data: any;
  priority: number;
  checksum?: string;
  retryCount: number;
  status: SyncStatus;
  error?: string;
  createdAt: number;
  syncedAt?: number;
}

export class OfflineDataService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Create a new entity offline
   */
  async create<T extends { id: string }>(
    entityType: EntityType,
    data: T,
    priority: number = 5
  ): Promise<T> {
    const db = getLocalDatabase();

    return db.transaction(() => {
      // Generate ID if not provided
      if (!data.id) {
        data.id = uuidv4();
      }

      // Insert into entity table
      const tableName = this.getTableName(entityType);
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = columns.map(() => '?').join(', ');

      const sql = `
        INSERT INTO ${tableName} (${columns.join(', ')}, tenant_id, is_synced)
        VALUES (${placeholders}, ?, 0)
      `;

      db.execute(sql, [...values, this.tenantId]);

      // Add to sync queue
      this.addToSyncQueue({
        entityType,
        entityId: data.id,
        operation: 'CREATE',
        data,
        priority,
      });

      return data;
    });
  }

  /**
   * Update an entity offline
   */
  async update<T extends { id: string }>(
    entityType: EntityType,
    id: string,
    data: Partial<T>,
    priority: number = 5
  ): Promise<void> {
    const db = getLocalDatabase();

    return db.transaction(() => {
      // Update entity table
      const tableName = this.getTableName(entityType);
      const columns = Object.keys(data).filter(k => k !== 'id');
      const values = columns.map(k => (data as any)[k]);
      const setClause = columns.map(col => `${col} = ?`).join(', ');

      const sql = `
        UPDATE ${tableName}
        SET ${setClause}, updated_at = strftime('%s', 'now'), is_synced = 0
        WHERE id = ? AND tenant_id = ?
      `;

      db.execute(sql, [...values, id, this.tenantId]);

      // Get full entity data for sync
      const fullData = this.getById(entityType, id);

      // Add to sync queue
      this.addToSyncQueue({
        entityType,
        entityId: id,
        operation: 'UPDATE',
        data: fullData,
        priority,
      });
    });
  }

  /**
   * Delete an entity offline (soft delete)
   */
  async delete(
    entityType: EntityType,
    id: string,
    priority: number = 5
  ): Promise<void> {
    const db = getLocalDatabase();

    return db.transaction(() => {
      // Soft delete
      const tableName = this.getTableName(entityType);
      const sql = `
        UPDATE ${tableName}
        SET deleted_at = strftime('%s', 'now'), is_synced = 0
        WHERE id = ? AND tenant_id = ?
      `;

      db.execute(sql, [id, this.tenantId]);

      // Add to sync queue
      this.addToSyncQueue({
        entityType,
        entityId: id,
        operation: 'DELETE',
        data: { id },
        priority,
      });
    });
  }

  /**
   * Get entity by ID
   */
  getById<T>(entityType: EntityType, id: string): T | undefined {
    const db = getLocalDatabase();
    const tableName = this.getTableName(entityType);

    const sql = `
      SELECT * FROM ${tableName}
      WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
    `;

    return db.queryOne<T>(sql, [id, this.tenantId]);
  }

  /**
   * Get all entities of a type
   */
  getAll<T>(entityType: EntityType, filters?: Record<string, any>): T[] {
    const db = getLocalDatabase();
    const tableName = this.getTableName(entityType);

    let sql = `
      SELECT * FROM ${tableName}
      WHERE tenant_id = ? AND deleted_at IS NULL
    `;

    const params: any[] = [this.tenantId];

    // Add filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        sql += ` AND ${key} = ?`;
        params.push(value);
      });
    }

    sql += ' ORDER BY created_at DESC';

    return db.query<T>(sql, params);
  }

  /**
   * Search entities
   */
  search<T>(
    entityType: EntityType,
    searchTerm: string,
    searchFields: string[]
  ): T[] {
    const db = getLocalDatabase();
    const tableName = this.getTableName(entityType);

    const whereConditions = searchFields
      .map(field => `${field} LIKE ?`)
      .join(' OR ');

    const sql = `
      SELECT * FROM ${tableName}
      WHERE tenant_id = ? AND deleted_at IS NULL
      AND (${whereConditions})
      ORDER BY created_at DESC
    `;

    const searchPattern = `%${searchTerm}%`;
    const params = [this.tenantId, ...searchFields.map(() => searchPattern)];

    return db.query<T>(sql, params);
  }

  /**
   * Add item to sync queue
   */
  private addToSyncQueue(item: {
    entityType: EntityType;
    entityId: string;
    operation: SyncOperation;
    data: any;
    priority: number;
  }): void {
    const db = getLocalDatabase();

    const queueItem: Omit<SyncQueueItem, 'createdAt'> = {
      id: uuidv4(),
      tenantId: this.tenantId,
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      data: JSON.stringify(item.data),
      priority: item.priority,
      checksum: this.calculateChecksum(item.data),
      retryCount: 0,
      status: 'PENDING',
    };

    // Check if there's already a pending item for this entity
    const existing = db.queryOne<{ id: string }>(
      `SELECT id FROM sync_queue
       WHERE entity_id = ? AND entity_type = ? AND status = 'PENDING'
       ORDER BY created_at DESC LIMIT 1`,
      [item.entityId, item.entityType]
    );

    if (existing) {
      // Update existing queue item
      db.execute(
        `UPDATE sync_queue
         SET operation = ?, data = ?, checksum = ?, priority = ?,
             updated_at = strftime('%s', 'now')
         WHERE id = ?`,
        [
          queueItem.operation,
          queueItem.data,
          queueItem.checksum,
          queueItem.priority,
          existing.id,
        ]
      );
    } else {
      // Insert new queue item
      db.execute(
        `INSERT INTO sync_queue (
          id, tenant_id, entity_type, entity_id, operation, data,
          priority, checksum, retry_count, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          queueItem.id,
          queueItem.tenantId,
          queueItem.entityType,
          queueItem.entityId,
          queueItem.operation,
          queueItem.data,
          queueItem.priority,
          queueItem.checksum,
          queueItem.retryCount,
          queueItem.status,
        ]
      );
    }
  }

  /**
   * Get pending sync queue items
   */
  getPendingSyncItems(limit: number = 100): SyncQueueItem[] {
    const db = getLocalDatabase();

    const sql = `
      SELECT * FROM sync_queue
      WHERE tenant_id = ? AND status = 'PENDING'
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `;

    const items = db.query<any>(sql, [this.tenantId, limit]);

    return items.map(item => ({
      ...item,
      data: JSON.parse(item.data),
    }));
  }

  /**
   * Mark sync item as completed
   */
  markSyncCompleted(queueItemId: string): void {
    const db = getLocalDatabase();

    db.execute(
      `UPDATE sync_queue
       SET status = 'COMPLETED', synced_at = strftime('%s', 'now')
       WHERE id = ?`,
      [queueItemId]
    );
  }

  /**
   * Mark sync item as failed
   */
  markSyncFailed(queueItemId: string, error: string): void {
    const db = getLocalDatabase();

    db.execute(
      `UPDATE sync_queue
       SET status = 'FAILED', retry_count = retry_count + 1, error = ?
       WHERE id = ?`,
      [error, queueItemId]
    );
  }

  /**
   * Mark sync item as conflict
   */
  markSyncConflict(queueItemId: string, error: string): void {
    const db = getLocalDatabase();

    db.execute(
      `UPDATE sync_queue
       SET status = 'CONFLICT', error = ?
       WHERE id = ?`,
      [error, queueItemId]
    );
  }

  /**
   * Clear completed sync items
   */
  clearCompletedSyncItems(olderThanDays: number = 7): void {
    const db = getLocalDatabase();

    const cutoffTime = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);

    db.execute(
      `DELETE FROM sync_queue
       WHERE status = 'COMPLETED' AND synced_at < ?`,
      [cutoffTime]
    );
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    pending: number;
    syncing: number;
    failed: number;
    conflicts: number;
  } {
    const db = getLocalDatabase();

    const stats = db.queryOne<any>(
      `SELECT
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'SYNCING' THEN 1 ELSE 0 END) as syncing,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'CONFLICT' THEN 1 ELSE 0 END) as conflicts
       FROM sync_queue
       WHERE tenant_id = ?`,
      [this.tenantId]
    );

    return {
      pending: stats?.pending || 0,
      syncing: stats?.syncing || 0,
      failed: stats?.failed || 0,
      conflicts: stats?.conflicts || 0,
    };
  }

  /**
   * Calculate checksum for data
   */
  private calculateChecksum(data: any): string {
    const content = JSON.stringify(data);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get table name for entity type
   */
  private getTableName(entityType: EntityType): string {
    const tableMap: Record<EntityType, string> = {
      patient: 'patients',
      appointment: 'appointments',
      consultation: 'consultations',
      prescription: 'prescriptions',
      lab_test: 'lab_tests',
      invoice: 'invoices',
      payment: 'payments',
    };

    return tableMap[entityType];
  }
}

/**
 * Create offline data service instance
 */
export function createOfflineDataService(tenantId: string): OfflineDataService {
  return new OfflineDataService(tenantId);
}
