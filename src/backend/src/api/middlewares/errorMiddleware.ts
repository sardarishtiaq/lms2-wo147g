/**
 * @fileoverview Error handling middleware for multi-tenant CRM system
 * Provides centralized error handling with tenant isolation, security monitoring,
 * and standardized error responses.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { StatusCodes as HttpStatusCode } from 'http-status-codes'; // ^2.2.0
import { ErrorCode } from '../../constants/errorCodes';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

// Constants for error handling configuration
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';
const SECURITY_ALERT_THRESHOLD = 3;
const ERROR_CACHE_DURATION = 300000; // 5 minutes in milliseconds

/**
 * Interface for standardized error responses
 */
interface ErrorResponse {
  code: ErrorCode;
  message: string;
  correlationId: string;
  timestamp: string;
  details?: Record<string, any>;
}

/**
 * Enhanced error class with tenant and security context
 */
class AppError extends Error {
  code: ErrorCode;
  tenantId?: string;
  securityLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: Record<string, any>;
  correlationId: string;

  constructor(
    message: string,
    code: ErrorCode,
    tenantId?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.tenantId = tenantId;
    this.details = details;
    this.correlationId = crypto.randomUUID();
    this.determineSecurityLevel();
  }

  private determineSecurityLevel(): void {
    switch (this.code) {
      case ErrorCode.AUTHENTICATION_ERROR:
      case ErrorCode.AUTHORIZATION_ERROR:
        this.securityLevel = 'HIGH';
        break;
      case ErrorCode.TENANT_CONTEXT_ERROR:
        this.securityLevel = 'CRITICAL';
        break;
      case ErrorCode.VALIDATION_ERROR:
        this.securityLevel = 'LOW';
        break;
      default:
        this.securityLevel = 'MEDIUM';
    }
  }
}

/**
 * Error tracking cache for security incident detection
 */
const errorTrackingCache = new Map<string, { count: number; timestamp: number }>();

/**
 * Tracks error occurrences for security monitoring
 * @param error - Application error instance
 * @param tenantId - Tenant identifier
 */
function trackErrorOccurrence(error: AppError, tenantId?: string): void {
  const key = `${tenantId || 'global'}:${error.code}`;
  const now = Date.now();
  const cached = errorTrackingCache.get(key);

  if (cached && (now - cached.timestamp) < ERROR_CACHE_DURATION) {
    cached.count++;
    if (cached.count >= SECURITY_ALERT_THRESHOLD) {
      logger.security({
        level: 'alert',
        message: 'Security incident detected: Error threshold exceeded',
        tenantId,
        errorCode: error.code,
        occurrences: cached.count
      });
    }
  } else {
    errorTrackingCache.set(key, { count: 1, timestamp: now });
  }
}

/**
 * Sanitizes error details for safe client response
 * @param error - Application error instance
 * @returns Sanitized error details
 */
function sanitizeErrorDetails(error: AppError): Record<string, any> | undefined {
  if (!error.details) return undefined;

  // Remove sensitive information
  const sanitized = { ...error.details };
  delete sanitized.stack;
  delete sanitized.query;
  delete sanitized.params;
  delete sanitized.headers;
  delete sanitized.password;
  delete sanitized.token;

  return sanitized;
}

/**
 * Maps error codes to HTTP status codes
 * @param code - Application error code
 * @returns Corresponding HTTP status code
 */
function mapErrorCodeToHttpStatus(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
      return HttpStatusCode.BAD_REQUEST;
    case ErrorCode.TENANT_ERROR:
      return HttpStatusCode.FORBIDDEN;
    case ErrorCode.SECURITY_ERROR:
      return HttpStatusCode.UNAUTHORIZED;
    default:
      return HttpStatusCode.INTERNAL_SERVER_ERROR;
  }
}

/**
 * Central error handling middleware for Express application
 * Processes errors with tenant awareness and security monitoring
 */
export default function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract tenant context from request
  const tenantId = (req as any).tenantId;

  // Convert to AppError if needed
  const appError = error instanceof AppError ? error : new AppError(
    error.message || DEFAULT_ERROR_MESSAGE,
    ErrorCode.INTERNAL_SERVER_ERROR,
    tenantId,
    { originalError: error }
  );

  // Track error occurrence for security monitoring
  trackErrorOccurrence(appError, tenantId);

  // Log error with tenant context
  logger.error({
    message: appError.message,
    tenantId: appError.tenantId,
    correlationId: appError.correlationId,
    code: appError.code,
    stack: appError.stack,
    securityLevel: appError.securityLevel
  });

  // Track error metrics
  logger.metric({
    name: 'error_occurrence',
    value: 1,
    tags: {
      tenant_id: tenantId,
      error_code: appError.code,
      security_level: appError.securityLevel
    }
  });

  // Prepare error response
  const errorResponse: ErrorResponse = {
    code: appError.code,
    message: appError.message,
    correlationId: appError.correlationId,
    timestamp: new Date().toISOString(),
    details: sanitizeErrorDetails(appError)
  };

  // Send error response
  res.status(mapErrorCodeToHttpStatus(appError.code))
    .json(errorResponse);
}

// Export error handling utilities
export {
  AppError,
  type ErrorResponse,
  trackErrorOccurrence,
  sanitizeErrorDetails
};