/**
 * @fileoverview Enhanced authentication hook for multi-tenant CRM system
 * Implements secure authentication state management with tenant isolation
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  loginAsync, 
  logoutAsync, 
  refreshTokenAsync,
  selectAuth,
  clearError 
} from '../store/slices/authSlice';
import { LoginCredentials, AuthResponse, AuthError } from '../types/auth';
import { getItem, setItem, removeItem } from '../utils/storage';
import { apiClient } from '../utils/api';

// Security and rate limiting constants
const TOKEN_REFRESH_INTERVAL = 840000; // 14 minutes in milliseconds
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 900000; // 15 minutes in milliseconds
const SECURITY_AUDIT_KEY = 'security_audit_log';

/**
 * Interface for security audit log entry
 */
interface SecurityAuditEntry {
  timestamp: string;
  action: string;
  tenantId: string;
  userId?: string;
  status: 'success' | 'failure';
  details?: Record<string, unknown>;
}

/**
 * Enhanced authentication hook with tenant isolation and security measures
 * @returns Authentication state and methods with security context
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const auth = useSelector(selectAuth);
  const refreshTimerRef = useRef<NodeJS.Timeout>();
  const loginAttemptsRef = useRef<Map<string, number>>(new Map());

  /**
   * Logs security audit events with tenant context
   * @param entry - Security audit log entry
   */
  const logSecurityEvent = useCallback((entry: SecurityAuditEntry) => {
    try {
      const currentLog = getItem<SecurityAuditEntry[]>(entry.tenantId, SECURITY_AUDIT_KEY) || [];
      const updatedLog = [...currentLog, { ...entry, timestamp: new Date().toISOString() }];
      setItem(entry.tenantId, SECURITY_AUDIT_KEY, updatedLog);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }, []);

  /**
   * Checks rate limiting for login attempts
   * @param tenantId - Tenant identifier
   * @returns Boolean indicating if rate limit is exceeded
   */
  const checkRateLimit = useCallback((tenantId: string): boolean => {
    const attempts = loginAttemptsRef.current.get(tenantId) || 0;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      return true;
    }
    loginAttemptsRef.current.set(tenantId, attempts + 1);
    return false;
  }, []);

  /**
   * Resets rate limiting counter
   * @param tenantId - Tenant identifier
   */
  const resetRateLimit = useCallback((tenantId: string) => {
    loginAttemptsRef.current.delete(tenantId);
  }, []);

  /**
   * Handles secure login with tenant context validation
   * @param credentials - Login credentials with tenant context
   */
  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    try {
      // Check rate limiting
      if (checkRateLimit(credentials.tenantId)) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Set tenant context for API client
      apiClient.setTenantContext(credentials.tenantId);

      // Dispatch login action
      const response = await dispatch(loginAsync(credentials)).unwrap();

      // Log successful login
      logSecurityEvent({
        action: 'LOGIN',
        tenantId: credentials.tenantId,
        userId: response.user.id,
        status: 'success'
      });

      // Reset rate limiting on successful login
      resetRateLimit(credentials.tenantId);

      // Start token refresh cycle
      startTokenRefresh();
    } catch (error) {
      // Log failed login attempt
      logSecurityEvent({
        action: 'LOGIN',
        tenantId: credentials.tenantId,
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      throw error;
    }
  }, [dispatch, checkRateLimit, resetRateLimit, logSecurityEvent]);

  /**
   * Handles secure logout with cleanup
   */
  const handleLogout = useCallback(async () => {
    if (!auth.tenantId) return;

    try {
      // Set tenant context for API client
      apiClient.setTenantContext(auth.tenantId);

      // Dispatch logout action
      await dispatch(logoutAsync(auth.tenantId)).unwrap();

      // Stop token refresh cycle
      stopTokenRefresh();

      // Log successful logout
      logSecurityEvent({
        action: 'LOGOUT',
        tenantId: auth.tenantId,
        userId: auth.user?.id,
        status: 'success'
      });

      // Clear sensitive data
      removeItem(auth.tenantId, 'auth_tokens');
    } catch (error) {
      // Log failed logout attempt
      logSecurityEvent({
        action: 'LOGOUT',
        tenantId: auth.tenantId,
        userId: auth.user?.id,
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      throw error;
    }
  }, [auth.tenantId, auth.user?.id, dispatch, logSecurityEvent]);

  /**
   * Handles secure token refresh
   */
  const handleTokenRefresh = useCallback(async () => {
    if (!auth.tenantId) return;

    try {
      // Set tenant context for API client
      apiClient.setTenantContext(auth.tenantId);

      // Dispatch token refresh action
      await dispatch(refreshTokenAsync(auth.tenantId)).unwrap();

      // Log successful token refresh
      logSecurityEvent({
        action: 'TOKEN_REFRESH',
        tenantId: auth.tenantId,
        userId: auth.user?.id,
        status: 'success'
      });
    } catch (error) {
      // Log failed token refresh
      logSecurityEvent({
        action: 'TOKEN_REFRESH',
        tenantId: auth.tenantId,
        userId: auth.user?.id,
        status: 'failure',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      // Force logout on token refresh failure
      await handleLogout();
    }
  }, [auth.tenantId, auth.user?.id, dispatch, handleLogout, logSecurityEvent]);

  /**
   * Starts token refresh cycle
   */
  const startTokenRefresh = useCallback(() => {
    stopTokenRefresh();
    refreshTimerRef.current = setInterval(handleTokenRefresh, TOKEN_REFRESH_INTERVAL);
  }, [handleTokenRefresh]);

  /**
   * Stops token refresh cycle
   */
  const stopTokenRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = undefined;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTokenRefresh();
    };
  }, [stopTokenRefresh]);

  // Start token refresh cycle if authenticated
  useEffect(() => {
    if (auth.isAuthenticated && auth.tenantId) {
      startTokenRefresh();
    }
  }, [auth.isAuthenticated, auth.tenantId, startTokenRefresh]);

  return {
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    tenantId: auth.tenantId,
    loading: auth.loading,
    error: auth.error,
    login: handleLogin,
    logout: handleLogout,
    refreshToken: handleTokenRefresh,
    clearError: () => dispatch(clearError())
  };
};