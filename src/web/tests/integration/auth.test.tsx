/**
 * @fileoverview Integration tests for authentication flows in the multi-tenant CRM system
 * Tests comprehensive JWT-based authentication with tenant isolation and token lifecycle
 * @version 1.0.0
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { login, refreshToken, logout } from '../../src/services/auth';
import { LoginCredentials } from '../../src/types/auth';
import { handlers } from '../mocks/handlers';

// Test server setup with MSW
const server = setupServer(...handlers);

// Test constants for tenant isolation testing
const TEST_TENANTS = {
  tenant1: {
    id: 'test-tenant-1',
    name: 'Test Tenant 1',
    domain: 'tenant1.example.com'
  },
  tenant2: {
    id: 'test-tenant-2',
    name: 'Test Tenant 2',
    domain: 'tenant2.example.com'
  }
} as const;

// Test user credentials
const TEST_CREDENTIALS: Record<string, LoginCredentials> = {
  valid: {
    email: 'test@example.com',
    password: 'Test123!',
    tenantId: TEST_TENANTS.tenant1.id
  },
  invalid: {
    email: 'invalid@example.com',
    password: 'wrong',
    tenantId: TEST_TENANTS.tenant1.id
  },
  crossTenant: {
    email: 'test@example.com',
    password: 'Test123!',
    tenantId: TEST_TENANTS.tenant2.id
  }
};

// Mock storage for token management testing
const mockStorage: Record<string, string> = {};

// Setup and teardown hooks
beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'error' });

  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]); }
    }
  });
});

afterAll(() => {
  // Clean up MSW server
  server.close();
});

beforeEach(() => {
  // Reset MSW handlers and storage
  server.resetHandlers();
  window.localStorage.clear();
});

describe('Authentication Flow Integration Tests', () => {
  describe('Login Process', () => {
    it('should successfully authenticate with valid tenant credentials', async () => {
      const response = await login(TEST_CREDENTIALS.valid);

      expect(response).toMatchObject({
        user: {
          email: TEST_CREDENTIALS.valid.email,
          tenantId: TEST_CREDENTIALS.valid.tenantId
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        }
      });

      // Verify tenant-specific token storage
      const storedTokens = window.localStorage.getItem(
        `crm_1.0_${TEST_CREDENTIALS.valid.tenantId}_auth_tokens`
      );
      expect(storedTokens).toBeTruthy();
    });

    it('should reject authentication with invalid credentials', async () => {
      await expect(login(TEST_CREDENTIALS.invalid))
        .rejects
        .toThrow('Authentication failed');

      // Verify no tokens were stored
      const storedTokens = window.localStorage.getItem(
        `crm_1.0_${TEST_CREDENTIALS.invalid.tenantId}_auth_tokens`
      );
      expect(storedTokens).toBeNull();
    });

    it('should enforce rate limiting after multiple failed attempts', async () => {
      // Attempt multiple failed logins
      for (let i = 0; i < 5; i++) {
        await expect(login(TEST_CREDENTIALS.invalid))
          .rejects
          .toThrow('Authentication failed');
      }

      // Verify rate limit is enforced
      await expect(login(TEST_CREDENTIALS.invalid))
        .rejects
        .toThrow('Too many login attempts');
    });

    it('should maintain tenant isolation during authentication', async () => {
      // Authenticate with first tenant
      await login(TEST_CREDENTIALS.valid);

      // Attempt cross-tenant authentication
      const crossTenantResponse = await login(TEST_CREDENTIALS.crossTenant);

      // Verify separate token storage
      const tenant1Tokens = window.localStorage.getItem(
        `crm_1.0_${TEST_CREDENTIALS.valid.tenantId}_auth_tokens`
      );
      const tenant2Tokens = window.localStorage.getItem(
        `crm_1.0_${TEST_CREDENTIALS.crossTenant.tenantId}_auth_tokens`
      );

      expect(tenant1Tokens).not.toBe(tenant2Tokens);
    });
  });

  describe('Token Lifecycle Management', () => {
    it('should successfully refresh tokens', async () => {
      // Initial authentication
      const loginResponse = await login(TEST_CREDENTIALS.valid);

      // Simulate token expiration
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh tokens
      const refreshResponse = await refreshToken(TEST_CREDENTIALS.valid.tenantId);

      expect(refreshResponse).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });

      // Verify new tokens are different
      expect(refreshResponse.accessToken).not.toBe(loginResponse.tokens.accessToken);
      expect(refreshResponse.refreshToken).not.toBe(loginResponse.tokens.refreshToken);
    });

    it('should handle refresh token expiration', async () => {
      // Attempt refresh without valid tokens
      await expect(refreshToken(TEST_CREDENTIALS.valid.tenantId))
        .rejects
        .toThrow('No refresh token available');
    });

    it('should maintain tenant context during token refresh', async () => {
      // Setup multiple tenant sessions
      await login(TEST_CREDENTIALS.valid);
      await login(TEST_CREDENTIALS.crossTenant);

      // Refresh tokens for first tenant
      const refreshResponse = await refreshToken(TEST_CREDENTIALS.valid.tenantId);

      // Verify tenant isolation
      const tenant1Tokens = window.localStorage.getItem(
        `crm_1.0_${TEST_CREDENTIALS.valid.tenantId}_auth_tokens`
      );
      expect(JSON.parse(tenant1Tokens!)).toMatchObject({
        data: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        }
      });
    });
  });

  describe('Logout Process', () => {
    it('should successfully clear authentication state', async () => {
      // Setup authenticated session
      await login(TEST_CREDENTIALS.valid);

      // Perform logout
      await logout(TEST_CREDENTIALS.valid.tenantId);

      // Verify token removal
      const storedTokens = window.localStorage.getItem(
        `crm_1.0_${TEST_CREDENTIALS.valid.tenantId}_auth_tokens`
      );
      expect(storedTokens).toBeNull();
    });

    it('should maintain isolation during multi-tenant logout', async () => {
      // Setup multiple tenant sessions
      await login(TEST_CREDENTIALS.valid);
      await login(TEST_CREDENTIALS.crossTenant);

      // Logout first tenant
      await logout(TEST_CREDENTIALS.valid.tenantId);

      // Verify second tenant remains authenticated
      const tenant2Tokens = window.localStorage.getItem(
        `crm_1.0_${TEST_CREDENTIALS.crossTenant.tenantId}_auth_tokens`
      );
      expect(tenant2Tokens).toBeTruthy();
    });

    it('should clear tenant-specific rate limiting data', async () => {
      // Setup rate limiting data
      const rateLimitKey = `crm_1.0_${TEST_CREDENTIALS.valid.tenantId}_login_attempts`;
      window.localStorage.setItem(rateLimitKey, JSON.stringify({
        count: 3,
        lastAttempt: Date.now()
      }));

      // Perform logout
      await logout(TEST_CREDENTIALS.valid.tenantId);

      // Verify rate limit data is cleared
      const rateLimitData = window.localStorage.getItem(rateLimitKey);
      expect(rateLimitData).toBeNull();
    });
  });

  describe('Security Boundaries', () => {
    it('should prevent cross-tenant token usage', async () => {
      // Authenticate with first tenant
      const { tokens } = await login(TEST_CREDENTIALS.valid);

      // Attempt to use tokens with second tenant
      const crossTenantKey = `crm_1.0_${TEST_CREDENTIALS.crossTenant.tenantId}_auth_tokens`;
      window.localStorage.setItem(crossTenantKey, JSON.stringify({
        data: tokens,
        metadata: {
          tenantId: TEST_CREDENTIALS.crossTenant.tenantId,
          version: '1.0'
        }
      }));

      // Verify token validation fails
      await expect(refreshToken(TEST_CREDENTIALS.crossTenant.tenantId))
        .rejects
        .toThrow();
    });

    it('should enforce secure token storage', async () => {
      await login(TEST_CREDENTIALS.valid);

      // Verify tokens are encrypted in storage
      const storedTokens = window.localStorage.getItem(
        `crm_1.0_${TEST_CREDENTIALS.valid.tenantId}_auth_tokens`
      );
      const parsedTokens = JSON.parse(storedTokens!);

      expect(parsedTokens.data.accessToken).not.toMatch(/^eyJ/); // Not raw JWT
      expect(parsedTokens.metadata.encrypted).toBe(true);
    });
  });
});