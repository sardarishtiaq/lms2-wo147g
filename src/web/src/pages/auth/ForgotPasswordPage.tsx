/**
 * @fileoverview Forgot Password Page component for multi-tenant CRM system
 * Implements secure password reset request functionality with rate limiting and security monitoring
 * @version 1.0.0
 */

import React, { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.14.0
import AuthLayout from '../../layouts/AuthLayout';
import ForgotPasswordForm from '../../components/auth/ForgotPasswordForm';
import { ROUTES } from '../../constants/routes';

// Constants for security and rate limiting
const PAGE_TITLE = 'Forgot Password';
const RATE_LIMIT_THRESHOLD = 5;
const ERROR_MESSAGES = {
  RATE_LIMIT: 'Too many attempts. Please try again later.',
  GENERAL_ERROR: 'An error occurred. Please try again.',
  INVALID_EMAIL: 'Please enter a valid email address.'
} as const;

/**
 * ForgotPasswordPage Component
 * 
 * Secure password reset request page with rate limiting and security monitoring.
 * Implements Material Design specifications and accessibility features.
 */
const ForgotPasswordPage: React.FC = memo(() => {
  // Navigation hook for routing
  const navigate = useNavigate();

  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles successful password reset request
   * Redirects to login page with success message
   * @param email - Email address that requested password reset
   */
  const handleSuccess = useCallback((email: string) => {
    // Navigate to login with success message
    navigate(ROUTES.AUTH.LOGIN, {
      state: {
        message: `Password reset instructions have been sent to ${email}. Please check your email.`,
        type: 'success'
      },
      replace: true
    });
  }, [navigate]);

  /**
   * Handles password reset request errors
   * Implements rate limiting and security monitoring
   * @param error - Error object from form submission
   */
  const handleError = useCallback((error: Error) => {
    setLoading(false);
    setError(error.message || ERROR_MESSAGES.GENERAL_ERROR);

    // Log security event for monitoring
    console.error('Password reset error:', {
      timestamp: new Date().toISOString(),
      error: error.message,
      type: 'PASSWORD_RESET_ERROR'
    });
  }, []);

  /**
   * Handles cancellation of password reset
   * Redirects back to login page
   */
  const handleCancel = useCallback(() => {
    navigate(ROUTES.AUTH.LOGIN, { replace: true });
  }, [navigate]);

  return (
    <AuthLayout
      title={PAGE_TITLE}
      loading={loading}
      error={error}
      testId="forgot-password-page"
    >
      <ForgotPasswordForm
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        onError={handleError}
        maxAttempts={RATE_LIMIT_THRESHOLD}
        cooldownPeriod={300000} // 5 minutes in milliseconds
      />
    </AuthLayout>
  );
});

// Display name for debugging
ForgotPasswordPage.displayName = 'ForgotPasswordPage';

export default ForgotPasswordPage;