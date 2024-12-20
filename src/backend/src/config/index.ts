/**
 * Central Configuration Module
 * Version: 1.0.0
 * 
 * Consolidates and exports all configuration settings for the multi-tenant CRM system
 * with comprehensive validation, security checks, and tenant isolation.
 */

import { config } from 'dotenv'; // ^16.0.3
import { authConfig, jwt, session, passwordPolicy } from './auth.config';
import { databaseConfig, uri, options, tenantIsolation } from './database.config';
import redisConfig from './redis.config';
import storageConfig from './storage.config';
import emailConfig, { getTenantEmailConfig, validateEmailConfig } from './email.config';

// Initialize environment variables
config();

// Global constants
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const TENANT_CONTEXT = Symbol('TENANT_CONTEXT');

/**
 * Interface for tenant-specific configuration overrides
 */
interface TenantConfig {
  auth?: Partial<typeof authConfig>;
  database?: Partial<typeof databaseConfig>;
  redis?: Partial<typeof redisConfig>;
  storage?: Partial<typeof storageConfig>;
  email?: Partial<typeof emailConfig>;
}

/**
 * Interface for the complete system configuration
 */
interface SystemConfig {
  environment: string;
  auth: typeof authConfig;
  database: typeof databaseConfig;
  redis: typeof redisConfig;
  storage: typeof storageConfig;
  email: typeof emailConfig;
  tenantContext: {
    enabled: boolean;
    overrides: Record<string, TenantConfig>;
    validation: {
      enforceIsolation: boolean;
      validateOverrides: boolean;
    };
  };
}

/**
 * Validates all configuration settings with comprehensive security checks
 * @throws Error if any configuration is invalid
 */
export function validateConfigurations(): void {
  // Validate environment
  if (!['development', 'staging', 'production'].includes(NODE_ENV)) {
    throw new Error('Invalid NODE_ENV value');
  }

  // Production-specific validations
  if (NODE_ENV === 'production') {
    // Validate security settings
    if (!jwt.accessTokenSecret || !jwt.refreshTokenSecret) {
      throw new Error('JWT secrets are required in production');
    }

    if (!session.secure || session.sameSite !== 'strict') {
      throw new Error('Secure session configuration required in production');
    }

    // Validate database encryption
    if (!databaseConfig.options.ssl) {
      throw new Error('SSL must be enabled for database in production');
    }

    // Validate Redis security
    if (!redisConfig.connection.tls.enabled) {
      throw new Error('TLS must be enabled for Redis in production');
    }

    // Validate storage encryption
    if (!storageConfig.encryption.enabled) {
      throw new Error('Storage encryption must be enabled in production');
    }
  }

  // Validate email configuration
  validateEmailConfig(emailConfig);
}

/**
 * Retrieves tenant-specific configuration with security validation
 * @param tenantId - Unique identifier for the tenant
 * @returns Merged configuration for the specific tenant
 */
export function getTenantConfig(tenantId: string): SystemConfig {
  const baseConfig: SystemConfig = {
    environment: NODE_ENV,
    auth: authConfig,
    database: databaseConfig,
    redis: redisConfig,
    storage: storageConfig,
    email: emailConfig,
    tenantContext: {
      enabled: true,
      overrides: {},
      validation: {
        enforceIsolation: true,
        validateOverrides: true
      }
    }
  };

  // Return base config if tenant context is disabled
  if (!baseConfig.tenantContext.enabled) {
    return baseConfig;
  }

  const tenantOverrides = baseConfig.tenantContext.overrides[tenantId];
  if (!tenantOverrides) {
    return baseConfig;
  }

  // Merge tenant-specific configurations
  const mergedConfig: SystemConfig = {
    ...baseConfig,
    auth: { ...baseConfig.auth, ...tenantOverrides.auth },
    database: { ...baseConfig.database, ...tenantOverrides.database },
    redis: { ...baseConfig.redis, ...tenantOverrides.redis },
    storage: { ...baseConfig.storage, ...tenantOverrides.storage },
    email: getTenantEmailConfig(tenantId)
  };

  // Validate merged configuration if enabled
  if (baseConfig.tenantContext.validation.validateOverrides) {
    validateConfigurations();
  }

  return mergedConfig;
}

// Validate configuration on module load
validateConfigurations();

/**
 * Export the complete configuration object
 */
export const config: SystemConfig = {
  environment: NODE_ENV,
  auth: authConfig,
  database: databaseConfig,
  redis: redisConfig,
  storage: storageConfig,
  email: emailConfig,
  tenantContext: {
    enabled: true,
    overrides: {},
    validation: {
      enforceIsolation: true,
      validateOverrides: true
    }
  }
};

// Named exports for individual configurations
export {
  authConfig as auth,
  databaseConfig as database,
  redisConfig as redis,
  storageConfig as storage,
  emailConfig as email
};