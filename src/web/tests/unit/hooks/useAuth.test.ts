/**
 * @fileoverview Unit tests for useAuth hook with security and tenant isolation
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { useAuth } from '../../../src/hooks/useAuth';
import authReducer, { loginAsync, logoutAsync, refreshTokenAsync } from '../../../src/store/slices/authSlice';
import { LoginCredentials } from '../../../src/types/auth';
import { apiClient } from '../../../src/utils/api';
import { getItem, setItem, removeItem } from '../../../src/utils/storage';

// Mock dependencies
jest.mock('../../../src/utils/api');
jest.mock('../../../src/utils/storage');

// Test constants
const TEST_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_USER = {
  id: '123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'AGENT',
  tenantId: TEST_TENANT_ID
};

const MOCK_CREDENTIALS: LoginCredentials = {
  email: 'test@example.com',
  password: 'Test123!@#',
  tenantId: TEST_TENANT_ID
};

/**
 * Sets up test environment with mock store and security utilities
 */
const setupTest = () => {
  // Create mock store with auth reducer
  const store = configureStore({
    reducer: {
      auth: authReducer
    }
  });

  // Mock security audit logger
  const mockLogSecurityEvent = jest.fn();
  const mockCheckRateLimit = jest.fn().mockReturnValue(false);
  const mockResetRateLimit = jest.fn();

  // Create wrapper with Redux Provider
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    wrapper,
    mockLogSecurityEvent,
    mockCheckRateLimit,
    mockResetRateLimit
  };
};

describe('useAuth Hook', () => {
  // Test setup and cleanup
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with secure default state', () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.tenantId).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle secure login with tenant isolation', async () => {
    const { wrapper, mockLogSecurityEvent } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock successful API response
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      user: MOCK_USER,
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer'
      },
      tenantId: TEST_TENANT_ID
    });

    await act(async () => {
      await result.current.login(MOCK_CREDENTIALS);
    });

    // Verify tenant context was set
    expect(apiClient.setTenantContext).toHaveBeenCalledWith(TEST_TENANT_ID);

    // Verify authentication state
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(MOCK_USER);
    expect(result.current.tenantId).toBe(TEST_TENANT_ID);

    // Verify security audit logging
    expect(mockLogSecurityEvent).toHaveBeenCalledWith({
      action: 'LOGIN',
      tenantId: TEST_TENANT_ID,
      userId: MOCK_USER.id,
      status: 'success'
    });

    // Verify token storage
    expect(setItem).toHaveBeenCalledWith(
      TEST_TENANT_ID,
      'auth_tokens',
      expect.any(Object)
    );
  });

  it('should handle login failures securely', async () => {
    const { wrapper, mockLogSecurityEvent } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock API error
    const mockError = new Error('Invalid credentials');
    (apiClient.post as jest.Mock).mockRejectedValueOnce(mockError);

    await act(async () => {
      try {
        await result.current.login(MOCK_CREDENTIALS);
      } catch (error) {
        // Error expected
      }
    });

    // Verify error state
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeTruthy();

    // Verify security audit logging
    expect(mockLogSecurityEvent).toHaveBeenCalledWith({
      action: 'LOGIN',
      tenantId: TEST_TENANT_ID,
      status: 'failure',
      details: { error: 'Invalid credentials' }
    });
  });

  it('should enforce rate limiting on login attempts', async () => {
    const { wrapper, mockCheckRateLimit } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock rate limit exceeded
    mockCheckRateLimit.mockReturnValueOnce(true);

    await act(async () => {
      try {
        await result.current.login(MOCK_CREDENTIALS);
      } catch (error) {
        expect(error).toEqual(new Error('Rate limit exceeded. Please try again later.'));
      }
    });

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('should handle secure logout with cleanup', async () => {
    const { wrapper, mockLogSecurityEvent } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Setup initial authenticated state
    (getItem as jest.Mock).mockReturnValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token'
    });

    await act(async () => {
      await result.current.logout();
    });

    // Verify cleanup
    expect(removeItem).toHaveBeenCalledWith(TEST_TENANT_ID, 'auth_tokens');
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();

    // Verify security audit logging
    expect(mockLogSecurityEvent).toHaveBeenCalledWith({
      action: 'LOGOUT',
      tenantId: TEST_TENANT_ID,
      status: 'success'
    });
  });

  it('should manage token lifecycle securely', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock successful token refresh
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 900,
      tokenType: 'Bearer'
    });

    await act(async () => {
      await result.current.refreshToken();
    });

    // Verify token update
    expect(setItem).toHaveBeenCalledWith(
      TEST_TENANT_ID,
      'auth_tokens',
      expect.any(Object)
    );

    // Verify tenant context maintained
    expect(apiClient.setTenantContext).toHaveBeenCalledWith(TEST_TENANT_ID);
  });

  it('should handle token refresh failures gracefully', async () => {
    const { wrapper, mockLogSecurityEvent } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock refresh failure
    const mockError = new Error('Token refresh failed');
    (apiClient.post as jest.Mock).mockRejectedValueOnce(mockError);

    await act(async () => {
      try {
        await result.current.refreshToken();
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    // Verify security audit logging
    expect(mockLogSecurityEvent).toHaveBeenCalledWith({
      action: 'TOKEN_REFRESH',
      tenantId: TEST_TENANT_ID,
      status: 'failure',
      details: { error: 'Token refresh failed' }
    });
  });

  it('should maintain tenant isolation during state changes', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt cross-tenant access
    const differentTenantId = '660e8400-e29b-41d4-a716-446655440000';
    
    await act(async () => {
      try {
        await result.current.login({
          ...MOCK_CREDENTIALS,
          tenantId: differentTenantId
        });
      } catch (error) {
        // Error expected
      }
    });

    // Verify tenant isolation
    expect(result.current.tenantId).not.toBe(TEST_TENANT_ID);
    expect(getItem).not.toHaveBeenCalledWith(TEST_TENANT_ID, 'auth_tokens');
  });
});