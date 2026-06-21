/**
 * Local SQLite Database Manager
 *
 * Manages the encrypted local SQLite database for offline operations.
 * Uses SQLCipher for encryption at rest.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export interface DatabaseConfig {
  name: string;
  encryptionKey: string;
  version: number;
}

export class LocalDatabase {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private dbPath: string;

  constructor(config: DatabaseConfig) {
    this.config = config;

    // Store database in user data directory
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'data');

    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = path.join(dbDir, `${config.name}.db`);
  }

  /**
   * Initialize and open the database
   */
  async open(): Promise<void> {
    try {
      // Open database with SQLCipher encryption
      this.db = new Database(this.dbPath);

      // Enable encryption (SQLCipher)
      this.db.pragma(`key = '${this.config.encryptionKey}'`);

      // Performance optimizations
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging
      this.db.pragma('synchronous = NORMAL'); // Balance between safety and performance
      this.db.pragma('cache_size = -64000'); // 64MB cache
      this.db.pragma('temp_store = MEMORY');

      // Verify database is accessible
      this.db.prepare('SELECT 1').get();

      // Initialize schema if needed
      await this.initializeSchema();

      console.log('Local database opened successfully');
    } catch (error: any) {
      console.error('Failed to open local database:', error);
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Local database closed');
    }
  }

  /**
   * Get the database instance
   */
  getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call open() first.');
    }
    return this.db;
  }

  /**
   * Initialize database schema
   */
  private async initializeSchema(): Promise<void> {
    if (!this.db) return;

    // Check if schema exists
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all();

    if (tables.length > 0) {
      // Database already initialized
      return;
    }

    console.log('Initializing local database schema...');

    // Create metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
    `);

    // Store schema version
    this.db
      .prepare('INSERT OR REPLACE INTO _metadata (key, value) VALUES (?, ?)')
      .run('schema_version', this.config.version.toString());

    // Create core tables for offline operation
    this.createCoreSchema();

    console.log('Local database schema initialized');
  }

  /**
   * Create core tables for offline operation
   */
  private createCoreSchema(): void {
    if (!this.db) return;

    // Sync Queue - tracks changes made offline
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),
        data TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 5,
        checksum TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SYNCING', 'COMPLETED', 'FAILED', 'CONFLICT')),
        error TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        synced_at INTEGER,
        INDEX idx_sync_queue_status (status),
        INDEX idx_sync_queue_tenant (tenant_id),
        INDEX idx_sync_queue_priority (priority DESC, created_at ASC)
      );
    `);

    // Patients - core patient data
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth TEXT NOT NULL,
        gender TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        blood_group TEXT,
        genotype TEXT,
        allergies TEXT,
        chronic_conditions TEXT,
        is_synced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        deleted_at INTEGER,
        INDEX idx_patients_tenant (tenant_id),
        INDEX idx_patients_name (last_name, first_name)
      );
    `);

    // Appointments
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        appointment_date TEXT NOT NULL,
        appointment_time TEXT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 30,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT,
        notes TEXT,
        is_synced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        deleted_at INTEGER,
        INDEX idx_appointments_tenant (tenant_id),
        INDEX idx_appointments_patient (patient_id),
        INDEX idx_appointments_doctor (doctor_id),
        INDEX idx_appointments_date (appointment_date, appointment_time)
      );
    `);

    // Consultations
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS consultations (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        appointment_id TEXT,
        subjective TEXT,
        objective TEXT,
        assessment TEXT,
        plan TEXT,
        vital_signs TEXT,
        status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
        is_synced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        deleted_at INTEGER,
        INDEX idx_consultations_tenant (tenant_id),
        INDEX idx_consultations_patient (patient_id),
        INDEX idx_consultations_doctor (doctor_id)
      );
    `);

    // Prescriptions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        consultation_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        medication_name TEXT NOT NULL,
        dosage TEXT NOT NULL,
        frequency TEXT NOT NULL,
        duration TEXT NOT NULL,
        quantity INTEGER,
        instructions TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        is_synced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        deleted_at INTEGER,
        INDEX idx_prescriptions_tenant (tenant_id),
        INDEX idx_prescriptions_patient (patient_id),
        INDEX idx_prescriptions_consultation (consultation_id)
      );
    `);

    // Lab Tests
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lab_tests (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        consultation_id TEXT,
        patient_id TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        test_name TEXT NOT NULL,
        test_code TEXT,
        status TEXT NOT NULL DEFAULT 'ORDERED',
        priority TEXT NOT NULL DEFAULT 'ROUTINE',
        notes TEXT,
        results TEXT,
        is_synced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        deleted_at INTEGER,
        INDEX idx_lab_tests_tenant (tenant_id),
        INDEX idx_lab_tests_patient (patient_id),
        INDEX idx_lab_tests_status (status)
      );
    `);

    // Invoices
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        total_amount REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'UNPAID',
        items TEXT NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        deleted_at INTEGER,
        INDEX idx_invoices_tenant (tenant_id),
        INDEX idx_invoices_patient (patient_id),
        INDEX idx_invoices_number (invoice_number)
      );
    `);

    // Payments
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        invoice_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        reference TEXT,
        is_synced INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        deleted_at INTEGER,
        INDEX idx_payments_tenant (tenant_id),
        INDEX idx_payments_invoice (invoice_id)
      );
    `);

    console.log('Core schema tables created');
  }

  /**
   * Execute a query
   */
  query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params) as T[];
    } catch (error: any) {
      console.error('Query error:', error);
      throw error;
    }
  }

  /**
   * Execute a single row query
   */
  queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params) as T | undefined;
    } catch (error: any) {
      console.error('Query error:', error);
      throw error;
    }
  }

  /**
   * Execute an insert/update/delete statement
   */
  execute(sql: string, params: any[] = []): Database.RunResult {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(...params);
    } catch (error: any) {
      console.error('Execute error:', error);
      throw error;
    }
  }

  /**
   * Execute multiple statements in a transaction
   */
  transaction<T>(fn: () => T): T {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(fn);
    return transaction();
  }

  /**
   * Check if database is open
   */
  isOpen(): boolean {
    return this.db !== null && this.db.open;
  }

  /**
   * Get database file path
   */
  getPath(): string {
    return this.dbPath;
  }

  /**
   * Backup database
   */
  async backup(backupPath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      try {
        this.db!.backup(backupPath)
          .then(() => {
            console.log('Database backed up to:', backupPath);
            resolve();
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get database statistics
   */
  getStats(): { size: number; pageCount: number; pageSize: number } {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stats = fs.statSync(this.dbPath);
    const pageCount = this.db.pragma('page_count', { simple: true }) as number;
    const pageSize = this.db.pragma('page_size', { simple: true }) as number;

    return {
      size: stats.size,
      pageCount,
      pageSize,
    };
  }
}

/**
 * Singleton database instance
 */
let localDbInstance: LocalDatabase | null = null;

export function getLocalDatabase(config?: DatabaseConfig): LocalDatabase {
  if (!localDbInstance && config) {
    localDbInstance = new LocalDatabase(config);
  }

  if (!localDbInstance) {
    throw new Error('Database not initialized. Provide config on first call.');
  }

  return localDbInstance;
}

export function closeLocalDatabase(): void {
  if (localDbInstance) {
    localDbInstance.close();
    localDbInstance = null;
  }
}
