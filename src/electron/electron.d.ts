/**
 * Electron API Type Definitions
 *
 * Provides TypeScript types for the Electron API exposed via contextBridge
 */

export interface ElectronAPI {
  app: {
    getVersion: () => Promise<string>;
    getPath: (name: string) => Promise<string>;
  };

  network: {
    getStatus: () => Promise<{ online: boolean }>;
    onStatusChange: (callback: (status: { online: boolean }) => void) => () => void;
  };

  database: {
    query: (query: string, params: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
    execute: (query: string, params: any[]) => Promise<{ success: boolean; error?: string }>;
  };

  sync: {
    start: () => Promise<{ success: boolean; error?: string }>;
    getStatus: () => Promise<{
      lastSync: Date | null;
      pendingChanges: number;
      syncInProgress: boolean;
    }>;
    onProgress: (callback: (progress: any) => void) => () => void;
  };

  file: {
    read: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    write: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  };

  platform: {
    name: string;
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
