/**
 * @fileoverview Core API service module for the multi-tenant CRM system
 * Implements centralized API communication with authentication, error handling,
 * tenant context management, and security features
 * @version 1.0.0
 */

import { AxiosResponse } from 'axios'; // ^1.4.0
import { apiClient } from '../utils/api';
import { AUTH_ENDPOINTS } from '../constants/apiEndpoints';
import { LoginCredentials, AuthResponse, AuthTokens, TokenValidationResponse } from '../types/auth';
import { getItem, setItem, removeItem } from '../utils/storage';

// API Configuration Constants
const API_VERSION = 'v1';
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 30000;
const CACHE_TTL = 300000; // 5 minutes

/**
 * Custom error class for API-specific errors
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public correlationId: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Generic interface for API responses
 */
export interface ApiResponse<T> {
  data: T;
  status: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

/**
 * Authenticates user with credentials and manages tokens
 * @param credentials - User login credentials with tenant context
 * @returns Authentication response with tokens and user data
 * @throws ApiError if authentication fails
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    // Set tenant context for the request
    apiClient.setTenantContext(credentials.tenantId);

    const response = await apiClient.post<AuthResponse>(
      AUTH_ENDPOINTS.LOGIN,
      credentials,
      {
        headers: {
          'X-Request-Source': 'web-client',
          'X-Client-Version': API_VERSION
        }
      }
    );

    // Store authentication tokens securely
    if (response.tokens) {
      setItem(credentials.tenantId, 'auth_tokens', response.tokens);
    }

    return response;
  } catch (error) {
    throw new ApiError(
      'AUTH_ERROR',
      'Authentication failed',
      error.correlationId || '',
      { originalError: error.message }
    );
  }
};

/**
 * Handles token refresh with retry logic
 * @param refreshToken - Current refresh token
 * @returns New authentication tokens
 * @throws ApiError if refresh fails
 */
export const refreshToken = async (refreshToken: string): Promise<AuthTokens> => {
  try {
    const response = await apiClient.post<AuthTokens>(
      AUTH_ENDPOINTS.REFRESH,
      { refreshToken },
      {
        headers: {
          'X-Request-Type': 'Token-Refresh'
        }
      }
    );

    // Update stored tokens
    const tenantId = apiClient.getTenantContext();
    if (tenantId && response) {
      setItem(tenantId, 'auth_tokens', response);
    }

    return response;
  } catch (error) {
    throw new ApiError(
      'REFRESH_ERROR',
      'Token refresh failed',
      error.correlationId || '',
      { originalError: error.message }
    );
  }
};

/**
 * Validates authentication token
 * @param token - Token to validate
 * @returns Token validation response
 */
export const validateToken = async (token: string): Promise<TokenValidationResponse> => {
  try {
    return await apiClient.post<TokenValidationResponse>(
      AUTH_ENDPOINTS.VERIFY_TOKEN,
      { token }
    );
  } catch (error) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Token validation failed',
      error.correlationId || ''
    );
  }
};

/**
 * Logs out user and cleans up authentication state
 * @param tenantId - Current tenant identifier
 */
export const logout = async (tenantId: string): Promise<void> => {
  try {
    await apiClient.post(AUTH_ENDPOINTS.LOGOUT);
    removeItem(tenantId, 'auth_tokens');
    apiClient.clearCache();
  } catch (error) {
    throw new ApiError(
      'LOGOUT_ERROR',
      'Logout failed',
      error.correlationId || ''
    );
  }
};

/**
 * Retrieves leads with pagination and filtering
 * @param params - Query parameters for lead retrieval
 * @returns Paginated lead response
 */
export const fetchLeads = async (params: {
  page?: number;
  limit?: number;
  category?: string;
  status?: string;
}): Promise<ApiResponse<Lead[]>> => {
  try {
    return await apiClient.get('/leads', { params });
  } catch (error) {
    throw new ApiError(
      'FETCH_ERROR',
      'Failed to fetch leads',
      error.correlationId || ''
    );
  }
};

/**
 * Creates a new lead
 * @param leadData - Lead creation payload
 * @returns Created lead data
 */
export const createLead = async (leadData: CreateLeadInput): Promise<Lead> => {
  try {
    return await apiClient.post('/leads', leadData);
  } catch (error) {
    throw new ApiError(
      'CREATE_ERROR',
      'Failed to create lead',
      error.correlationId || ''
    );
  }
};

/**
 * Updates an existing lead
 * @param id - Lead identifier
 * @param leadData - Lead update payload
 * @returns Updated lead data
 */
export const updateLead = async (id: string, leadData: UpdateLeadInput): Promise<Lead> => {
  try {
    return await apiClient.put(`/leads/${id}`, leadData);
  } catch (error) {
    throw new ApiError(
      'UPDATE_ERROR',
      'Failed to update lead',
      error.correlationId || ''
    );
  }
};

/**
 * Deletes a lead
 * @param id - Lead identifier
 */
export const deleteLead = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/leads/${id}`);
  } catch (error) {
    throw new ApiError(
      'DELETE_ERROR',
      'Failed to delete lead',
      error.correlationId || ''
    );
  }
};

/**
 * Generates a quote for a lead
 * @param leadId - Lead identifier
 * @param quoteData - Quote generation payload
 * @returns Generated quote data
 */
export const generateQuote = async (leadId: string, quoteData: CreateQuoteInput): Promise<Quote> => {
  try {
    return await apiClient.post(`/leads/${leadId}/quotes`, quoteData);
  } catch (error) {
    throw new ApiError(
      'QUOTE_ERROR',
      'Failed to generate quote',
      error.correlationId || ''
    );
  }
};

/**
 * Updates tenant settings
 * @param settings - Tenant settings update payload
 * @returns Updated tenant settings
 */
export const updateTenantSettings = async (settings: UpdateTenantPayload): Promise<TenantSettings> => {
  try {
    return await apiClient.put('/tenant/settings', settings);
  } catch (error) {
    throw new ApiError(
      'SETTINGS_ERROR',
      'Failed to update tenant settings',
      error.correlationId || ''
    );
  }
};

// Export types for external use
export type { ApiResponse, ApiError };