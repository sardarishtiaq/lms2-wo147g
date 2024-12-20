/**
 * @fileoverview Centralized error code constants for the CRM application.
 * Provides standardized error codes, HTTP status codes, and error messages
 * for consistent error handling across backend services.
 * @version 1.0.0
 */

/**
 * Application-specific error codes for consistent error handling and monitoring
 */
export enum ErrorCode {
  INTERNAL_SERVER_ERROR = 5000,
  VALIDATION_ERROR = 4000,
  AUTHENTICATION_ERROR = 4001,
  AUTHORIZATION_ERROR = 4003,
  TENANT_CONTEXT_ERROR = 4004,
  RESOURCE_NOT_FOUND = 4040,
  DUPLICATE_RESOURCE = 4090,
  RATE_LIMIT_EXCEEDED = 4290,
  DATABASE_ERROR = 5001,
  NETWORK_ERROR = 5002,
  SERVICE_UNAVAILABLE = 5030,
  INVALID_TENANT_ID = 4005
}

/**
 * Standard HTTP status codes for consistent API responses
 */
export const HttpStatusCode = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Standardized, security-conscious error messages for client communication.
 * Messages are designed to be informative while not exposing sensitive system details.
 */
export const ErrorMessage = {
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  VALIDATION_ERROR: 'The provided data is invalid or incomplete.',
  AUTHENTICATION_ERROR: 'Authentication failed. Please check your credentials.',
  AUTHORIZATION_ERROR: 'You do not have permission to perform this action.',
  TENANT_CONTEXT_ERROR: 'Invalid tenant context.',
  RESOURCE_NOT_FOUND: 'The requested resource was not found.',
  DUPLICATE_RESOURCE: 'A resource with the same identifier already exists.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  DATABASE_ERROR: 'Database operation failed. Please try again later.',
  NETWORK_ERROR: 'Network communication error. Please try again later.',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later.',
  INVALID_TENANT_ID: 'Invalid tenant identifier provided.'
} as const;

/**
 * Mapping of application error codes to HTTP status codes for consistent
 * HTTP response handling
 */
export const ErrorCodeToStatusMap: Record<ErrorCode, number> = {
  [ErrorCode.INTERNAL_SERVER_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
  [ErrorCode.VALIDATION_ERROR]: HttpStatusCode.BAD_REQUEST,
  [ErrorCode.AUTHENTICATION_ERROR]: HttpStatusCode.UNAUTHORIZED,
  [ErrorCode.AUTHORIZATION_ERROR]: HttpStatusCode.FORBIDDEN,
  [ErrorCode.TENANT_CONTEXT_ERROR]: HttpStatusCode.BAD_REQUEST,
  [ErrorCode.RESOURCE_NOT_FOUND]: HttpStatusCode.NOT_FOUND,
  [ErrorCode.DUPLICATE_RESOURCE]: HttpStatusCode.CONFLICT,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: HttpStatusCode.TOO_MANY_REQUESTS,
  [ErrorCode.DATABASE_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
  [ErrorCode.NETWORK_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
  [ErrorCode.SERVICE_UNAVAILABLE]: HttpStatusCode.SERVICE_UNAVAILABLE,
  [ErrorCode.INVALID_TENANT_ID]: HttpStatusCode.BAD_REQUEST
};

/**
 * Mapping of error codes to monitoring severity levels for logging
 * and alerting purposes
 */
export const ErrorCodeToMonitoringLevel: Record<ErrorCode, 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'> = {
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'CRITICAL',
  [ErrorCode.VALIDATION_ERROR]: 'INFO',
  [ErrorCode.AUTHENTICATION_ERROR]: 'WARN',
  [ErrorCode.AUTHORIZATION_ERROR]: 'WARN',
  [ErrorCode.TENANT_CONTEXT_ERROR]: 'ERROR',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'INFO',
  [ErrorCode.DUPLICATE_RESOURCE]: 'INFO',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'WARN',
  [ErrorCode.DATABASE_ERROR]: 'CRITICAL',
  [ErrorCode.NETWORK_ERROR]: 'ERROR',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'CRITICAL',
  [ErrorCode.INVALID_TENANT_ID]: 'ERROR'
};