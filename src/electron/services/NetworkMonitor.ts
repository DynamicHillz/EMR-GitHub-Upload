/**
 * Network Monitor Service
 *
 * Monitors network connectivity and notifies the application of status changes.
 * Implements multiple detection methods for reliability.
 */

import { BrowserWindow } from 'electron';
import * as https from 'https';

export interface NetworkStatus {
  online: boolean;
  lastChecked: Date;
  latency?: number;
}

export class NetworkMonitor {
  private mainWindow: BrowserWindow | null;
  private checkInterval: NodeJS.Timeout | null = null;
  private currentStatus: NetworkStatus;
  private checkIntervalMs: number = 30000; // Check every 30 seconds
  private apiEndpoint: string;

  constructor(mainWindow: BrowserWindow | null, apiEndpoint: string = 'https://www.google.com') {
    this.mainWindow = mainWindow;
    this.apiEndpoint = apiEndpoint;
    this.currentStatus = {
      online: true,
      lastChecked: new Date(),
    };
  }

  /**
   * Start monitoring network status
   */
  start(): void {
    console.log('Network monitor started');

    // Initial check
    this.checkNetworkStatus();

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.checkNetworkStatus();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('Network monitor stopped');
  }

  /**
   * Check network status using multiple methods
   */
  private async checkNetworkStatus(): Promise<void> {
    const startTime = Date.now();

    try {
      // Method 1: Try to reach a reliable endpoint
      const isOnline = await this.pingEndpoint(this.apiEndpoint);
      const latency = Date.now() - startTime;

      const newStatus: NetworkStatus = {
        online: isOnline,
        lastChecked: new Date(),
        latency: isOnline ? latency : undefined,
      };

      // Check if status changed
      if (newStatus.online !== this.currentStatus.online) {
        console.log(`Network status changed: ${newStatus.online ? 'ONLINE' : 'OFFLINE'}`);
        this.currentStatus = newStatus;
        this.notifyStatusChange(newStatus);
      } else {
        this.currentStatus = newStatus;
      }
    } catch (error) {
      console.error('Error checking network status:', error);

      // Assume offline on error
      const newStatus: NetworkStatus = {
        online: false,
        lastChecked: new Date(),
      };

      if (this.currentStatus.online !== false) {
        this.currentStatus = newStatus;
        this.notifyStatusChange(newStatus);
      }
    }
  }

  /**
   * Ping endpoint to check connectivity
   */
  private pingEndpoint(url: string, timeout: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: '/',
        method: 'HEAD',
        timeout,
      };

      const req = https.request(options, (res) => {
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Notify renderer process of status change
   */
  private notifyStatusChange(status: NetworkStatus): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('network:statusChanged', status);
    }
  }

  /**
   * Get current status
   */
  getStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }

  /**
   * Force a network check
   */
  async forceCheck(): Promise<NetworkStatus> {
    await this.checkNetworkStatus();
    return this.getStatus();
  }

  /**
   * Update check interval
   */
  setCheckInterval(intervalMs: number): void {
    this.checkIntervalMs = intervalMs;

    // Restart monitoring with new interval
    if (this.checkInterval) {
      this.stop();
      this.start();
    }
  }

  /**
   * Update API endpoint to check
   */
  setApiEndpoint(endpoint: string): void {
    this.apiEndpoint = endpoint;
  }
}

/**
 * Singleton network monitor instance
 */
let networkMonitorInstance: NetworkMonitor | null = null;

export function getNetworkMonitor(
  mainWindow?: BrowserWindow,
  apiEndpoint?: string
): NetworkMonitor {
  if (!networkMonitorInstance && mainWindow) {
    networkMonitorInstance = new NetworkMonitor(mainWindow, apiEndpoint);
  }

  if (!networkMonitorInstance) {
    throw new Error('Network monitor not initialized. Provide mainWindow on first call.');
  }

  return networkMonitorInstance;
}

export function stopNetworkMonitor(): void {
  if (networkMonitorInstance) {
    networkMonitorInstance.stop();
    networkMonitorInstance = null;
  }
}
