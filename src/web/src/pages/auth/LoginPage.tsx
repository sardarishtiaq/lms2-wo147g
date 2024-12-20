/**
 * @fileoverview Enhanced login page component for multi-tenant CRM system
 * Implements secure JWT-based authentication with tenant isolation, accessibility features,
 * and comprehensive error handling
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErrorBoundary } from 'react-error-boundary';
import AuthLayout from '../../layouts/AuthLayout';
import LoginForm from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import ErrorBoundary from '../../components/common/ErrorBoundary';

// Constants for routes and test IDs
const DASHBOARD_ROUTE = '/dashboard';
const TEST_IDS = {
  LOGIN_PAGE: 'login-page',
  LOGIN_FORM: 'login-form',
  ERROR_MESSAGE: 'error-message',
} as const;

// Error messages for different scenarios
const ERROR_MESSAGES = {
  AUTH_FAILED: 'Authentication failed. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  RATE_LIMIT: 'Too many attempts. Please try again later.',
} as const;

/**
 * Enhanced login page component with security features and accessibility
 * Implements JWT-based authentication with tenant isolation
 * 
 * @returns {JSX.Element} Rendered login page with security and accessibility features
 */
const LoginPage: React.FC = React.memo(() => {
  // Hooks initialization
  const navigate = useNavigate();
  const { loading, error } = useAuth();
  const { showBoundary } = useErrorBoundary();

  // Clear any existing errors on unmount
  useEffect(() => {
    return () => {
      // Cleanup function to clear sensitive data
      sessionStorage.removeItem('loginAttempts');
    };
  }, []);

  /**
   * Handles successful login with proper navigation
   * Implements secure post-login routing
   */
  const handleLoginSuccess = useCallback(() => {
    try {
      // Navigate to dashboard with history replacement for security
      navigate(DASHBOARD_ROUTE, { replace: true });
    } catch (error) {
      // Handle navigation errors
      showBoundary(error);
    }
  }, [navigate, showBoundary]);

  /**
   * Handles login errors with proper error reporting
   * Implements comprehensive error handling and user feedback
   */
  const handleLoginError = useCallback((error: Error) => {
    // Log error for monitoring but sanitize sensitive data
    console.error('Login error:', error.message);

    // Report error to error boundary if needed
    if (error.name !== 'AuthError') {
      showBoundary(error);
    }
  }, [showBoundary]);

  return (
    <ErrorBoundary>
      <AuthLayout
        title="Welcome to CRM"
        loading={loading}
        error={error?.message}
        testId={TEST_IDS.LOGIN_PAGE}
      >
        <LoginForm
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
          data-testid={TEST_IDS.LOGIN_FORM}
        />
      </AuthLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
LoginPage.displayName = 'LoginPage';

export default LoginPage;