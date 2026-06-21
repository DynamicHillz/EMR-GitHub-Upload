/**
 * Electron Preload Script
 *
 * Runs in a sandboxed context with access to both Node.js and browser APIs.
 * Exposes safe APIs to the renderer process via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Exposed API for renderer process
 */
const electronAPI = {
  // App information
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  },

  // Network status
  network: {
    getStatus: () => ipcRenderer.invoke('network:getStatus'),
    onStatusChange: (callback: (status: { online: boolean }) => void) => {
      ipcRenderer.on('network:statusChanged', (_event, status) => callback(status));
      return () => {
        ipcRenderer.removeAllListeners('network:statusChanged');
      };
    },
  },

  // Database operations
  database: {
    query: (query: string, params: any[]) => ipcRenderer.invoke('db:query', query, params),
    execute: (query: string, params: any[]) => ipcRenderer.invoke('db:execute', query, params),
  },

  // Sync operations
  sync: {
    start: () => ipcRenderer.invoke('sync:start'),
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('sync:progress', (_event, progress) => callback(progress));
      return () => {
        ipcRenderer.removeAllListeners('sync:progress');
      };
    },
  },

  // File operations
  file: {
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
  },

  // Platform information
  platform: {
    name: process.platform,
    isWindows: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
  },
};

/**
 * Expose API to renderer process
 */
contextBridge.exposeInMainWorld('electron', electronAPI);

/**
 * Type definitions for renderer process
 * Place this in a .d.ts file for TypeScript projects:
 *
 * declare global {
 *   interface Window {
 *     electron: typeof electronAPI;
 *   }
 * }
 */

console.log('Preload script loaded');
console.log('Platform:', process.platform);
console.log('Electron version:', process.versions.electron);
console.log('Chrome version:', process.versions.chrome);
console.log('Node version:', process.versions.node);
