/**
 * Redis Utility Module
 * Version: 1.0.0
 * 
 * Provides centralized Redis client instance and helper functions for caching,
 * session management, and rate limiting in the multi-tenant CRM system.
 * 
 * @module utils/redis
 */

import Redis from 'ioredis'; // ^5.3.2
import crypto from 'crypto';
import { redisConfig } from '../config/redis.config';
import logger from './logger';
import { ErrorCode } from '../constants/errorCodes';

/**
 * Interface for enhanced cache operation options
 */
interface CacheOptions {
  ttl: number;
  tenant: string;
  encrypted?: boolean;
  compression?: boolean;
  tags?: string[];
}

/**
 * Interface for sliding window rate limit tracking
 */
interface RateLimitInfo {
  count: number;
  resetTime: number;
  windowSize: number;
  maxRequests: number;
  tenant: string;
}

/**
 * Interface for session management data
 */
interface SessionData {
  id: string;
  tenant: string;
  data: any;
  expiresAt: number;
  lastAccessed: number;
}

/**
 * Enhanced singleton Redis client wrapper with tenant isolation and security
 */
class RedisClient {
  private static instance: RedisClient;
  private client: Redis;
  private isConnected: boolean = false;
  private connectionPool: Map<string, Redis> = new Map();
  private encryptionKey: Buffer;
  private healthCheckInterval?: NodeJS.Timer;

  private constructor() {
    this.encryptionKey = crypto.randomBytes(32);
    this.initializeClient();
    this.setupHealthCheck();
  }

  /**
   * Gets singleton instance of RedisClient
   */
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * Initializes Redis client with enhanced security and monitoring
   */
  private initializeClient(): void {
    const options = {
      host: redisConfig.connection.host,
      port: redisConfig.connection.port,
      password: redisConfig.connection.password,
      tls: redisConfig.connection.tls.enabled ? {
        cert: redisConfig.connection.tls.cert,
        key: redisConfig.connection.tls.key,
        ca: redisConfig.connection.tls.ca,
      } : undefined,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    this.client = new Redis(options);

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis client connected successfully');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis client error:', error);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis client connection closed');
    });
  }

  /**
   * Sets up periodic health check for Redis connection
   */
  private setupHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.client.ping();
        logger.debug('Redis health check: OK');
      } catch (error) {
        logger.error('Redis health check failed:', error);
        this.isConnected = false;
        await this.reconnect();
      }
    }, redisConfig.monitoring.healthCheck.interval);
  }

  /**
   * Attempts to reconnect to Redis server
   */
  private async reconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.initializeClient();
    } catch (error) {
      logger.error('Redis reconnection failed:', error);
    }
  }

  /**
   * Generates tenant-specific cache key
   */
  private getTenantKey(key: string, tenant: string): string {
    const sanitizedKey = key.replace(/[^a-zA-Z0-9:-]/g, '');
    const tenantPrefix = `tenant:${tenant}`;
    return `${tenantPrefix}:${sanitizedKey}`;
  }

  /**
   * Encrypts sensitive data before caching
   */
  private encrypt(data: any): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }

  /**
   * Decrypts cached data
   */
  private decrypt(encryptedData: string): any {
    const { iv, data, authTag } = JSON.parse(encryptedData);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(data, 'hex')),
      decipher.final()
    ]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Sets value in cache with tenant isolation
   */
  public async set(key: string, value: any, options: CacheOptions): Promise<void> {
    try {
      const tenantKey = this.getTenantKey(key, options.tenant);
      let dataToCache = value;

      if (options.encrypted) {
        dataToCache = this.encrypt(value);
      }

      if (options.compression) {
        // Implement compression logic here if needed
      }

      await this.client.set(tenantKey, JSON.stringify(dataToCache), 'EX', options.ttl);

      if (options.tags?.length) {
        await this.client.sadd(`tags:${options.tenant}`, ...options.tags);
        for (const tag of options.tags) {
          await this.client.sadd(`tag:${options.tenant}:${tag}`, tenantKey);
        }
      }
    } catch (error) {
      logger.error('Cache set error:', error);
      throw new Error(`Cache operation failed: ${error.message}`);
    }
  }

  /**
   * Gets value from cache with tenant isolation
   */
  public async get<T>(key: string, tenant: string, encrypted: boolean = false): Promise<T | null> {
    try {
      const tenantKey = this.getTenantKey(key, tenant);
      const cachedData = await this.client.get(tenantKey);

      if (!cachedData) {
        return null;
      }

      let parsedData = JSON.parse(cachedData);

      if (encrypted) {
        parsedData = this.decrypt(parsedData);
      }

      return parsedData as T;
    } catch (error) {
      logger.error('Cache get error:', error);
      throw new Error(`Cache retrieval failed: ${error.message}`);
    }
  }

  /**
   * Implements sliding window rate limiting
   */
  public async checkRateLimit(key: string, info: RateLimitInfo): Promise<boolean> {
    const tenantKey = this.getTenantKey(`ratelimit:${key}`, info.tenant);
    const now = Date.now();
    const windowStart = now - (info.windowSize * 1000);

    try {
      await this.client.zremrangebyscore(tenantKey, 0, windowStart);
      const requestCount = await this.client.zcard(tenantKey);

      if (requestCount >= info.maxRequests) {
        return false;
      }

      await this.client.zadd(tenantKey, now, now.toString());
      await this.client.expire(tenantKey, info.windowSize);
      return true;
    } catch (error) {
      logger.error('Rate limit check error:', error);
      throw new Error(`Rate limit check failed: ${error.message}`);
    }
  }

  /**
   * Manages user sessions with security
   */
  public async setSession(sessionData: SessionData): Promise<void> {
    try {
      const sessionKey = this.getTenantKey(`session:${sessionData.id}`, sessionData.tenant);
      const encryptedData = this.encrypt(sessionData.data);
      const ttl = Math.floor((sessionData.expiresAt - Date.now()) / 1000);

      await this.client.set(
        sessionKey,
        JSON.stringify({
          ...sessionData,
          data: encryptedData
        }),
        'EX',
        ttl
      );
    } catch (error) {
      logger.error('Session set error:', error);
      throw new Error(`Session operation failed: ${error.message}`);
    }
  }

  /**
   * Retrieves user session data
   */
  public async getSession(sessionId: string, tenant: string): Promise<SessionData | null> {
    try {
      const sessionKey = this.getTenantKey(`session:${sessionId}`, tenant);
      const sessionData = await this.client.get(sessionKey);

      if (!sessionData) {
        return null;
      }

      const parsedSession = JSON.parse(sessionData);
      parsedSession.data = this.decrypt(parsedSession.data);

      return parsedSession;
    } catch (error) {
      logger.error('Session get error:', error);
      throw new Error(`Session retrieval failed: ${error.message}`);
    }
  }

  /**
   * Gracefully closes Redis connection
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      for (const [, client] of this.connectionPool) {
        await client.quit();
      }
      this.connectionPool.clear();

      if (this.client) {
        await this.client.quit();
      }

      this.isConnected = false;
      logger.info('Redis client disconnected successfully');
    } catch (error) {
      logger.error('Redis disconnect error:', error);
      throw new Error(`Disconnect failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const redisClient = RedisClient.getInstance();

// Export interfaces for consumers
export type {
  CacheOptions,
  RateLimitInfo,
  SessionData
};