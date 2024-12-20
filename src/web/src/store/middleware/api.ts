/**
 * @fileoverview Redux middleware for handling API requests in the multi-tenant CRM system
 * Implements secure, tenant-isolated API communication with comprehensive request lifecycle management
 * @version 1.0.0
 */

import { Middleware, isPlainObject } from '@reduxjs/toolkit';
import { apiClient, ApiError } from '../../utils/api';

// Action type constants
export const API_REQUEST = 'API_REQUEST' as const;
export const API_SUCCESS = 'API_SUCCESS' as const;
export const API_ERROR = 'API_ERROR' as const;

// Cache duration in milliseconds (5 minutes)
const API_CACHE_DURATION = 300000;

/**
 * Interface for API request configuration
 */
interface ApiRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  cache?: {
    enabled: boolean;
    duration?: number;
  };
}

/**
 * Interface for API action with tenant context
 */
interface ApiAction {
  type: string;
  payload?: unknown;
  meta: {
    tenantId: string;
    request: ApiRequest;
    cache?: {
      key?: string;
      group?: string;
    };
  };
}

/**
 * Cache storage for API responses
 */
const apiCache: Map<string, {
  data: unknown;
  timestamp: number;
}> = new Map();

/**
 * Generates a cache key for an API request
 */
const generateCacheKey = (tenantId: string, request: ApiRequest): string => {
  const { url, method, params } = request;
  return `${tenantId}:${method}:${url}:${JSON.stringify(params || {})}`;
};

/**
 * Checks if a cached response is still valid
 */
const isCacheValid = (timestamp: number, duration: number): boolean => {
  return Date.now() - timestamp < duration;
};

/**
 * Type guard to validate API actions
 */
const isApiAction = (action: unknown): action is ApiAction => {
  if (!isPlainObject(action)) return false;
  
  const { type, meta } = action as ApiAction;
  if (!type || !meta) return false;
  
  const { tenantId, request } = meta;
  if (!tenantId || !request || !request.url || !request.method) return false;
  
  return true;
};

/**
 * Creates the API middleware instance with tenant isolation
 */
export const createApiMiddleware = (): Middleware => {
  return store => next => async action => {
    // Skip non-API actions
    if (!isApiAction(action)) {
      return next(action);
    }

    const { meta: { tenantId, request, cache }, type } = action;

    // Set tenant context for the request
    apiClient.setTenantContext(tenantId);

    // Generate cache key if caching is enabled
    const cacheKey = request.cache?.enabled 
      ? generateCacheKey(tenantId, request)
      : null;

    // Check cache for existing valid response
    if (cacheKey) {
      const cached = apiCache.get(cacheKey);
      if (cached && isCacheValid(cached.timestamp, request.cache?.duration || API_CACHE_DURATION)) {
        return next({
          type: API_SUCCESS,
          payload: cached.data,
          meta: { ...action.meta, cached: true }
        });
      }
    }

    // Dispatch request start action
    next({ type: `${type}_REQUEST`, meta: action.meta });

    try {
      // Make API request based on method
      let response;
      switch (request.method) {
        case 'GET':
          response = await apiClient.get(request.url, {
            params: request.params,
            headers: request.headers
          });
          break;
        case 'POST':
          response = await apiClient.post(request.url, request.data, {
            headers: request.headers
          });
          break;
        case 'PUT':
          response = await apiClient.put(request.url, request.data, {
            headers: request.headers
          });
          break;
        case 'DELETE':
          response = await apiClient.delete(request.url, {
            headers: request.headers
          });
          break;
      }

      // Cache successful response if enabled
      if (cacheKey) {
        apiCache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });
      }

      // Dispatch success action
      return next({
        type: API_SUCCESS,
        payload: response,
        meta: action.meta
      });

    } catch (error) {
      // Transform error to ApiError if needed
      const apiError = error instanceof ApiError 
        ? error 
        : new ApiError(
            'An unexpected error occurred',
            500,
            { originalError: error }
          );

      // Dispatch error action
      return next({
        type: API_ERROR,
        payload: apiError,
        meta: action.meta,
        error: true
      });
    }
  };
};

/**
 * Configured API middleware instance
 */
export const apiMiddleware = createApiMiddleware();