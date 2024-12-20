/**
 * @fileoverview Reset Password Page component for multi-tenant CRM system
 * Implements secure password reset with token validation and tenant isolation
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import ResetPasswordForm from '../../components/auth/ResetPasswordForm';
import { PasswordResetPayload } from '../../types/auth';
import { apiClient } from '../../utils/api';
import { AUTH_ENDPOINTS } from '../../constants/apiEndpoints';
import { TenantBranding } from '../../types/tenant';

// Constants for rate limiting and security
const MAX_RESET_ATTEMPTS = 3;
const RESET_TIMEOUT = 300000; // 5 minutes in milliseconds
const SUCCESS_REDIRECT_DELAY = 3000; // 3 seconds

/**
 * Interface for component state management
 */
interface ResetPasswordState {
  loading: boolean;
  error: string | null;
  remainingAttempts: number;
  tenantBranding: TenantBranding | null;
  isTokenValid: boolean;
}

/**
 * Reset Password Page Component
 * Provides secure password reset functionality with tenant isolation
 */
const ResetPasswordPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { token, tenantId } = useParams<{ token: string; tenantId: string }>();

  // Component state
  const [state, setState] = useState<ResetPasswordState>({
    loading: true,
    error: null,
    remainingAttempts: MAX_RESET_ATTEMPTS,
    tenantBranding: null,
    isTokenValid: false
  });

  /**
   * Validates reset token and loads tenant branding
   */
  const initializeReset = useCallback(async () => {
    if (!token || !tenantId) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Invalid reset link. Please request a new password reset.'
      }));
      return;
    }

    try {
      // Set tenant context for API calls
      apiClient.setTenantContext(tenantId);

      // Validate token
      const tokenValidation = await apiClient.post(AUTH_ENDPOINTS.VERIFY_TOKEN, { token });
      
      if (!tokenValidation.valid) {
        throw new Error('Reset token has expired or is invalid');
      }

      // Load tenant branding
      const branding = await apiClient.get<TenantBranding>(AUTH_ENDPOINTS.GET_BRANDING);

      setState(prev => ({
        ...prev,
        loading: false,
        isTokenValid: true,
        tenantBranding: branding
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to validate reset token',
        isTokenValid: false
      }));
    }
  }, [token, tenantId]);

  /**
   * Handles password reset form submission
   */
  const handleResetSubmit = useCallback(async (resetData: PasswordResetPayload) => {
    if (state.remainingAttempts <= 0) {
      setState(prev => ({
        ...prev,
        error: 'Too many attempts. Please request a new password reset.'
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      await apiClient.post(AUTH_ENDPOINTS.RESET_PASSWORD, {
        ...resetData,
        token,
        tenantId
      });

      // Show success state briefly before redirecting
      setState(prev => ({ ...prev, loading: false, error: null }));
      
      // Redirect to login after successful reset
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: 'Password reset successful. Please log in with your new password.' 
          }
        });
      }, SUCCESS_REDIRECT_DELAY);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to reset password',
        remainingAttempts: prev.remainingAttempts - 1
      }));
    }
  }, [state.remainingAttempts, token, tenantId, navigate]);

  /**
   * Handles form validation errors
   */
  const handleResetError = useCallback((error: Error) => {
    setState(prev => ({
      ...prev,
      error: error.message,
      remainingAttempts: prev.remainingAttempts - 1
    }));
  }, []);

  // Initialize component
  useEffect(() => {
    initializeReset();

    // Cleanup timeout on unmount
    return () => {
      const timeoutId = setTimeout(() => {
        navigate('/login');
      }, RESET_TIMEOUT);
      return () => clearTimeout(timeoutId);
    };
  }, [initializeReset, navigate]);

  return (
    <AuthLayout
      title="Reset Password"
      loading={state.loading}
      error={state.error}
      tenantBranding={state.tenantBranding}
    >
      {state.isTokenValid && (
        <ResetPasswordForm
          onSubmit={handleResetSubmit}
          onError={handleResetError}
          remainingAttempts={state.remainingAttempts}
        />
      )}
    </AuthLayout>
  );
});

// Display name for debugging
ResetPasswordPage.displayName = 'ResetPasswordPage';

export default ResetPasswordPage;