/**
 * @fileoverview Comprehensive unit test suite for the core API service module
 * Tests API operations, authentication flows, security measures, and tenant isolation
 * @version 1.0.0
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import { login, refreshToken, validateToken, logout } from '../../../src/services/api';
import { apiClient } from '../../../src/utils/api';
import { AUTH_ENDPOINTS } from '../../../src/constants/apiEndpoints';
import { AuthTokens, LoginCredentials, AuthResponse } from '../../../src/types/auth';
import { TenantStatus } from '../../../src/types/tenant';

// Test constants
const TEST_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_CORRELATION_ID = 'test-correlation-id';

// Mock credentials
const mockCredentials: LoginCredentials = {
  email: 'test@example.com',
  password: 'Test123!@#',
  tenantId: TEST_TENANT_ID
};

// Mock tokens
const mockTokens: AuthTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 900,
  tokenType: 'Bearer'
};

// Mock auth response
const mockAuthResponse: AuthResponse = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'AGENT',
    status: 'ACTIVE',
    tenantId: TEST_TENANT_ID,
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: {
        email: true,
        inApp: true,
        desktop: true,
        leadUpdates: true,
        quoteUpdates: true,
        systemAlerts: true
      },
      dashboardLayout: {
        widgets: [],
        layout: 'grid',
        defaultView: 'leads'
      },
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD'
    }
  },
  tokens: mockTokens,
  tenantId: TEST_TENANT_ID
};

describe('API Service', () => {
  let mockAxios: MockAdapter;

  beforeEach(() => {
    // Create new mock adapter for axios
    mockAxios = new MockAdapter(apiClient['client'], { delayResponse: 100 });
    
    // Clear any previous mock implementations
    jest.clearAllMocks();
    
    // Reset storage and tenant context
    localStorage.clear();
    apiClient.setTenantContext(TEST_TENANT_ID);
  });

  afterEach(() => {
    // Restore mock adapter
    mockAxios.restore();
    
    // Clear tenant context and storage
    apiClient.setTenantContext('');
    localStorage.clear();
  });

  describe('Authentication', () => {
    test('login - successful authentication', async () => {
      // Mock successful login response
      mockAxios.onPost(AUTH_ENDPOINTS.LOGIN).reply(200, mockAuthResponse, {
        'x-correlation-id': TEST_CORRELATION_ID,
        'x-tenant-id': TEST_TENANT_ID
      });

      // Perform login
      const response = await login(mockCredentials);

      // Verify request headers
      expect(mockAxios.history.post[0].headers).toMatchObject({
        'X-Request-Source': 'web-client',
        'X-Tenant-ID': TEST_TENANT_ID
      });

      // Verify response and token storage
      expect(response).toEqual(mockAuthResponse);
      expect(localStorage.getItem(`crm_1.0_${TEST_TENANT_ID}_auth_tokens`)).toBeTruthy();
    });

    test('login - with MFA challenge', async () => {
      const mfaResponse = {
        mfaRequired: true,
        mfaToken: 'mock-mfa-token',
        tenantId: TEST_TENANT_ID
      };

      // Mock MFA challenge response
      mockAxios.onPost(AUTH_ENDPOINTS.LOGIN).reply(200, mfaResponse);
      mockAxios.onPost(AUTH_ENDPOINTS.MFA_VERIFY).reply(200, mockAuthResponse);

      // Perform initial login
      const response = await login(mockCredentials);

      // Verify MFA challenge
      expect(response).toHaveProperty('mfaRequired', true);
      expect(response).toHaveProperty('mfaToken');
    });

    test('login - handles network error', async () => {
      // Mock network error
      mockAxios.onPost(AUTH_ENDPOINTS.LOGIN).networkError();

      // Verify error handling
      await expect(login(mockCredentials)).rejects.toThrow('Network error occurred');
    });

    test('refreshToken - successful token refresh', async () => {
      // Mock successful token refresh
      mockAxios.onPost(AUTH_ENDPOINTS.REFRESH).reply(200, mockTokens);

      // Perform token refresh
      const response = await refreshToken(mockTokens.refreshToken);

      // Verify response and token update
      expect(response).toEqual(mockTokens);
      expect(localStorage.getItem(`crm_1.0_${TEST_TENANT_ID}_auth_tokens`)).toBeTruthy();
    });

    test('refreshToken - handles invalid token', async () => {
      // Mock invalid token response
      mockAxios.onPost(AUTH_ENDPOINTS.REFRESH).reply(401, {
        code: 'INVALID_TOKEN',
        message: 'Invalid refresh token'
      });

      // Verify error handling
      await expect(refreshToken('invalid-token')).rejects.toThrow('Token refresh failed');
    });

    test('validateToken - successful validation', async () => {
      // Mock successful token validation
      mockAxios.onPost(AUTH_ENDPOINTS.VERIFY_TOKEN).reply(200, {
        valid: true,
        user: mockAuthResponse.user
      });

      // Perform token validation
      const response = await validateToken(mockTokens.accessToken);

      // Verify response
      expect(response.valid).toBe(true);
      expect(response.user).toEqual(mockAuthResponse.user);
    });

    test('logout - successful logout', async () => {
      // Set up initial auth state
      localStorage.setItem(
        `crm_1.0_${TEST_TENANT_ID}_auth_tokens`,
        JSON.stringify(mockTokens)
      );

      // Mock successful logout
      mockAxios.onPost(AUTH_ENDPOINTS.LOGOUT).reply(200);

      // Perform logout
      await logout(TEST_TENANT_ID);

      // Verify token removal
      expect(localStorage.getItem(`crm_1.0_${TEST_TENANT_ID}_auth_tokens`)).toBeNull();
    });
  });

  describe('Tenant Context', () => {
    test('maintains tenant isolation in requests', async () => {
      // Mock request with tenant context
      mockAxios.onPost(AUTH_ENDPOINTS.LOGIN).reply(config => {
        expect(config.headers['X-Tenant-ID']).toBe(TEST_TENANT_ID);
        return [200, mockAuthResponse];
      });

      // Perform request
      await login(mockCredentials);

      // Verify tenant header was set
      expect(mockAxios.history.post[0].headers['X-Tenant-ID']).toBe(TEST_TENANT_ID);
    });

    test('prevents cross-tenant token access', async () => {
      const otherTenantId = 'other-tenant-id';
      
      // Store tokens for different tenant
      localStorage.setItem(
        `crm_1.0_${otherTenantId}_auth_tokens`,
        JSON.stringify(mockTokens)
      );

      // Attempt to access other tenant's tokens
      expect(() => {
        apiClient.setTenantContext(TEST_TENANT_ID);
        const storedTokens = localStorage.getItem(`crm_1.0_${otherTenantId}_auth_tokens`);
        expect(storedTokens).toBeNull();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('handles rate limiting', async () => {
      // Mock rate limit response
      mockAxios.onPost(AUTH_ENDPOINTS.LOGIN)
        .reply(429, {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests'
        });

      // Verify rate limit handling
      await expect(login(mockCredentials)).rejects.toThrow('Too many requests');
    });

    test('handles server errors', async () => {
      // Mock server error
      mockAxios.onPost(AUTH_ENDPOINTS.LOGIN)
        .reply(500, {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        });

      // Verify error handling
      await expect(login(mockCredentials)).rejects.toThrow('Internal server error');
    });

    test('handles timeout errors', async () => {
      // Mock timeout
      mockAxios.onPost(AUTH_ENDPOINTS.LOGIN).timeout();

      // Verify timeout handling
      await expect(login(mockCredentials)).rejects.toThrow('Request timeout exceeded');
    });
  });
});