/**
 * Authentication Middleware
 * Version: 1.0.0
 * 
 * Implements secure JWT token validation, role-based access control, and tenant isolation
 * for the multi-tenant CRM system with comprehensive security logging and monitoring.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import { verifyAccessToken, verifyRefreshToken } from '../../utils/jwt';
import { ErrorCode } from '../../constants/errorCodes';
import { ROLES } from '../../constants/roles';
import Logger from '../../utils/logger';

/**
 * Extended Express Request interface with authenticated user data and security context
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    tenantId: string;
    role: ROLES;
    permissions: string[];
    sessionId: string;
    lastActive: Date;
  };
  securityContext: {
    tokenExpiration: Date;
    ipAddress: string;
    userAgent: string;
  };
}

/**
 * Extracts and validates the JWT token from request headers
 * @param req Express request object
 * @returns Extracted token or null
 */
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
};

/**
 * Validates security headers and request origin
 * @param req Express request object
 * @throws Error if security validation fails
 */
const validateSecurityHeaders = (req: Request): void => {
  // Validate Content-Type for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && 
      !req.headers['content-type']?.includes('application/json')) {
    Logger.warn('Invalid content type header', { 
      method: req.method, 
      contentType: req.headers['content-type'] 
    });
    throw new Error('Invalid content type');
  }

  // Validate origin for CORS requests
  const origin = req.headers.origin;
  if (origin && !process.env.ALLOWED_ORIGINS?.split(',').includes(origin)) {
    Logger.warn('Invalid request origin', { origin });
    throw new Error('Invalid origin');
  }
};

/**
 * Authentication middleware for validating JWT tokens and establishing user context
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract and validate token
    const token = extractToken(req);
    if (!token) {
      Logger.warn('Missing authentication token');
      res.status(401).json({
        code: ErrorCode.AUTHENTICATION_ERROR,
        message: 'Authentication token required'
      });
      return;
    }

    // Validate security headers
    validateSecurityHeaders(req);

    // Verify token and decode payload
    const decoded = await verifyAccessToken(token);

    // Establish authenticated request context
    (req as AuthenticatedRequest).user = {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role as ROLES,
      permissions: decoded.permissions,
      sessionId: decoded.tokenId,
      lastActive: new Date()
    };

    // Add security context
    (req as AuthenticatedRequest).securityContext = {
      tokenExpiration: new Date(decoded.issuedAt + (15 * 60 * 1000)), // 15 minutes
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    Logger.info('Authentication successful', {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role
    });

    next();
  } catch (error) {
    Logger.error('Authentication failed', { error });
    res.status(401).json({
      code: ErrorCode.AUTHENTICATION_ERROR,
      message: 'Authentication failed'
    });
  }
};

/**
 * Authorization middleware for role-based access control
 * @param requiredPermissions Array of required permissions
 */
export const authorize = (requiredPermissions: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const { permissions } = authenticatedReq.user;

      // Check if user has all required permissions
      const hasPermissions = requiredPermissions.every(
        permission => permissions.includes(permission)
      );

      if (!hasPermissions) {
        Logger.warn('Authorization failed - insufficient permissions', {
          userId: authenticatedReq.user.id,
          required: requiredPermissions,
          actual: permissions
        });

        res.status(403).json({
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: 'Insufficient permissions'
        });
        return;
      }

      Logger.info('Authorization successful', {
        userId: authenticatedReq.user.id,
        permissions: requiredPermissions
      });

      next();
    } catch (error) {
      Logger.error('Authorization error', { error });
      res.status(403).json({
        code: ErrorCode.AUTHORIZATION_ERROR,
        message: 'Authorization failed'
      });
    }
  };
};

/**
 * Middleware for validating and enforcing tenant isolation
 */
export const validateTenantContext = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const requestedTenantId = req.params.tenantId || req.body.tenantId;

    // Skip tenant validation for admin users
    if (authenticatedReq.user.role === ROLES.ADMIN) {
      next();
      return;
    }

    // Validate tenant context
    if (requestedTenantId && 
        requestedTenantId !== authenticatedReq.user.tenantId) {
      Logger.warn('Tenant context violation', {
        userId: authenticatedReq.user.id,
        userTenant: authenticatedReq.user.tenantId,
        requestedTenant: requestedTenantId
      });

      res.status(403).json({
        code: ErrorCode.TENANT_CONTEXT_ERROR,
        message: 'Invalid tenant context'
      });
      return;
    }

    Logger.info('Tenant context validated', {
      userId: authenticatedReq.user.id,
      tenantId: authenticatedReq.user.tenantId
    });

    next();
  } catch (error) {
    Logger.error('Tenant validation error', { error });
    res.status(403).json({
      code: ErrorCode.TENANT_CONTEXT_ERROR,
      message: 'Tenant validation failed'
    });
  }
};

// Apply security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  xssFilter: true,
  noSniff: true,
  hidePoweredBy: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'same-origin' }
});
```

This implementation provides:

1. Comprehensive JWT token validation with security header checks
2. Role-based access control with granular permissions
3. Tenant isolation enforcement
4. Security headers using helmet
5. Extensive logging for security events
6. Type safety with TypeScript interfaces
7. Error handling with standardized error codes
8. Security best practices for multi-tenant systems

The middleware can be used in routes like this:

```typescript
router.get('/leads',
  authenticate,
  authorize(['lead:view']),
  validateTenantContext,
  leadsController.getLeads
);