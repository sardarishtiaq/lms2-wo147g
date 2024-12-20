/**
 * @fileoverview Secure password reset request form component for multi-tenant CRM system
 * Implements Material Design specifications with comprehensive validation and rate limiting
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { TextField, Button, Box, Typography, Alert } from '@mui/material';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { requestPasswordReset } from '../../services/auth';

// Validation schema with security constraints
const validationSchema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .max(255, 'Email must not exceed 255 characters'),
  tenantId: yup
    .string()
    .required('Tenant ID is required')
    .max(50, 'Tenant ID must not exceed 50 characters')
    .matches(/^[a-zA-Z0-9-]+$/, 'Invalid tenant ID format')
});

// Props interface with security configurations
interface ForgotPasswordFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  maxAttempts?: number;
  cooldownPeriod?: number;
}

// Form values interface
interface FormValues {
  email: string;
  tenantId: string;
}

// Form state interface for rate limiting
interface FormState {
  isSubmitting: boolean;
  error: string | null;
  attempts: number;
  lastAttempt: Date | null;
  cooldownRemaining: number | null;
}

/**
 * Secure password reset request form component
 * Implements rate limiting and comprehensive validation
 */
export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = React.memo(({
  onSuccess,
  onCancel,
  maxAttempts = 3,
  cooldownPeriod = 300000 // 5 minutes in milliseconds
}) => {
  // Form state management with security tracking
  const [formState, setFormState] = useState<FormState>({
    isSubmitting: false,
    error: null,
    attempts: 0,
    lastAttempt: null,
    cooldownRemaining: null
  });

  // Initialize form with Formik
  const formik = useFormik<FormValues>({
    initialValues: {
      email: '',
      tenantId: ''
    },
    validationSchema,
    validateOnBlur: true,
    validateOnChange: true,
    onSubmit: async (values) => {
      try {
        // Check rate limiting
        if (formState.attempts >= maxAttempts && formState.lastAttempt) {
          const timeSinceLastAttempt = Date.now() - formState.lastAttempt.getTime();
          if (timeSinceLastAttempt < cooldownPeriod) {
            const remaining = Math.ceil((cooldownPeriod - timeSinceLastAttempt) / 1000);
            setFormState(prev => ({
              ...prev,
              error: `Too many attempts. Please try again in ${remaining} seconds.`,
              cooldownRemaining: remaining
            }));
            return;
          }
          // Reset attempts after cooldown
          setFormState(prev => ({
            ...prev,
            attempts: 0,
            lastAttempt: null,
            cooldownRemaining: null
          }));
        }

        setFormState(prev => ({ ...prev, isSubmitting: true, error: null }));

        // Call password reset service
        await requestPasswordReset({
          email: values.email.trim().toLowerCase(),
          tenantId: values.tenantId.trim()
        });

        // Update attempt tracking
        setFormState(prev => ({
          ...prev,
          attempts: prev.attempts + 1,
          lastAttempt: new Date(),
          isSubmitting: false
        }));

        onSuccess();
      } catch (error) {
        setFormState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'An error occurred',
          isSubmitting: false,
          attempts: prev.attempts + 1,
          lastAttempt: new Date()
        }));
      }
    }
  });

  // Cooldown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (formState.cooldownRemaining && formState.cooldownRemaining > 0) {
      timer = setInterval(() => {
        setFormState(prev => ({
          ...prev,
          cooldownRemaining: prev.cooldownRemaining ? prev.cooldownRemaining - 1 : null
        }));
      }, 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [formState.cooldownRemaining]);

  // Handle cancel with cleanup
  const handleCancel = useCallback(() => {
    formik.resetForm();
    setFormState({
      isSubmitting: false,
      error: null,
      attempts: 0,
      lastAttempt: null,
      cooldownRemaining: null
    });
    onCancel();
  }, [formik, onCancel]);

  return (
    <Box
      component="form"
      onSubmit={formik.handleSubmit}
      noValidate
      sx={{
        width: '100%',
        maxWidth: 400,
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <Typography variant="h4" component="h1" gutterBottom>
        Reset Password
      </Typography>

      {formState.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {formState.error}
        </Alert>
      )}

      <TextField
        fullWidth
        id="tenantId"
        name="tenantId"
        label="Tenant ID"
        value={formik.values.tenantId}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.touched.tenantId && Boolean(formik.errors.tenantId)}
        helperText={formik.touched.tenantId && formik.errors.tenantId}
        disabled={formState.isSubmitting || Boolean(formState.cooldownRemaining)}
        inputProps={{
          'data-testid': 'tenant-id-input',
          maxLength: 50
        }}
      />

      <TextField
        fullWidth
        id="email"
        name="email"
        label="Email Address"
        type="email"
        value={formik.values.email}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.touched.email && Boolean(formik.errors.email)}
        helperText={formik.touched.email && formik.errors.email}
        disabled={formState.isSubmitting || Boolean(formState.cooldownRemaining)}
        inputProps={{
          'data-testid': 'email-input',
          maxLength: 255
        }}
      />

      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={
            formState.isSubmitting ||
            Boolean(formState.cooldownRemaining) ||
            !formik.isValid ||
            !formik.dirty
          }
          sx={{ flex: 1 }}
          data-testid="submit-button"
        >
          {formState.isSubmitting ? (
            <LoadingSpinner size="small" color="inherit" />
          ) : (
            'Reset Password'
          )}
        </Button>
        <Button
          type="button"
          variant="outlined"
          onClick={handleCancel}
          disabled={formState.isSubmitting}
          sx={{ flex: 1 }}
          data-testid="cancel-button"
        >
          Cancel
        </Button>
      </Box>

      {formState.cooldownRemaining && (
        <Typography variant="body2" color="error" align="center" sx={{ mt: 2 }}>
          Please wait {formState.cooldownRemaining} seconds before trying again
        </Typography>
      )}
    </Box>
  );
});

ForgotPasswordForm.displayName = 'ForgotPasswordForm';

export default ForgotPasswordForm;