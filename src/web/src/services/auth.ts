/**
 * @fileoverview Authentication service module for multi-tenant CRM system
 * Implements secure JWT-based authentication with tenant isolation and token lifecycle management
 * @version 1.0.0
 */

import { LoginCredentials, AuthResponse, AuthTokens, TokenValidationResponse } from '../types/auth';
import { apiClient } from '../utils/api';
import { setItem, getItem, removeItem } from '../utils/storage';
import { AUTH_ENDPOINTS } from '../constants/apiEndpoints';
import CryptoJS from 'crypto-js'; // v4.1.1
import jwtDecode from 'jwt-decode'; // v3.1.2

// Constants for token management and security
const TOKEN_ENCRYPTION_KEY = process.env.REACT_APP_TOKEN_ENCRYPTION_KEY as string;
const ACCESS_TOKEN_EXPIRY = 900; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRY = 604800; // 7 days in seconds
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900; // 15 minutes in seconds

/**
 * Error class for authentication-specific exceptions
 */
class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Interface for tracking login attempts
 */
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

/**
 * Encrypts sensitive token data before storage
 * @param data - Data to encrypt
 * @returns Encrypted string
 */
const encryptToken = (data: string): string => {
  return CryptoJS.AES.encrypt(data, TOKEN_ENCRYPTION_KEY).toString();
};

/**
 * Decrypts token data from storage
 * @param encryptedData - Encrypted data to decrypt
 * @returns Decrypted string
 */
const decryptToken = (encryptedData: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, TOKEN_ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Validates JWT token structure and expiration
 * @param token - JWT token to validate
 * @returns Boolean indicating token validity
 */
const isTokenValid = (token: string): boolean => {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

/**
 * Tracks and manages login attempts for rate limiting
 * @param tenantId - Tenant identifier
 * @returns Updated login attempt tracking
 */
const trackLoginAttempt = (tenantId: string): LoginAttempt => {
  const key = `login_attempts_${tenantId}`;
  const attempts = getItem<LoginAttempt>(tenantId, key) || { count: 0, lastAttempt: 0 };
  
  // Check if lockout period has expired
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    throw new AuthError('Account temporarily locked', 'ACCOUNT_LOCKED');
  }

  // Reset attempts if last attempt was more than lockout duration ago
  if (Date.now() - attempts.lastAttempt > LOCKOUT_DURATION * 1000) {
    attempts.count = 0;
  }

  attempts.count++;
  attempts.lastAttempt = Date.now();

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION * 1000;
  }

  setItem(tenantId, key, attempts);
  return attempts;
};

/**
 * Authenticates user with credentials and manages token lifecycle
 * @param credentials - Login credentials with tenant context
 * @returns Authentication response with tokens and user data
 * @throws AuthError if authentication fails
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    // Track login attempts for rate limiting
    const attempts = trackLoginAttempt(credentials.tenantId);
    if (attempts.lockedUntil) {
      throw new AuthError('Too many login attempts', 'RATE_LIMIT_EXCEEDED');
    }

    // Set tenant context for API client
    apiClient.setTenantContext(credentials.tenantId);

    // Perform authentication request
    const response = await apiClient.post<AuthResponse>(AUTH_ENDPOINTS.LOGIN, credentials);

    // Encrypt tokens before storage
    const encryptedTokens: AuthTokens = {
      ...response.tokens,
      accessToken: encryptToken(response.tokens.accessToken),
      refreshToken: encryptToken(response.tokens.refreshToken)
    };

    // Store encrypted tokens
    setItem(credentials.tenantId, 'auth_tokens', encryptedTokens);

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(
      error instanceof Error ? error.message : 'Authentication failed',
      'AUTH_FAILED'
    );
  }
};

/**
 * Refreshes authentication tokens
 * @param tenantId - Tenant identifier
 * @returns New authentication tokens
 * @throws AuthError if refresh fails
 */
export const refreshToken = async (tenantId: string): Promise<AuthTokens> => {
  try {
    const currentTokens = getItem<AuthTokens>(tenantId, 'auth_tokens');
    if (!currentTokens?.refreshToken) {
      throw new AuthError('No refresh token available', 'NO_REFRESH_TOKEN');
    }

    // Decrypt stored refresh token
    const decryptedRefreshToken = decryptToken(currentTokens.refreshToken);

    // Validate refresh token
    if (!isTokenValid(decryptedRefreshToken)) {
      throw new AuthError('Refresh token expired', 'TOKEN_EXPIRED');
    }

    // Set tenant context for API client
    apiClient.setTenantContext(tenantId);

    // Request new tokens
    const response = await apiClient.post<AuthTokens>(AUTH_ENDPOINTS.REFRESH, {
      refreshToken: decryptedRefreshToken
    });

    // Encrypt new tokens
    const encryptedTokens: AuthTokens = {
      ...response,
      accessToken: encryptToken(response.accessToken),
      refreshToken: encryptToken(response.refreshToken)
    };

    // Store new encrypted tokens
    setItem(tenantId, 'auth_tokens', encryptedTokens);

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(
      error instanceof Error ? error.message : 'Token refresh failed',
      'REFRESH_FAILED'
    );
  }
};

/**
 * Terminates user session and cleans up authentication state
 * @param tenantId - Tenant identifier
 * @throws AuthError if logout fails
 */
export const logout = async (tenantId: string): Promise<void> => {
  try {
    // Set tenant context for API client
    apiClient.setTenantContext(tenantId);

    // Notify server to invalidate tokens
    await apiClient.delete(AUTH_ENDPOINTS.LOGOUT);

    // Clean up stored tokens
    removeItem(tenantId, 'auth_tokens');
    removeItem(tenantId, 'login_attempts_${tenantId}');
  } catch (error) {
    throw new AuthError(
      error instanceof Error ? error.message : 'Logout failed',
      'LOGOUT_FAILED'
    );
  }
};

/**
 * Validates current authentication state
 * @param tenantId - Tenant identifier
 * @returns Token validation response
 */
export const validateAuth = async (tenantId: string): Promise<TokenValidationResponse> => {
  try {
    const tokens = getItem<AuthTokens>(tenantId, 'auth_tokens');
    if (!tokens?.accessToken) {
      return { valid: false };
    }

    const decryptedToken = decryptToken(tokens.accessToken);
    if (!isTokenValid(decryptedToken)) {
      return { valid: false };
    }

    // Set tenant context for API client
    apiClient.setTenantContext(tenantId);

    // Verify token with server
    const response = await apiClient.post<TokenValidationResponse>(
      AUTH_ENDPOINTS.VERIFY_TOKEN,
      { token: decryptedToken }
    );

    return response;
  } catch (error) {
    return { 
      valid: false,
      error: error instanceof Error ? error.message : 'Token validation failed'
    };
  }
};