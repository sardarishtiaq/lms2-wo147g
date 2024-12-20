/**
 * Tenant Context Middleware
 * Version: 1.0.0
 * 
 * Enterprise-grade middleware for handling tenant context in the multi-tenant CRM system.
 * Provides secure tenant isolation, validation, and caching with comprehensive error handling.
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.x
import { createClient } from 'redis'; // ^4.x
import { ITenant, TenantStatus } from '../../interfaces/ITenant';
import { verifyAccessToken } from '../../utils/jwt';
import { ErrorCode, ErrorMessage } from '../../constants/errorCodes';
import logger from '../../utils/logger';
import { redisConfig } from '../../config';

// Redis client for tenant context caching
const redisClient = createClient({
  url: `redis://${redisConfig.connection.host}:${redisConfig.connection.port}`,
  password: redisConfig.connection.password,
  database: redisConfig.connection.db
});

// Initialize Redis connection
(async () => {
  try {
    await redisClient.connect();
    logger.info('Redis client connected for tenant context caching');
  } catch (error) {
    logger.error('Redis connection failed', { error });
  }
})();

/**
 * Extended Express Request interface with tenant context
 */
export interface TenantRequest extends Request {
  tenantId: string;
  tenantStatus: TenantStatus;
  tenantPermissions: string[];
  tenantMetadata: {
    name: string;
    settings: Record<string, any>;
    features: string[];
  };
  tenantCacheKey: string;
}

/**
 * Cache configuration for tenant context
 */
const TENANT_CACHE_CONFIG = {
  prefix: 'tenant:context:',
  ttl: 300, // 5 minutes
  maxSize: 10000
};

/**
 * Validates tenant context from the token payload
 * @param tenantId - Tenant identifier to validate
 * @param token - Decoded JWT token payload
 * @throws Error if tenant validation fails
 */
const validateTenantContext = async (
  tenantId: string,
  token: any
): Promise<void> => {
  if (!tenantId || typeof tenantId !== 'string') {
    logger.error('Invalid tenant ID format', { tenantId });
    throw new Error(ErrorMessage.INVALID_TENANT_ID);
  }

  if (token.tenantId !== tenantId) {
    logger.error('Tenant ID mismatch', { 
      tokenTenantId: token.tenantId, 
      requestTenantId: tenantId 
    });
    throw new Error(ErrorMessage.TENANT_CONTEXT_ERROR);
  }
};

/**
 * Retrieves tenant context from cache or generates new context
 * @param tenantId - Tenant identifier
 * @returns Cached tenant context or null
 */
const getTenantContext = async (tenantId: string): Promise<any | null> => {
  const cacheKey = `${TENANT_CACHE_CONFIG.prefix}${tenantId}`;
  
  try {
    const cachedContext = await redisClient.get(cacheKey);
    if (cachedContext) {
      return JSON.parse(cachedContext);
    }
    return null;
  } catch (error) {
    logger.error('Cache retrieval error', { error, tenantId });
    return null;
  }
};

/**
 * Caches tenant context for subsequent requests
 * @param tenantId - Tenant identifier
 * @param context - Tenant context to cache
 */
const cacheTenantContext = async (
  tenantId: string,
  context: any
): Promise<void> => {
  const cacheKey = `${TENANT_CACHE_CONFIG.prefix}${tenantId}`;
  
  try {
    await redisClient.setEx(
      cacheKey,
      TENANT_CACHE_CONFIG.ttl,
      JSON.stringify(context)
    );
  } catch (error) {
    logger.error('Cache storage error', { error, tenantId });
  }
};

/**
 * Express middleware that extracts and validates tenant context from JWT tokens
 * Implements caching, security validation, and comprehensive error handling
 */
export const tenantContextMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  try {
    // Validate authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error(ErrorMessage.AUTHENTICATION_ERROR);
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await verifyAccessToken(token);

    // Extract tenant ID from token
    const { tenantId } = decodedToken;
    await validateTenantContext(tenantId, decodedToken);

    // Check cache for tenant context
    let tenantContext = await getTenantContext(tenantId);

    if (!tenantContext) {
      // Generate new tenant context with required information
      tenantContext = {
        id: tenantId,
        status: TenantStatus.ACTIVE,
        permissions: decodedToken.permissions,
        metadata: {
          name: decodedToken.tenantName,
          settings: decodedToken.tenantSettings,
          features: decodedToken.tenantFeatures
        }
      };

      // Cache the new context
      await cacheTenantContext(tenantId, tenantContext);
    }

    // Validate tenant status
    if (tenantContext.status !== TenantStatus.ACTIVE) {
      logger.warn('Inactive tenant attempted access', { 
        tenantId,
        status: tenantContext.status 
      });
      throw new Error(ErrorMessage.AUTHORIZATION_ERROR);
    }

    // Attach tenant context to request
    req.tenantId = tenantContext.id;
    req.tenantStatus = tenantContext.status;
    req.tenantPermissions = tenantContext.permissions;
    req.tenantMetadata = tenantContext.metadata;
    req.tenantCacheKey = `${TENANT_CACHE_CONFIG.prefix}${tenantId}`;

    // Log successful context attachment
    logger.info('Tenant context attached', { 
      tenantId,
      requestId: req.id,
      path: req.path 
    });

    next();
  } catch (error: any) {
    logger.error('Tenant context middleware error', {
      error: error.message,
      path: req.path,
      method: req.method
    });

    const errorCode = error.message === ErrorMessage.AUTHENTICATION_ERROR
      ? ErrorCode.AUTHENTICATION_ERROR
      : ErrorCode.TENANT_CONTEXT_ERROR;

    res.status(401).json({
      error: error.message,
      code: errorCode
    });
  }
};

// Cleanup Redis connection on process termination
process.on('SIGTERM', async () => {
  await redisClient.quit();
  logger.info('Redis client disconnected');
});

export default tenantContextMiddleware;