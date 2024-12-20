/**
 * @fileoverview Core API utility module for the multi-tenant CRM system
 * Implements centralized HTTP client with authentication, tenant isolation, and error handling
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.4.0
import { AuthTokens } from '../types/auth';
import { API_BASE_URL } from '../constants/apiEndpoints';
import { getItem } from './storage';

// Configuration constants
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const CIRCUIT_BREAKER_THRESHOLD = 5;

/**
 * Custom API error class with enhanced error tracking and details
 */
export class ApiError extends Error {
  public code: number;
  public details: Record<string, unknown>;
  public requestId: string;
  public timestamp: Date;

  constructor(
    message: string,
    code: number,
    details: Record<string, unknown> = {},
    requestId: string = ''
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.timestamp = new Date();
    Error.captureStackTrace(this, ApiError);
  }
}

/**
 * Interface for API client configuration
 */
interface ApiClientConfig extends AxiosRequestConfig {
  tenantId?: string;
  retryCount?: number;
}

/**
 * Creates and configures the API client with interceptors
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: DEFAULT_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Request interceptor for authentication
  client.interceptors.request.use(async (config) => {
    const tenantId = (config as ApiClientConfig).tenantId;
    if (!tenantId) {
      throw new ApiError('Tenant ID is required', 400);
    }

    const tokens = getItem<AuthTokens>(tenantId, 'auth_tokens');
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    // Add request tracking headers
    config.headers['X-Request-ID'] = crypto.randomUUID();
    config.headers['X-Tenant-ID'] = tenantId;

    return config;
  });

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as ApiClientConfig;
      
      // Handle retry logic
      if (error.response?.status === 429 && (config.retryCount || 0) < MAX_RETRIES) {
        config.retryCount = (config.retryCount || 0) + 1;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * config.retryCount));
        return client(config);
      }

      // Transform error to ApiError
      const apiError = handleApiError(error);
      throw apiError;
    }
  );

  return client;
};

/**
 * Processes API errors and converts them to ApiError instances
 */
const handleApiError = (error: AxiosError): ApiError => {
  const response = error.response;
  const requestId = response?.headers?.['x-request-id'] || '';
  
  if (response) {
    const data = response.data as Record<string, unknown>;
    return new ApiError(
      data.message as string || error.message,
      response.status,
      data,
      requestId
    );
  }

  if (error.code === 'ECONNABORTED') {
    return new ApiError(
      'Request timeout exceeded',
      408,
      { originalError: error.message },
      requestId
    );
  }

  return new ApiError(
    'Network error occurred',
    0,
    { originalError: error.message },
    requestId
  );
};

/**
 * API client instance with tenant context management
 */
export const apiClient = {
  /**
   * Current tenant context
   */
  private tenantId: string | null = null,

  /**
   * Axios instance
   */
  private client: AxiosInstance = createApiClient(),

  /**
   * Sets the tenant context for subsequent requests
   */
  setTenantContext(tenantId: string): void {
    this.tenantId = tenantId;
  },

  /**
   * Performs GET request
   */
  async get<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.client.get<T>(url, {
      ...config,
      tenantId: this.tenantId
    }).then(response => response.data);
  },

  /**
   * Performs POST request
   */
  async post<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.client.post<T>(url, data, {
      ...config,
      tenantId: this.tenantId
    }).then(response => response.data);
  },

  /**
   * Performs PUT request
   */
  async put<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.client.put<T>(url, data, {
      ...config,
      tenantId: this.tenantId
    }).then(response => response.data);
  },

  /**
   * Performs DELETE request
   */
  async delete<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.client.delete<T>(url, {
      ...config,
      tenantId: this.tenantId
    }).then(response => response.data);
  },

  /**
   * Clears any cached data or state
   */
  clearCache(): void {
    // Implementation for cache clearing if needed
  }
};