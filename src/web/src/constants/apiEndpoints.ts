/**
 * @fileoverview API Endpoint Constants for Multi-tenant CRM System
 * @version 1.0.0
 * 
 * Centralized configuration of API endpoints with TypeScript support.
 * Implements RESTful patterns and versioning for frontend-backend communication.
 */

/**
 * API version prefix for all endpoints
 * @constant
 */
export const API_VERSION = '/api/v1';

/**
 * Base API URL from environment or default localhost
 * @constant
 */
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

/**
 * Authentication endpoints for JWT and session management
 * @constant
 */
export const AUTH_ENDPOINTS = {
  LOGIN: `${API_VERSION}/auth/login`,
  LOGOUT: `${API_VERSION}/auth/logout`,
  REFRESH: `${API_VERSION}/auth/refresh`,
  REQUEST_RESET: `${API_VERSION}/auth/password/reset-request`,
  RESET_PASSWORD: `${API_VERSION}/auth/password/reset`,
  VERIFY_TOKEN: `${API_VERSION}/auth/verify`,
} as const;

/**
 * Lead management endpoints supporting 12-stage pipeline
 * @constant
 */
export const LEAD_ENDPOINTS = {
  GET_ALL: `${API_VERSION}/leads`,
  GET_BY_ID: `${API_VERSION}/leads/:id`,
  CREATE: `${API_VERSION}/leads`,
  UPDATE: `${API_VERSION}/leads/:id`,
  UPDATE_CATEGORY: `${API_VERSION}/leads/:id/category`,
  DELETE: `${API_VERSION}/leads/:id`,
  BULK_UPDATE: `${API_VERSION}/leads/bulk`,
  ASSIGN: `${API_VERSION}/leads/:id/assign`,
} as const;

/**
 * Quote management endpoints with document generation
 * @constant
 */
export const QUOTE_ENDPOINTS = {
  GET_ALL: `${API_VERSION}/quotes`,
  GET_BY_ID: `${API_VERSION}/quotes/:id`,
  CREATE: `${API_VERSION}/quotes`,
  UPDATE: `${API_VERSION}/quotes/:id`,
  DELETE: `${API_VERSION}/quotes/:id`,
  GENERATE_PDF: `${API_VERSION}/quotes/:id/pdf`,
  SEND_TO_CUSTOMER: `${API_VERSION}/quotes/:id/send`,
} as const;

/**
 * Activity tracking endpoints for lead interaction history
 * @constant
 */
export const ACTIVITY_ENDPOINTS = {
  GET_BY_LEAD: `${API_VERSION}/activities/lead/:id`,
  CREATE: `${API_VERSION}/activities`,
  GET_TIMELINE: `${API_VERSION}/activities/timeline/:id`,
  BULK_CREATE: `${API_VERSION}/activities/bulk`,
} as const;

/**
 * Category management endpoints for pipeline stages
 * @constant
 */
export const CATEGORY_ENDPOINTS = {
  GET_ALL: `${API_VERSION}/categories`,
  GET_BY_ID: `${API_VERSION}/categories/:id`,
  GET_METRICS: `${API_VERSION}/categories/metrics`,
} as const;

/**
 * User management endpoints with profile and preferences
 * @constant
 */
export const USER_ENDPOINTS = {
  GET_ALL: `${API_VERSION}/users`,
  GET_BY_ID: `${API_VERSION}/users/:id`,
  UPDATE_PROFILE: `${API_VERSION}/users/profile`,
  UPDATE_PASSWORD: `${API_VERSION}/users/password`,
  GET_PREFERENCES: `${API_VERSION}/users/preferences`,
  UPDATE_PREFERENCES: `${API_VERSION}/users/preferences`,
} as const;

/**
 * Tenant management endpoints for multi-tenant configuration
 * @constant
 */
export const TENANT_ENDPOINTS = {
  GET_SETTINGS: `${API_VERSION}/tenant/settings`,
  UPDATE_SETTINGS: `${API_VERSION}/tenant/settings`,
  GET_BRANDING: `${API_VERSION}/tenant/branding`,
  UPDATE_BRANDING: `${API_VERSION}/tenant/branding`,
} as const;

/**
 * Type definitions for endpoint parameters
 */
export type EndpointParams = {
  id?: string | number;
  [key: string]: string | number | undefined;
};

/**
 * Utility function to replace URL parameters
 * @param endpoint - The endpoint with parameter placeholders
 * @param params - The parameters to replace in the URL
 * @returns The formatted endpoint URL
 */
export const formatEndpoint = (endpoint: string, params: EndpointParams): string => {
  let formattedEndpoint = endpoint;
  Object.entries(params).forEach(([key, value]) => {
    formattedEndpoint = formattedEndpoint.replace(`:${key}`, String(value));
  });
  return formattedEndpoint;
};

/**
 * Full API URL generator
 * @param endpoint - The API endpoint path
 * @returns The complete API URL
 */
export const getFullApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};