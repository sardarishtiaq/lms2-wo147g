/**
 * @fileoverview Authentication types and interfaces for the multi-tenant CRM system
 * Implements JWT-based authentication with tenant isolation and token management
 * @version 1.0.0
 */

import { IUser } from '../../../backend/src/interfaces/IUser';

/**
 * Interface for multi-tenant login credentials
 * Used for initial authentication requests
 */
export interface LoginCredentials {
  /** User's email address */
  email: string;
  
  /** User's password */
  password: string;
  
  /** Tenant identifier for multi-tenant isolation */
  tenantId: string;
}

/**
 * Interface for JWT authentication tokens
 * Implements token management as per technical specifications
 */
export interface AuthTokens {
  /** JWT access token with 15-minute expiration */
  accessToken: string;
  
  /** JWT refresh token with 7-day expiration */
  refreshToken: string;
  
  /** Token expiration time in seconds */
  expiresIn: number;
  
  /** Token type (always 'Bearer' for JWT) */
  tokenType: string;
}

/**
 * Interface for successful authentication response
 * Contains user data, tokens, and tenant context
 */
export interface AuthResponse {
  /** Authenticated user information */
  user: IUser;
  
  /** Authentication tokens */
  tokens: AuthTokens;
  
  /** Current tenant context */
  tenantId: string;
}

/**
 * Interface for authentication state management
 * Used in frontend state stores (e.g., Redux)
 */
export interface AuthState {
  /** Flag indicating if user is authenticated */
  isAuthenticated: boolean;
  
  /** Currently authenticated user or null */
  user: IUser | null;
  
  /** Loading state for authentication operations */
  loading: boolean;
  
  /** Authentication error state */
  error: AuthError | null;
  
  /** Current tenant context */
  tenantId: string | null;
}

/**
 * Type for authentication error handling
 * Standardizes error responses across the system
 */
export type AuthError = {
  /** Error code for programmatic handling */
  code: string;
  
  /** Human-readable error message */
  message: string;
};

/**
 * Interface for tenant-specific password reset requests
 * Ensures password resets maintain tenant isolation
 */
export interface PasswordResetRequest {
  /** User's email address */
  email: string;
  
  /** Tenant context for the reset request */
  tenantId: string;
}

/**
 * Interface for password reset completion payload
 * Implements secure password reset functionality
 */
export interface PasswordResetPayload {
  /** One-time reset token from email */
  token: string;
  
  /** New password value */
  newPassword: string;
  
  /** Password confirmation for validation */
  confirmPassword: string;
}

/**
 * Type for token refresh request payload
 * Used to obtain new access tokens
 */
export type RefreshTokenRequest = {
  /** Current refresh token */
  refreshToken: string;
  
  /** Tenant context for token refresh */
  tenantId: string;
};

/**
 * Type for token validation response
 * Used to verify token validity
 */
export type TokenValidationResponse = {
  /** Flag indicating if token is valid */
  valid: boolean;
  
  /** User data if token is valid */
  user?: IUser;
  
  /** Error message if token is invalid */
  error?: string;
};

/**
 * Type for session management
 * Tracks active user sessions
 */
export type UserSession = {
  /** Session identifier */
  sessionId: string;
  
  /** User identifier */
  userId: string;
  
  /** Tenant identifier */
  tenantId: string;
  
  /** Session creation timestamp */
  createdAt: Date;
  
  /** Last activity timestamp */
  lastActivityAt: Date;
};