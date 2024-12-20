/**
 * Redis Configuration Module
 * Version: 1.0.0
 * 
 * Comprehensive Redis configuration for multi-tenant CRM system with enhanced
 * security, monitoring, and performance optimization features.
 * 
 * @module config/redis.config
 */

import { config } from 'dotenv'; // ^16.0.0
config(); // Load environment variables

/**
 * Redis Configuration Interface
 * Defines the complete structure for Redis settings including security,
 * caching, session management, and monitoring features
 */
interface RedisConfig {
  connection: {
    host: string;
    port: number;
    password: string;
    tls: {
      enabled: boolean;
      cert: string;
      key: string;
      ca: string;
    };
    db: number;
    keyPrefix: string;
    cluster: {
      enabled: boolean;
      nodes: string[];
    };
    sentinel: {
      enabled: boolean;
      masterName: string;
      nodes: string[];
    };
  };
  cache: {
    ttl: number;
    maxKeys: number;
    invalidationEvents: boolean;
    encryption: {
      enabled: boolean;
      algorithm: string;
      key: string;
    };
    compression: {
      enabled: boolean;
      threshold: number;
    };
  };
  session: {
    ttl: number;
    prefix: string;
    rolling: boolean;
    secure: boolean;
    sameSite: string;
    domain: string;
    path: string;
    httpOnly: boolean;
  };
  rateLimit: {
    enabled: boolean;
    points: number;
    duration: number;
    blockDuration: number;
    tenantSpecific: {
      enabled: boolean;
      customLimits: Map<string, { points: number; duration: number }>;
    };
  };
  monitoring: {
    enabled: boolean;
    metrics: {
      enabled: boolean;
      interval: number;
    };
    healthCheck: {
      enabled: boolean;
      interval: number;
      timeout: number;
    };
  };
}

/**
 * Validates Redis configuration settings with comprehensive security checks
 * @param config - Redis configuration object
 * @throws Error if configuration is invalid
 */
const validateRedisConfig = (config: RedisConfig): void => {
  // Connection validation
  if (!config.connection.host) {
    throw new Error('Redis host is required');
  }
  if (config.connection.port < 1 || config.connection.port > 65535) {
    throw new Error('Invalid Redis port');
  }

  // TLS validation
  if (config.connection.tls.enabled) {
    if (!config.connection.tls.cert || !config.connection.tls.key) {
      throw new Error('TLS certificate and key are required when TLS is enabled');
    }
  }

  // Cluster validation
  if (config.connection.cluster.enabled && (!config.connection.cluster.nodes || config.connection.cluster.nodes.length === 0)) {
    throw new Error('Cluster nodes are required when cluster mode is enabled');
  }

  // Sentinel validation
  if (config.connection.sentinel.enabled) {
    if (!config.connection.sentinel.masterName || !config.connection.sentinel.nodes || config.connection.sentinel.nodes.length === 0) {
      throw new Error('Sentinel master name and nodes are required when sentinel is enabled');
    }
  }

  // Cache validation
  if (config.cache.encryption.enabled && !config.cache.encryption.key) {
    throw new Error('Encryption key is required when cache encryption is enabled');
  }

  // Session validation
  if (config.session.secure && !config.session.domain) {
    throw new Error('Session domain is required when secure sessions are enabled');
  }

  // Rate limiting validation
  if (config.rateLimit.enabled && (config.rateLimit.points <= 0 || config.rateLimit.duration <= 0)) {
    throw new Error('Invalid rate limiting configuration');
  }
};

/**
 * Redis Configuration
 * Production-ready Redis configuration with security features and monitoring
 */
export const redisConfig: RedisConfig = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    tls: {
      enabled: process.env.REDIS_TLS_ENABLED === 'true',
      cert: process.env.REDIS_TLS_CERT || '',
      key: process.env.REDIS_TLS_KEY || '',
      ca: process.env.REDIS_TLS_CA || '',
    },
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'crm:',
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES ? JSON.parse(process.env.REDIS_CLUSTER_NODES) : [],
    },
    sentinel: {
      enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
      masterName: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
      nodes: process.env.REDIS_SENTINEL_NODES ? JSON.parse(process.env.REDIS_SENTINEL_NODES) : [],
    },
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS || '10000', 10),
    invalidationEvents: process.env.CACHE_INVALIDATION_EVENTS === 'true',
    encryption: {
      enabled: process.env.CACHE_ENCRYPTION_ENABLED === 'true',
      algorithm: process.env.CACHE_ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      key: process.env.CACHE_ENCRYPTION_KEY || '',
    },
    compression: {
      enabled: process.env.CACHE_COMPRESSION_ENABLED === 'true',
      threshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024', 10),
    },
  },
  session: {
    ttl: parseInt(process.env.SESSION_TTL || '86400', 10),
    prefix: 'sess:',
    rolling: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    domain: process.env.SESSION_DOMAIN || '',
    path: '/',
    httpOnly: true,
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    points: parseInt(process.env.RATE_LIMIT_POINTS || '100', 10),
    duration: parseInt(process.env.RATE_LIMIT_DURATION || '3600', 10),
    blockDuration: parseInt(process.env.RATE_LIMIT_BLOCK_DURATION || '7200', 10),
    tenantSpecific: {
      enabled: process.env.RATE_LIMIT_TENANT_SPECIFIC === 'true',
      customLimits: new Map(),
    },
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metrics: {
      enabled: process.env.METRICS_ENABLED === 'true',
      interval: parseInt(process.env.METRICS_INTERVAL || '60000', 10),
    },
    healthCheck: {
      enabled: process.env.HEALTH_CHECK_ENABLED === 'true',
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
    },
  },
};

// Validate configuration on module load
validateRedisConfig(redisConfig);

// Export validated configuration
export default redisConfig;