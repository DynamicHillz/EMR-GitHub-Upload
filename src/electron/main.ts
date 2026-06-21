/**
 * Electron Main Process
 *
 * Entry point for the Electron desktop application.
 * Manages window creation, IPC, and system-level operations.
 */

/**
 * Electron Main Process
 */

// @ts-ignore - Electron modules must be imported this way for proper CommonJS compatibility
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as nodeCrypto from 'crypto';
import { getLocalDatabase, closeLocalDatabase } from './database/LocalDatabase';
import { getNetworkMonitor, stopNetworkMonitor } from './services/NetworkMonitor';

// Keep a global reference to prevent garbage collection
let mainWindow: any = null;

// App configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const BACKEND_PORT = process.env.PORT || 3000;
const FRONTEND_PORT = isDevelopment ? 5173 : BACKEND_PORT;

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false, // Security: disable node integration in renderer
      contextIsolation: true, // Security: enable context isolation
      sandbox: true, // Security: enable sandbox
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    show: false, // Don't show until ready
  });

  // Load the app
  const startUrl = isDevelopment
    ? `http://localhost:${FRONTEND_PORT}`
    : `http://localhost:${BACKEND_PORT}`;

  mainWindow.loadURL(startUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Open DevTools in development
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();

  // Start network monitoring
  const networkMonitor = getNetworkMonitor(mainWindow, 'https://www.google.com');
  networkMonitor.start();
}

/**
 * Create application menu
 */
function createMenu(): void {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Start the Express backend server
 */
async function startBackendServer(): Promise<void> {
  try {
    // In development, assume backend is running separately
    if (isDevelopment) {
      console.log('Development mode: Backend should be running separately');
      return;
    }

    // In production, import and start the bundled backend
    const serverPath = path.join(__dirname, '../backend/server.js');

    if (fs.existsSync(serverPath)) {
      require(serverPath);
      console.log(`Backend server started on port ${BACKEND_PORT}`);
    } else {
      console.error('Backend server file not found:', serverPath);
    }
  } catch (error) {
    console.error('Failed to start backend server:', error);
  }
}

/**
 * Initialize local database
 */
async function initializeLocalDatabase(): Promise<void> {
  try {
    // Generate or retrieve encryption key
    // In production, this should be derived from user credentials
    const encryptionKey = getOrCreateEncryptionKey();

    const db = getLocalDatabase({
      name: 'ssmc_emr_local',
      encryptionKey,
      version: 1,
    });

    await db.open();
    console.log('Local database initialized');
  } catch (error) {
    console.error('Failed to initialize local database:', error);
    throw error;
  }
}

/**
 * Get or create encryption key
 */
function getOrCreateEncryptionKey(): string {
  const keyPath = path.join(app.getPath('userData'), '.dbkey');

  try {
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf-8');
    }

    // Generate new key
    const key = nodeCrypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, key, { mode: 0o600 }); // Restrict permissions
    return key;
  } catch (error) {
    console.error('Error managing encryption key:', error);
    throw error;
  }
}

/**
 * Application initialization
 */
app.whenReady().then(async () => {
  // Initialize local database first
  await initializeLocalDatabase();

  // Start backend server
  await startBackendServer();

  // Create window after a short delay to ensure backend is ready
  setTimeout(() => {
    createWindow();
  }, 1000);

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Quit when all windows are closed (except on macOS)
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Cleanup before quit
 */
app.on('before-quit', () => {
  console.log('Application shutting down...');
  // Stop network monitoring
  stopNetworkMonitor();
  // Close local database
  closeLocalDatabase();
});

/**
 * IPC Handlers
 */

// Get app version
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// Get app path
ipcMain.handle('app:getPath', (_event: any, name: string) => {
  return app.getPath(name as any);
});

// Online/Offline status
ipcMain.handle('network:getStatus', () => {
  try {
    const networkMonitor = getNetworkMonitor();
    return networkMonitor.getStatus();
  } catch (error) {
    console.error('Error getting network status:', error);
    return { online: false, lastChecked: new Date() };
  }
});

// Database operations
ipcMain.handle('db:query', async (_event: any, query: string, params: any[]) => {
  try {
    const db = getLocalDatabase();
    const results = db.query(query, params);
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Database query error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:execute', async (_event: any, query: string, params: any[]) => {
  try {
    const db = getLocalDatabase();
    const result = db.execute(query, params);
    return { success: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  } catch (error: any) {
    console.error('Database execute error:', error);
    return { success: false, error: error.message };
  }
});

// Sync operations
ipcMain.handle('sync:start', async () => {
  // TODO: Implement sync logic
  console.log('Sync started');
  return { success: true };
});

ipcMain.handle('sync:getStatus', async () => {
  try {
    const db = getLocalDatabase();

    // Count pending changes in sync queue
    const pendingResult: any = db.queryOne(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'PENDING'"
    );

    // Get last sync time
    const lastSyncResult: any = db.queryOne(
      "SELECT value FROM _metadata WHERE key = 'last_sync_time'"
    );

    return {
      lastSync: lastSyncResult?.value ? new Date(parseInt(lastSyncResult.value) * 1000) : null,
      pendingChanges: pendingResult?.count || 0,
      syncInProgress: false
    };
  } catch (error: any) {
    console.error('Error getting sync status:', error);
    return {
      lastSync: null,
      pendingChanges: 0,
      syncInProgress: false
    };
  }
});

// File operations for offline data
ipcMain.handle('file:read', async (_event: any, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:write', async (_event: any, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

console.log('Electron main process started');
console.log('Environment:', isDevelopment ? 'development' : 'production');
console.log('Platform:', process.platform);
console.log('App version:', app.getVersion());
