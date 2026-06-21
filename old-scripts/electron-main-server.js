/**
 * SSMC EMR — Electron Main Process (SERVER MODE)
 *
 * This version runs the full server stack:
 * - PostgreSQL database server
 * - Express backend API (port 3001)
 * - Frontend static server with API proxy (port 3000)
 * - Electron window loading from localhost:3000
 */

const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
let mainWindow = null;
let postgresProcess = null;
let backendHealthy = false;

const isDevelopment = process.env.NODE_ENV !== 'production';
const FRONTEND_PORT = 3000;
const BACKEND_INTERNAL_PORT = 3001;
const FRONTEND_DEV_PORT = 5173;

// App root
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.resolve(__dirname);

const FRONTEND_DIST = path.join(APP_ROOT, 'dist', 'frontend');
const BACKEND_DIST = path.join(APP_ROOT, 'dist', 'backend', 'server.js');
const POSTGRES_DIR = path.join(APP_ROOT, 'postgresql', 'pgsql');
const DATA_DIR = path.join(APP_ROOT, 'data', 'postgres');
const INIT_FLAG = path.join(APP_ROOT, 'data', '.initialized');

console.log('[SSMC Server] APP_ROOT:', APP_ROOT);
console.log('[SSMC Server] packaged:', app.isPackaged);
console.log('[SSMC Server] dev:', isDevelopment);

// ---------------------------------------------------------------------------
// MIME map
// ---------------------------------------------------------------------------
const MIME = {
  '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.ico':'image/x-icon',
  '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff',
  '.ttf':'font/ttf', '.map':'application/json',
};

// ---------------------------------------------------------------------------
// Proxy to backend
// ---------------------------------------------------------------------------
function proxyToBackend(req, res) {
  const options = {
    hostname: '127.0.0.1',
    port: BACKEND_INTERNAL_PORT,
    path: req.url,
    method: req.method,
    headers: Object.assign({}, req.headers, { host: '127.0.0.1:' + BACKEND_INTERNAL_PORT }),
  };

  const proxyReq = http.request(options, function (backendRes) {
    res.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(res);
  });

  proxyReq.on('error', function (err) {
    console.error('[SSMC Server] Proxy error:', err.message);
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Backend unavailable', message: err.message }));
  });

  req.pipe(proxyReq);
}

// ---------------------------------------------------------------------------
// Frontend server - serves static files + proxies API
// ---------------------------------------------------------------------------
function startFrontendServer(port, distDir) {
  return new Promise(function (resolve, reject) {
    var server = http.createServer(function (req, res) {
      // API + health → proxy when backend is up, else 503 JSON
      if (req.url === '/health' || req.url.startsWith('/api/') || req.url === '/api') {
        if (backendHealthy) {
          return proxyToBackend(req, res);
        }
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Backend not available',
          message: 'The application backend is starting. Please wait...',
        }));
        return;
      }

      // Static files with SPA fallback
      var filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      fs.readFile(filePath, function (err, data) {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.listen(port, '127.0.0.1', function () {
      console.log('[SSMC Server] Frontend server up on port', port);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Check if first run
// ---------------------------------------------------------------------------
function isFirstRun() {
  return !fs.existsSync(INIT_FLAG);
}

// ---------------------------------------------------------------------------
// Run server initialization
// ---------------------------------------------------------------------------
function runServerInit() {
  return new Promise(function (resolve, reject) {
    console.log('[SSMC Server] Running first-time server initialization...');

    const { main } = require(path.join(APP_ROOT, 'server-init.js'));

    main()
      .then(() => {
        // Create initialization flag
        fs.writeFileSync(INIT_FLAG, new Date().toISOString());
        resolve();
      })
      .catch(reject);
  });
}

// ---------------------------------------------------------------------------
// Start PostgreSQL server
// ---------------------------------------------------------------------------
function startPostgresServer() {
  return new Promise(function (resolve, reject) {
    console.log('[SSMC Server] Starting PostgreSQL server...');

    const pgCtlPath = path.join(POSTGRES_DIR, 'bin', 'pg_ctl.exe');
    const logFile = path.join(APP_ROOT, 'data', 'postgres.log');

    if (!fs.existsSync(pgCtlPath)) {
      console.error('[SSMC Server] PostgreSQL not found at:', pgCtlPath);
      reject(new Error('PostgreSQL binaries not found'));
      return;
    }

    // Check if already running
    try {
      const { execSync } = require('child_process');
      execSync(`"${pgCtlPath}" -D "${DATA_DIR}" status`, { stdio: 'ignore' });
      console.log('[SSMC Server] PostgreSQL already running');
      resolve();
      return;
    } catch (e) {
      // Not running, start it
    }

    postgresProcess = spawn(
      pgCtlPath,
      ['-D', DATA_DIR, '-l', logFile, '-o', '-p 5432', 'start'],
      { detached: false }
    );

    postgresProcess.on('error', function (err) {
      console.error('[SSMC Server] PostgreSQL start error:', err.message);
      reject(err);
    });

    // Wait for PostgreSQL to start
    setTimeout(() => {
      console.log('[SSMC Server] PostgreSQL server started');
      resolve();
    }, 3000);
  });
}

// ---------------------------------------------------------------------------
// Load Express backend in-process
// ---------------------------------------------------------------------------
function tryLoadBackend() {
  return new Promise(function (resolve) {
    if (!fs.existsSync(BACKEND_DIST)) {
      console.log('[SSMC Server] Backend script not found — skip');
      resolve(false);
      return;
    }

    // Set CWD and load environment
    try { process.chdir(APP_ROOT); } catch (e) { /* ignore */ }

    try {
      var dotenv = require('dotenv');
      dotenv.config({ path: path.join(APP_ROOT, '.env') });
    } catch (e) {
      console.warn('[SSMC Server] dotenv not available');
    }

    // Inject backend env vars
    process.env.PORT = String(BACKEND_INTERNAL_PORT);
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'http://localhost:' + FRONTEND_PORT;

    // Guard against process.exit(1)
    var origExit = process.exit;
    process.exit = function (code) {
      if (code !== 0) {
        console.error('[SSMC Server] Backend called process.exit(' + code + ') — prevented');
        backendHealthy = false;
        return;
      }
      origExit.call(process, code);
    };

    // Require backend
    console.log('[SSMC Server] Loading backend in-process…');
    try {
      require(BACKEND_DIST);
    } catch (err) {
      console.error('[SSMC Server] Backend require() failed:', err.message);
      process.exit = origExit;
      resolve(false);
      return;
    }

    // Poll /health
    var attempts = 0;
    var tick = setInterval(function () {
      http.get('http://127.0.0.1:' + BACKEND_INTERNAL_PORT + '/health', function (res) {
        clearInterval(tick);
        console.log('[SSMC Server] Backend healthy (status ' + res.statusCode + ')');
        process.exit = origExit;
        backendHealthy = true;
        resolve(true);
      }).on('error', function () {
        if (++attempts >= 20) {
          clearInterval(tick);
          process.exit = origExit;
          console.log('[SSMC Server] Backend did not become healthy in 10 s');
          resolve(false);
        }
      });
    }, 500);
  });
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
ipcMain.handle('app:getVersion', function () { return app.getVersion(); });
ipcMain.handle('app:getPath', function (_e, name) { return app.getPath(name); });
ipcMain.handle('network:getStatus', function () {
  return { online: true, lastChecked: new Date().toISOString() };
});
ipcMain.handle('sync:getStatus', function () {
  return { lastSync: null, pendingChanges: 0, syncInProgress: false };
});
ipcMain.handle('sync:start', function () { return { success: false, message: 'Sync not available' }; });
ipcMain.handle('db:query', function () { throw new Error('Local database not available'); });
ipcMain.handle('db:execute', function () { throw new Error('Local database not available'); });
ipcMain.handle('file:read', function (_e, filePath) {
  try { return { success: true, data: fs.readFileSync(filePath, 'utf-8') }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('file:write', function (_e, filePath, content) {
  try { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 768,
    title: 'SSMC EMR Server',
    icon: path.join(APP_ROOT, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(APP_ROOT, 'dist', 'electron', 'preload.js'),
    },
  });

  console.log('[SSMC Server] loadURL:', url);
  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', function () { mainWindow.show(); mainWindow.focus(); });
  if (isDevelopment) mainWindow.webContents.openDevTools();
  mainWindow.on('closed', function () { mainWindow = null; });

  createMenu();
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
function createMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
      { role: 'delete' }, { type: 'separator' }, { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
      { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
    ]},
    { label: 'Help', submenu: [{
      label: 'About SSMC EMR',
      click: function () {
        dialog.showMessageBox({
          title: 'About SSMC EMR',
          message: 'SSMC EMR — St. Stephen Medical Centre\\nElectronic Medical Records (Server)\\nv1.0.0',
          buttons: ['OK'],
        });
      },
    }]},
  ]));
}

// ---------------------------------------------------------------------------
// Single-instance lock
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', function () {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------
app.whenReady().then(async function () {
  console.log('[SSMC Server] app ready');

  var url;
  if (isDevelopment) {
    url = 'http://localhost:' + FRONTEND_DEV_PORT;
  } else {
    try {
      // Check if first run
      if (isFirstRun()) {
        console.log('[SSMC Server] First run detected - running initialization...');
        await runServerInit();
      }

      // Start PostgreSQL server
      await startPostgresServer();

      // Load backend
      var backendOk = await tryLoadBackend();
      console.log('[SSMC Server] Backend', backendOk ? 'started successfully' : 'not available');

      // Start frontend server
      await startFrontendServer(FRONTEND_PORT, FRONTEND_DIST);

      url = 'http://localhost:' + FRONTEND_PORT;
    } catch (error) {
      console.error('[SSMC Server] Startup error:', error.message);
      dialog.showErrorBox('Startup Error', 'Failed to start SSMC EMR Server: ' + error.message);
      app.quit();
      return;
    }
  }

  createWindow(url);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
});

// ---------------------------------------------------------------------------
// Cleanup on exit
// ---------------------------------------------------------------------------
app.on('window-all-closed', function () {
  // Stop PostgreSQL on exit
  if (postgresProcess) {
    const pgCtlPath = path.join(POSTGRES_DIR, 'bin', 'pg_ctl.exe');
    try {
      const { execSync } = require('child_process');
      execSync(`"${pgCtlPath}" -D "${DATA_DIR}" stop`);
      console.log('[SSMC Server] PostgreSQL stopped');
    } catch (e) {
      console.error('[SSMC Server] Error stopping PostgreSQL:', e.message);
    }
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
