/**
 * Rate Limiting Middleware
 * Version: 1.0.0
 * 
 * Implements Redis-based rate limiting with tenant isolation for the multi-tenant CRM system.
 * Provides configurable rate limits, monitoring, and automatic response handling.
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { redisClient } from '../../utils/redis';
import { ErrorCode } from '../../constants/errorCodes';
import logger from '../../utils/logger';

/**
 * Configuration options for rate limiting middleware
 */
export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  skipFailedRequests: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Rate limit tracking information
 */
interface RateLimitInfo {
  count: number;
  resetTime: number;
  remaining: number;
  tenant: string;
}

/**
 * Default rate limit key generator
 * Creates a unique key combining tenant ID and IP address
 */
const getRateLimitKey = (tenantId: string, ip: string): string => {
  // Sanitize inputs to prevent injection
  const sanitizedTenantId = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
  const sanitizedIp = ip.replace(/[^0-9.]/g, '');
  return `ratelimit:${sanitizedTenantId}:${sanitizedIp}`;
};

/**
 * Creates rate limiting middleware with tenant isolation
 * @param options - Rate limiting configuration options
 */
export const rateLimitMiddleware = (options: RateLimitOptions) => {
  // Validate and normalize options
  const normalizedOptions: Required<RateLimitOptions> = {
    windowMs: options.windowMs || 900000, // 15 minutes default
    maxRequests: options.maxRequests || 100,
    skipFailedRequests: options.skipFailedRequests || false,
    keyGenerator: options.keyGenerator || getRateLimitKey
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract tenant ID from request context
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        logger.warn('Rate limit attempted without tenant context');
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      // Get client IP with proxy support
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || 
                      req.socket.remoteAddress || 
                      'unknown';

      // Generate rate limit key
      const rateLimitKey = normalizedOptions.keyGenerator(tenantId, clientIp);

      // Get current rate limit info
      const now = Date.now();
      let rateLimitInfo: RateLimitInfo | null = await redisClient.get<RateLimitInfo>(rateLimitKey, tenantId);

      if (!rateLimitInfo) {
        rateLimitInfo = {
          count: 0,
          resetTime: now + normalizedOptions.windowMs,
          remaining: normalizedOptions.maxRequests,
          tenant: tenantId
        };
      }

      // Check if window has expired and reset if needed
      if (now > rateLimitInfo.resetTime) {
        rateLimitInfo = {
          count: 0,
          resetTime: now + normalizedOptions.windowMs,
          remaining: normalizedOptions.maxRequests,
          tenant: tenantId
        };
      }

      // Check if limit exceeded
      if (rateLimitInfo.count >= normalizedOptions.maxRequests) {
        // Log rate limit violation
        logger.warn('Rate limit exceeded', {
          tenant: tenantId,
          ip: clientIp,
          path: req.path,
          limit: normalizedOptions.maxRequests,
          window: normalizedOptions.windowMs
        });

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', normalizedOptions.maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime / 1000));
        res.setHeader('Retry-After', Math.ceil((rateLimitInfo.resetTime - now) / 1000));

        res.status(429).json({
          error: 'Too many requests',
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          retryAfter: Math.ceil((rateLimitInfo.resetTime - now) / 1000)
        });
        return;
      }

      // Increment request count
      rateLimitInfo.count++;
      rateLimitInfo.remaining = normalizedOptions.maxRequests - rateLimitInfo.count;

      // Update rate limit info in Redis
      await redisClient.set(rateLimitKey, rateLimitInfo, {
        ttl: Math.ceil((rateLimitInfo.resetTime - now) / 1000),
        tenant: tenantId
      });

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', normalizedOptions.maxRequests);
      res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime / 1000));

      next();
    } catch (error) {
      logger.error('Rate limit middleware error:', error);
      next(error);
    }
  };
};
```

This implementation provides a robust rate limiting middleware with the following features:

1. Tenant Isolation: Each tenant has its own rate limit tracking using Redis
2. Security: Input sanitization and validation to prevent injection attacks
3. Monitoring: Comprehensive logging of rate limit violations
4. Headers: Standard rate limit headers for client feedback
5. Performance: Efficient Redis-based tracking with automatic cleanup
6. Configurability: Customizable options for window size, limits, and key generation
7. Error Handling: Proper error handling and logging
8. Proxy Support: Handles X-Forwarded-For headers for proper IP detection

The middleware can be used in the application like this:

```typescript
app.use(rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  skipFailedRequests: true
}));