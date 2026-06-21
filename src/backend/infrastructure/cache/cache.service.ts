/**
 * Cache Service
 *
 * Provides in-memory caching for frequently accessed data.
 * Can be extended to use Redis or other caching solutions.
 */

import { logger } from '../../config/logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTtl: number;

  constructor(defaultTtlSeconds: number = 300) {
    this.cache = new Map();
    this.defaultTtl = defaultTtlSeconds * 1000; // Convert to milliseconds
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      logger.debug(`Cache expired for key: ${key}`);
      return null;
    }

    logger.debug(`Cache hit for key: ${key}`);
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expiresAt,
    });

    logger.debug(`Cache set for key: ${key}, TTL: ${ttl}ms`);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
    logger.debug(`Cache deleted for key: ${key}`);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cache cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(intervalSeconds: number = 60): NodeJS.Timer {
    return setInterval(() => {
      this.cleanup();
    }, intervalSeconds * 1000);
  }
}

// Export singleton instance
export const cacheService = new CacheService();
