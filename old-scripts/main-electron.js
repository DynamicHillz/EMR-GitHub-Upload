/**
 * Electron Main Process - Fixed version
 */

// Check if we're running in Electron
if (!process.versions.electron) {
  console.error('This script must be run with Electron!');
  process.exit(1);
}

console.log('Running in Electron:', process.versions.electron);
console.log('Process type:', process.type);

// Try dynamic require with error handling
let electron;
try {
  // In Electron, this should work
  electron = require('electron');
  console.log('Electron module type:', typeof electron);

  if (typeof electron === 'string') {
    console.error('ERROR: Got electron path instead of API. This indicates module resolution failure.');
    console.error('Path:', electron);
    process.exit(1);
  }

  console.log('Successfully loaded Electron API');
} catch (error) {
  console.error('Failed to require electron:', error);
  process.exit(1);
}

const { app, BrowserWindow, Menu } = electron;
const path = require('path');

console.log('App loaded:', typeof app);
console.log('BrowserWindow loaded:', typeof BrowserWindow);

// Keep a global reference
let mainWindow = null;

// App configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const FRONTEND_PORT = isDevelopment ? 5173 : 3000;

function createWindow() {
  console.log('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'dist', 'electron', 'preload.js'),
    },
    show: false,
  });

  const startUrl = `http://localhost:${FRONTEND_PORT}`;
  console.log('Loading URL:', startUrl);

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
    mainWindow.focus();
  });

  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Simple menu
  const template = [
    {
      label: 'File',
      submenu: [{ role: 'quit' }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Initialize app
console.log('Waiting for app ready...');

app.whenReady().then(() => {
  console.log('App is ready!');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('Main process script completed');
