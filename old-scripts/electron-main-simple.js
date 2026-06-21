/**
 * SSMC EMR — Electron Main Process
 *
 * Development : loads http://localhost:5173  (Vite dev server)
 * Production  : loads the Express backend in-process on port 3001 and
 *               starts a combined HTTP server on port 3000 that
 *                 • serves static frontend files (SPA fallback)
 *                 • proxies /api/* + /health to the backend when it is healthy
 *                 • returns a JSON 503 for /api/* when the backend is down
 *               This keeps everything same-origin for the renderer and avoids
 *               CORS issues regardless of whether the backend is running.
 */

const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path   = require('path');
const http   = require('http');
const fs     = require('fs');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
let mainWindow     = null;
let backendHealthy = false;                  // flipped when /health responds 200

const isDevelopment        = process.env.NODE_ENV !== 'production';
const FRONTEND_PORT        = 3000;           // exposed to the renderer window
const BACKEND_INTERNAL_PORT = 3001;          // only the main process talks here
const FRONTEND_DEV_PORT    = 5173;

// App root: asar disabled → files live in resources/app/
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.resolve(__dirname);

const FRONTEND_DIST = path.join(APP_ROOT, 'dist', 'frontend');
const BACKEND_DIST  = path.join(APP_ROOT, 'dist', 'backend', 'server.js');

console.log('[SSMC] APP_ROOT :', APP_ROOT);
console.log('[SSMC] packaged :', app.isPackaged);
console.log('[SSMC] dev      :', isDevelopment);

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
// Proxy a single request → backend
// ---------------------------------------------------------------------------
function proxyToBackend(req, res) {
  const options = {
    hostname: '127.0.0.1',
    port:     BACKEND_INTERNAL_PORT,
    path:     req.url,
    method:   req.method,
    headers:  Object.assign({}, req.headers, { host: '127.0.0.1:' + BACKEND_INTERNAL_PORT }),
  };

  const proxyReq = http.request(options, function (backendRes) {
    res.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(res);
  });

  proxyReq.on('error', function (err) {
    console.error('[SSMC] Proxy error:', err.message);
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Backend unavailable', message: err.message }));
  });

  req.pipe(proxyReq);
}

// ---------------------------------------------------------------------------
// Combined HTTP server — static files + API proxy/stub
// ---------------------------------------------------------------------------
function startFrontendServer(port, distDir) {
  return new Promise(function (resolve, reject) {
    var server = http.createServer(function (req, res) {

      // ------------------------------------------------------------------
      // API + health  →  proxy when backend is up, else 503 JSON
      // ------------------------------------------------------------------
      if (req.url === '/health' || req.url.startsWith('/api/') || req.url === '/api') {
        if (backendHealthy) {
          return proxyToBackend(req, res);
        }
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Backend not available',
          message: 'The application backend is not running. Some features require an internet connection.',
        }));
        return;
      }

      // ------------------------------------------------------------------
      // Static files  →  serve from dist/frontend with SPA fallback
      // ------------------------------------------------------------------
      var filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');   // SPA fallback
      }

      fs.readFile(filePath, function (err, data) {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.listen(port, '127.0.0.1', function () {
      console.log('[SSMC] Frontend server up on port', port);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Load the Express backend in-process (require, not spawn)
// process.execPath in Electron IS the Electron binary, so child_process.spawn
// would just open another Electron window.  Running the Express app inside the
// main-process Node.js context avoids that problem entirely.
// ---------------------------------------------------------------------------
function tryLoadBackend() {
  return new Promise(function (resolve) {
    if (!fs.existsSync(BACKEND_DIST)) {
      console.log('[SSMC] Backend script not found — skip');
      resolve(false);
      return;
    }

    // 1) Set CWD so dotenv & relative paths inside the backend resolve correctly
    try { process.chdir(APP_ROOT); } catch (e) { /* ignore */ }

    // 2) Pre-load .env from APP_ROOT (dotenv inside the backend will find vars
    //    already set and won't overwrite them)
    try {
      var dotenv = require('dotenv');
      dotenv.config({ path: path.join(APP_ROOT, '.env') });
    } catch (e) {
      console.warn('[SSMC] dotenv not available — relying on system env');
    }

    // 3) Inject backend env vars
    process.env.PORT         = String(BACKEND_INTERNAL_PORT);
    process.env.NODE_ENV     = 'production';
    process.env.FRONTEND_URL = 'http://localhost:' + FRONTEND_PORT;

    // 4) Guard against the backend calling process.exit(1) on DB failure —
    //    we want Electron to keep running and fall back gracefully.
    var origExit = process.exit;
    process.exit = function (code) {
      if (code !== 0) {
        console.error('[SSMC] Backend called process.exit(' + code + ') — prevented; backend unavailable');
        backendHealthy = false;
        return;                          // swallow the exit
      }
      origExit.call(process, code);      // allow clean exit
    };

    // 5) Require the compiled backend (this calls startServer() which is async)
    console.log('[SSMC] Loading backend in-process…');
    try {
      require(BACKEND_DIST);
    } catch (err) {
      console.error('[SSMC] Backend require() failed:', err.message);
      process.exit = origExit;
      resolve(false);
      return;
    }

    // 6) Poll /health on the internal port — up to 10 s (20 × 500 ms)
    var attempts = 0;
    var tick = setInterval(function () {
      http.get('http://127.0.0.1:' + BACKEND_INTERNAL_PORT + '/health', function (res) {
        clearInterval(tick);
        console.log('[SSMC] Backend healthy (status ' + res.statusCode + ')');
        process.exit = origExit;         // restore once we know it started
        backendHealthy = true;
        resolve(true);
      }).on('error', function () {
        if (++attempts >= 20) {
          clearInterval(tick);
          process.exit = origExit;
          console.log('[SSMC] Backend did not become healthy in 10 s');
          resolve(false);
        }
      });
    }, 500);
  });
}


// ---------------------------------------------------------------------------
// IPC handlers — stubs so the preload / renderer never crash on missing
// ---------------------------------------------------------------------------
ipcMain.handle('app:getVersion',  function () { return app.getVersion(); });
ipcMain.handle('app:getPath',     function (_e, name) { return app.getPath(name); });
ipcMain.handle('network:getStatus', function () {
  return { online: true, lastChecked: new Date().toISOString() };
});
ipcMain.handle('sync:getStatus',  function () {
  return { lastSync: null, pendingChanges: 0, syncInProgress: false };
});
ipcMain.handle('sync:start',      function () { return { success: false, message: 'Sync not available' }; });
ipcMain.handle('db:query',        function () { throw new Error('Local database not available'); });
ipcMain.handle('db:execute',      function () { throw new Error('Local database not available'); });
ipcMain.handle('file:read', function (_e, filePath) {
  try  { return { success: true,  data:  fs.readFileSync(filePath, 'utf-8') }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('file:write', function (_e, filePath, content) {
  try  { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 768,
    title: 'SSMC EMR',
    icon: path.join(APP_ROOT, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(APP_ROOT, 'dist', 'electron', 'preload.js'),
    },
  });

  console.log('[SSMC] loadURL:', url);
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
          message: 'SSMC EMR — St. Stephen Medical Centre\nElectronic Medical Records\nv1.0.0',
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
  console.log('[SSMC] app ready');

  var url;
  if (isDevelopment) {
    url = 'http://localhost:' + FRONTEND_DEV_PORT;
  } else {
    // 1) Try to load the Express backend in-process (waits up to 10 s for /health)
    var backendOk = await tryLoadBackend();
    console.log('[SSMC] Backend', backendOk ? 'started successfully' : 'not available — continuing without API');

    // 2) Start frontend server (always — serves files AND proxies API)
    await startFrontendServer(FRONTEND_PORT, FRONTEND_DIST);

    url = 'http://localhost:' + FRONTEND_PORT;
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
