/**
 * @fileoverview Reset Password Form component for multi-tenant CRM system
 * Implements secure password reset functionality with comprehensive validation
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as yup from 'yup';
import {
  TextField,
  Button,
  Alert,
  CircularProgress,
  Box,
  Typography,
  Paper
} from '@mui/material';
import { PasswordResetPayload } from '../../types/auth';
import { resetPassword } from '../../services/auth';

// Password validation schema based on security requirements
const validationSchema = yup.object({
  newPassword: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(
      /[!@#$%^&*(),.?":{}|<>]/,
      'Password must contain at least one special character'
    ),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
});

/**
 * Reset Password Form Component
 * Handles secure password reset with token validation and comprehensive error handling
 */
const ResetPasswordForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  // Initialize form with Formik
  const formik = useFormik({
    initialValues: {
      newPassword: '',
      confirmPassword: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!token) {
        setError('Invalid reset token');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const payload: PasswordResetPayload = {
          token,
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword
        };

        await resetPassword(payload);
        setSuccess(true);
        
        // Redirect to login after successful reset
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'An error occurred while resetting your password'
        );
      } finally {
        setLoading(false);
      }
    }
  });

  // Early return if token is missing
  if (!token) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Invalid password reset link</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        p: 2
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400
        }}
      >
        <Typography
          variant="h5"
          component="h1"
          gutterBottom
          sx={{ textAlign: 'center' }}
        >
          Reset Your Password
        </Typography>

        {success ? (
          <Alert severity="success">
            Password reset successful! Redirecting to login...
          </Alert>
        ) : (
          <form
            onSubmit={formik.handleSubmit}
            noValidate
            aria-label="Password reset form"
          >
            <TextField
              fullWidth
              id="newPassword"
              name="newPassword"
              label="New Password"
              type="password"
              margin="normal"
              value={formik.values.newPassword}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                formik.touched.newPassword && Boolean(formik.errors.newPassword)
              }
              helperText={formik.touched.newPassword && formik.errors.newPassword}
              disabled={loading}
              inputProps={{
                'aria-label': 'New password input',
                'aria-describedby': 'password-requirements'
              }}
            />

            <TextField
              fullWidth
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              margin="normal"
              value={formik.values.confirmPassword}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                formik.touched.confirmPassword &&
                Boolean(formik.errors.confirmPassword)
              }
              helperText={
                formik.touched.confirmPassword && formik.errors.confirmPassword
              }
              disabled={loading}
              inputProps={{
                'aria-label': 'Confirm password input'
              }}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2 }} role="alert">
                {error}
              </Alert>
            )}

            <Typography
              variant="caption"
              color="textSecondary"
              id="password-requirements"
              sx={{ display: 'block', mt: 1, mb: 2 }}
            >
              Password must be at least 8 characters long and contain uppercase,
              lowercase, number, and special characters.
            </Typography>

            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
              sx={{ mt: 2 }}
              aria-label="Reset password"
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        )}
      </Paper>
    </Box>
  );
};

export default ResetPasswordForm;