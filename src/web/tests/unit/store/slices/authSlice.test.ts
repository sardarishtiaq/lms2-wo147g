/**
 * @fileoverview Unit tests for authentication Redux slice
 * Implements comprehensive testing of authentication state management,
 * tenant isolation, token lifecycle, and security protocols
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import reducer, {
  loginAsync,
  logoutAsync,
  refreshTokenAsync,
  clearError,
  setTokenRefreshStatus,
  resetAuth
} from '../../../../src/store/slices/authSlice';
import * as AuthService from '../../../../src/services/auth';
import { AuthState, LoginCredentials, AuthResponse, AuthError } from '../../../../src/types/auth';
import { UserStatus } from '../../../../src/interfaces/IUser';
import { ROLES } from '../../../../src/constants/roles';

// Mock the auth service
jest.mock('../../../../src/services/auth');

// Test constants
const mockTenantId = '550e8400-e29b-41d4-a716-446655440000';
const mockUser = {
  id: '123',
  tenantId: mockTenantId,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: ROLES.AGENT,
  status: UserStatus.ACTIVE,
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
};

const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 900,
  tokenType: 'Bearer'
};

const mockCredentials: LoginCredentials = {
  email: 'test@example.com',
  password: 'Test123!@#',
  tenantId: mockTenantId
};

const mockAuthResponse: AuthResponse = {
  user: mockUser,
  tokens: mockTokens,
  tenantId: mockTenantId
};

// Configure test store
const createTestStore = () => {
  return configureStore({
    reducer: { auth: reducer }
  });
};

describe('authSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initial state', () => {
    test('should have correct initial state', () => {
      const state = store.getState().auth;
      expect(state).toEqual({
        isAuthenticated: false,
        user: null,
        tenantId: null,
        loading: false,
        error: null,
        tokenRefreshStatus: 'idle',
        lastRefreshAttempt: null,
        refreshRetryCount: 0
      });
    });
  });

  describe('authentication flow', () => {
    test('should handle successful login with tenant context', async () => {
      // Mock successful login
      (AuthService.login as jest.Mock).mockResolvedValueOnce(mockAuthResponse);

      // Dispatch login action
      await store.dispatch(loginAsync(mockCredentials));
      const state = store.getState().auth;

      // Verify state updates
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.tenantId).toBe(mockTenantId);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.tokenRefreshStatus).toBe('idle');
      expect(state.refreshRetryCount).toBe(0);

      // Verify service call
      expect(AuthService.login).toHaveBeenCalledWith(mockCredentials);
    });

    test('should handle login failure with proper error state', async () => {
      const mockError: AuthError = {
        code: 'AUTH_ERROR',
        message: 'Invalid credentials'
      };

      // Mock failed login
      (AuthService.login as jest.Mock).mockRejectedValueOnce(new Error(mockError.message));

      // Dispatch login action
      await store.dispatch(loginAsync(mockCredentials));
      const state = store.getState().auth;

      // Verify error state
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toEqual(mockError);
    });

    test('should handle successful logout', async () => {
      // Setup initial authenticated state
      store.dispatch({ 
        type: loginAsync.fulfilled.type,
        payload: mockAuthResponse
      });

      // Mock successful logout
      (AuthService.logout as jest.Mock).mockResolvedValueOnce(undefined);

      // Dispatch logout action
      await store.dispatch(logoutAsync(mockTenantId));
      const state = store.getState().auth;

      // Verify state reset
      expect(state).toEqual({
        isAuthenticated: false,
        user: null,
        tenantId: null,
        loading: false,
        error: null,
        tokenRefreshStatus: 'idle',
        lastRefreshAttempt: null,
        refreshRetryCount: 0
      });
    });
  });

  describe('token management', () => {
    test('should handle successful token refresh', async () => {
      const mockRefreshResponse = {
        ...mockTokens,
        accessToken: 'new-access-token'
      };

      // Mock successful token refresh
      (AuthService.refreshToken as jest.Mock).mockResolvedValueOnce(mockRefreshResponse);

      // Dispatch refresh action
      await store.dispatch(refreshTokenAsync(mockTenantId));
      const state = store.getState().auth;

      // Verify token refresh state
      expect(state.tokenRefreshStatus).toBe('success');
      expect(state.refreshRetryCount).toBe(0);
      expect(state.error).toBeNull();
    });

    test('should handle token refresh failure with retry count', async () => {
      const mockError: AuthError = {
        code: 'REFRESH_ERROR',
        message: 'Token refresh failed'
      };

      // Mock failed token refresh
      (AuthService.refreshToken as jest.Mock).mockRejectedValueOnce(new Error(mockError.message));

      // Dispatch refresh action
      await store.dispatch(refreshTokenAsync(mockTenantId));
      const state = store.getState().auth;

      // Verify error state and retry count
      expect(state.tokenRefreshStatus).toBe('error');
      expect(state.refreshRetryCount).toBe(1);
      expect(state.error).toEqual(mockError);
    });
  });

  describe('security protocols', () => {
    test('should maintain tenant isolation in state', async () => {
      const differentTenantId = '661f9511-f30b-42d4-b717-557766551111';
      
      // Setup initial state with one tenant
      await store.dispatch(loginAsync({
        ...mockCredentials,
        tenantId: mockTenantId
      }));

      // Attempt to mix tenant contexts
      await store.dispatch(refreshTokenAsync(differentTenantId));
      const state = store.getState().auth;

      // Verify tenant isolation
      expect(state.tenantId).toBe(mockTenantId);
      expect(state.error).toBeTruthy();
    });

    test('should handle max refresh retries security limit', async () => {
      // Mock multiple failed refreshes
      (AuthService.refreshToken as jest.Mock).mockRejectedValue(new Error('Refresh failed'));

      // Attempt multiple refreshes
      for (let i = 0; i < 4; i++) {
        await store.dispatch(refreshTokenAsync(mockTenantId));
      }

      const state = store.getState().auth;

      // Verify security lockout
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.tokenRefreshStatus).toBe('error');
    });
  });

  describe('action creators', () => {
    test('should handle clearError action', () => {
      // Setup initial state with error
      store.dispatch({
        type: loginAsync.rejected.type,
        payload: { code: 'TEST_ERROR', message: 'Test error' }
      });

      // Clear error
      store.dispatch(clearError());
      const state = store.getState().auth;

      // Verify error cleared
      expect(state.error).toBeNull();
    });

    test('should handle setTokenRefreshStatus action', () => {
      // Set refresh status
      store.dispatch(setTokenRefreshStatus('pending'));
      const state = store.getState().auth;

      // Verify status update
      expect(state.tokenRefreshStatus).toBe('pending');
    });

    test('should handle resetAuth action', () => {
      // Setup authenticated state
      store.dispatch({
        type: loginAsync.fulfilled.type,
        payload: mockAuthResponse
      });

      // Reset auth state
      store.dispatch(resetAuth());
      const state = store.getState().auth;

      // Verify complete reset
      expect(state).toEqual({
        isAuthenticated: false,
        user: null,
        tenantId: null,
        loading: false,
        error: null,
        tokenRefreshStatus: 'idle',
        lastRefreshAttempt: null,
        refreshRetryCount: 0
      });
    });
  });
});