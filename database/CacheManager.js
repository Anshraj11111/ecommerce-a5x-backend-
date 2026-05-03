import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

/**
 * CacheManager manages Redis-based caching with cache-aside pattern,
 * TTL management, and graceful degradation.
 * 
 * Features:
 * - Redis-based caching with configurable TTL
 * - Cache-aside pattern implementation
 * - Pattern-based cache invalidation
 * - Graceful degradation when Redis is unavailable
 * - Automatic reconnection handling
 */
export class CacheManager {
  constructor() {
    this.client = null;
    this.config = null;
    this.isInitialized = false;
    this.available = false;
  }

  /**
   * Initialize the cache manager with Redis configuration
   * @param {Object} config Cache configuration including Redis connection details
   */
  async initialize(config) {
    if (this.isInitialized) {
      logger.warn('CacheManager already initialized');
      return;
    }

    // Check if Redis is disabled via environment variable
    if (process.env.REDIS_ENABLED === 'false') {
      logger.info('Redis is disabled via REDIS_ENABLED=false');
      logger.info('CacheManager will operate in degraded mode (no caching)');
      this.isInitialized = true;
      this.available = false;
      return;
    }

    this.config = config;

    try {
      // Create Redis client with configuration
      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        retryStrategy: config.retryStrategy || this.defaultRetryStrategy.bind(this),
        maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
        enableOfflineQueue: config.enableOfflineQueue ?? false,
        lazyConnect: true, // Don't connect immediately, we'll do it manually
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Attempt to connect
      await this.client.connect();

      this.isInitialized = true;
      this.available = true;
      logger.info('CacheManager initialized successfully');
      logger.info(`Redis connected at ${config.host}:${config.port}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize CacheManager: ${errorMessage}`);
      logger.warn('CacheManager will operate in degraded mode (no caching)');
      
      // Don't throw - allow graceful degradation
      this.available = false;
      this.isInitialized = true; // Mark as initialized even if connection failed
    }
  }

  /**
   * Default retry strategy for Redis connection
   * @param {number} times Number of retry attempts
   * @returns {number|null} Delay in milliseconds or null to stop retrying
   */
  defaultRetryStrategy(times) {
    const maxRetries = 10;
    const maxDelay = 3000; // 3 seconds max delay

    if (times > maxRetries) {
      logger.error(`Redis connection failed after ${maxRetries} attempts`);
      return null; // Stop retrying
    }

    const delay = Math.min(times * 200, maxDelay);
    logger.info(`Retrying Redis connection in ${delay}ms (attempt ${times}/${maxRetries})`);
    return delay;
  }

  /**
   * Set up event handlers for Redis connection monitoring
   */
  setupEventHandlers() {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis connection established');
      this.available = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.available = true;
    });

    this.client.on('error', (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Redis connection error: ${errorMessage}`);
      this.available = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.available = false;
    });

    this.client.on('reconnecting', (delay) => {
      logger.info(`Redis reconnecting in ${delay}ms...`);
    });

    this.client.on('end', () => {
      logger.warn('Redis connection ended');
      this.available = false;
    });
  }

  /**
   * Check if Redis is available
   * @returns {boolean} true if Redis is connected and available
   */
  isAvailable() {
    return this.available && this.client !== null && this.client.status === 'ready';
  }

  /**
   * Get a value from cache
   * @param {string} key Cache key
   * @returns {Promise<any|null>} Cached value or null if not found or Redis unavailable
   */
  async get(key) {
    if (!this.isAvailable()) {
      logger.debug(`Cache miss (Redis unavailable): ${key}`);
      return null;
    }

    try {
      const value = await this.client.get(key);
      
      if (value === null) {
        logger.debug(`Cache miss: ${key}`);
        return null;
      }

      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(value);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Cache get error for key ${key}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   * @param {string} key Cache key
   * @param {any} value Value to cache
   * @param {number} ttl Time-to-live in seconds (optional)
   */
  async set(key, value, ttl) {
    if (!this.isAvailable()) {
      logger.debug(`Cache set skipped (Redis unavailable): ${key}`);
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      
      if (ttl !== undefined && ttl > 0) {
        await this.client.setex(key, ttl, serialized);
        logger.debug(`Cache set with TTL ${ttl}s: ${key}`);
      } else {
        await this.client.set(key, serialized);
        logger.debug(`Cache set (no TTL): ${key}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Cache set error for key ${key}: ${errorMessage}`);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Delete a single key from cache
   * @param {string} key Cache key to delete
   */
  async delete(key) {
    if (!this.isAvailable()) {
      logger.debug(`Cache delete skipped (Redis unavailable): ${key}`);
      return;
    }

    try {
      await this.client.del(key);
      logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Cache delete error for key ${key}: ${errorMessage}`);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Delete all keys matching a pattern
   * @param {string} pattern Pattern to match (e.g., "products:*")
   */
  async deletePattern(pattern) {
    if (!this.isAvailable()) {
      logger.debug(`Cache deletePattern skipped (Redis unavailable): ${pattern}`);
      return;
    }

    try {
      // Use SCAN to find matching keys (safer than KEYS for production)
      const keys = [];
      let cursor = '0';

      do {
        const [nextCursor, matchedKeys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...matchedKeys);
      } while (cursor !== '0');

      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.debug(`Cache deleted ${keys.length} keys matching pattern: ${pattern}`);
      } else {
        logger.debug(`No keys found matching pattern: ${pattern}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Cache deletePattern error for pattern ${pattern}: ${errorMessage}`);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Get the configured TTL for a specific cache type
   * @param {string} type Cache type (productList, productDetail, courseList, kitList)
   * @returns {number} TTL in seconds
   */
  getTTL(type) {
    if (!this.config) {
      throw new Error('CacheManager not initialized');
    }
    return this.config.ttl[type];
  }

  /**
   * Close the Redis connection
   */
  async close() {
    if (this.client) {
      logger.info('Closing Redis connection...');
      
      try {
        // Only quit if the client is connected
        if (this.client.status === 'ready' || this.client.status === 'connect') {
          await this.client.quit();
        } else {
          // Disconnect without waiting for graceful shutdown
          this.client.disconnect();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Error closing Redis connection: ${errorMessage}`);
        // Force disconnect
        this.client.disconnect();
      }
      
      this.client = null;
      this.available = false;
      this.isInitialized = false;
      logger.info('Redis connection closed');
    }
  }

  /**
   * Ping Redis to check connectivity
   * @returns {Promise<boolean>} true if Redis responds to ping
   */
  async ping() {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const response = await this.client.ping();
      return response === 'PONG';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Redis ping failed: ${errorMessage}`);
      return false;
    }
  }
}

// Singleton instance
let cacheManagerInstance = null;

/**
 * Get the singleton instance of CacheManager
 * @returns {CacheManager} The CacheManager instance
 */
export function getCacheManager() {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager();
  }
  return cacheManagerInstance;
}
