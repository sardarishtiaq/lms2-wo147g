/**
 * @fileoverview Secure login form component for multi-tenant CRM system
 * Implements JWT-based authentication with tenant isolation and comprehensive validation
 * @version 1.0.0
 */

import React, { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as yup from 'yup';
import {
  TextField,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  Box,
  Typography
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { LoginCredentials } from '../../types/auth';
import { validateEmail } from '../../utils/validation';

// Constants for rate limiting and security
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900; // 15 minutes in seconds

/**
 * Interface for LoginForm component props
 */
interface LoginFormProps {
  onSuccess?: () => void;
  className?: string;
}

/**
 * Interface for form values with validation
 */
interface FormValues {
  email: string;
  password: string;
  tenantId: string;
  rememberMe: boolean;
}

/**
 * Validation schema for login form
 * Implements comprehensive input validation with security measures
 */
const validationSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .test('email', 'Invalid email format', 
      (value) => value ? validateEmail(value, '') : false),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  tenantId: yup
    .string()
    .required('Tenant ID is required')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'Invalid tenant ID format'
    ),
  rememberMe: yup.boolean()
});

/**
 * Secure login form component with multi-tenant support
 * Implements comprehensive security measures and validation
 */
const LoginForm: React.FC<LoginFormProps> = memo(({ onSuccess, className }) => {
  const { login, error, loading } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  // Clear error state on unmount
  useEffect(() => {
    return () => {
      // Cleanup any stored error states
    };
  }, []);

  // Initialize form with Formik
  const formik = useFormik<FormValues>({
    initialValues: {
      email: '',
      password: '',
      tenantId: '',
      rememberMe: false
    },
    validationSchema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      try {
        // Check rate limiting
        if (lockoutUntil && Date.now() < lockoutUntil) {
          const remainingTime = Math.ceil((lockoutUntil - Date.now()) / 1000);
          formik.setErrors({
            email: `Account locked. Try again in ${remainingTime} seconds`
          });
          return;
        }

        // Prepare credentials with tenant context
        const credentials: LoginCredentials = {
          email: values.email.trim().toLowerCase(),
          password: values.password,
          tenantId: values.tenantId.trim()
        };

        // Attempt login
        await login(credentials);

        // Reset attempts on success
        setLoginAttempts(0);
        setLockoutUntil(null);

        // Handle successful login
        if (onSuccess) {
          onSuccess();
        }
        navigate('/dashboard');
      } catch (err) {
        // Track failed attempts
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        // Implement lockout if max attempts exceeded
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          const lockoutTime = Date.now() + (LOCKOUT_DURATION * 1000);
          setLockoutUntil(lockoutTime);
          formik.setErrors({
            email: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION / 60} minutes`
          });
        }
      }
    }
  });

  // Toggle password visibility
  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box
      component="form"
      onSubmit={formik.handleSubmit}
      className={className}
      sx={styles.form}
    >
      <Typography variant="h5" component="h1" gutterBottom>
        Login to CRM
      </Typography>

      {error && (
        <Alert severity="error" sx={styles.errorAlert}>
          {error}
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
        disabled={loading}
      />

      <TextField
        fullWidth
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={formik.values.email}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.touched.email && Boolean(formik.errors.email)}
        helperText={formik.touched.email && formik.errors.email}
        disabled={loading || Boolean(lockoutUntil)}
      />

      <TextField
        fullWidth
        id="password"
        name="password"
        label="Password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        value={formik.values.password}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.touched.password && Boolean(formik.errors.password)}
        helperText={formik.touched.password && formik.errors.password}
        disabled={loading || Boolean(lockoutUntil)}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={handleTogglePassword}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          )
        }}
      />

      <Button
        fullWidth
        type="submit"
        variant="contained"
        color="primary"
        disabled={loading || Boolean(lockoutUntil)}
        sx={styles.submitButton}
      >
        {loading ? <CircularProgress size={24} /> : 'Login'}
      </Button>
    </Box>
  );
});

// Styles object for component
const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    width: '100%',
    maxWidth: '400px',
    margin: '0 auto',
    padding: '24px'
  },
  submitButton: {
    marginTop: '16px',
    height: '42px'
  },
  errorAlert: {
    marginBottom: '16px',
    width: '100%'
  }
} as const;

// Display name for debugging
LoginForm.displayName = 'LoginForm';

export default LoginForm;