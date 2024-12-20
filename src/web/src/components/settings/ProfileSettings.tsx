/**
 * @fileoverview Profile settings component for multi-tenant CRM system
 * Implements secure user profile management with tenant isolation
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as yup from 'yup';
import {
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Typography,
  Divider,
  Paper
} from '@mui/material';
import { User, UserPreferences } from '../../types/user';
import { useAuth } from '../../hooks/useAuth';
import { updateUserProfile, updatePassword } from '../../services/users';

// Password validation constants
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;

/**
 * Interface for profile form data
 */
interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  preferences: UserPreferences;
}

/**
 * Interface for password form data
 */
interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Validation schema for profile form
 */
const profileValidationSchema = yup.object({
  firstName: yup.string()
    .required('First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be at most 50 characters'),
  lastName: yup.string()
    .required('Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be at most 50 characters'),
  email: yup.string()
    .required('Email is required')
    .email('Invalid email format'),
  preferences: yup.object({
    theme: yup.string().oneOf(['light', 'dark', 'system']),
    language: yup.string(),
    notifications: yup.object({
      email: yup.boolean(),
      inApp: yup.boolean(),
      desktop: yup.boolean(),
      leadUpdates: yup.boolean(),
      quoteUpdates: yup.boolean(),
      systemAlerts: yup.boolean()
    })
  })
});

/**
 * Validation schema for password form
 */
const passwordValidationSchema = yup.object({
  currentPassword: yup.string()
    .required('Current password is required'),
  newPassword: yup.string()
    .required('New password is required')
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .matches(PASSWORD_REGEX, 'Password must contain uppercase, lowercase, number and special character'),
  confirmPassword: yup.string()
    .required('Password confirmation is required')
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
});

/**
 * Profile settings component with tenant isolation
 */
const ProfileSettings: React.FC = () => {
  const { user, tenantId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form handling
  const profileForm = useFormik<ProfileFormData>({
    initialValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      preferences: user?.preferences || {
        theme: 'system',
        language: 'en',
        notifications: {
          email: true,
          inApp: true,
          desktop: false,
          leadUpdates: true,
          quoteUpdates: true,
          systemAlerts: true
        }
      }
    },
    validationSchema: profileValidationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError(null);

        if (!user?.id || !tenantId) {
          throw new Error('User context not available');
        }

        await updateUserProfile(user.id, {
          ...values,
          tenantId
        });

        setSuccess('Profile updated successfully');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update profile');
      } finally {
        setLoading(false);
      }
    }
  });

  // Password form handling
  const passwordForm = useFormik<PasswordFormData>({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    },
    validationSchema: passwordValidationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError(null);

        if (!user?.id || !tenantId) {
          throw new Error('User context not available');
        }

        await updatePassword(values.currentPassword, values.newPassword);
        
        setSuccess('Password updated successfully');
        passwordForm.resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update password');
      } finally {
        setLoading(false);
      }
    }
  });

  // Reset success message after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <Grid container spacing={3}>
      {/* Profile Form */}
      <Grid item xs={12}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Profile Information
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <form onSubmit={profileForm.handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  id="firstName"
                  name="firstName"
                  label="First Name"
                  value={profileForm.values.firstName}
                  onChange={profileForm.handleChange}
                  error={profileForm.touched.firstName && Boolean(profileForm.errors.firstName)}
                  helperText={profileForm.touched.firstName && profileForm.errors.firstName}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  id="lastName"
                  name="lastName"
                  label="Last Name"
                  value={profileForm.values.lastName}
                  onChange={profileForm.handleChange}
                  error={profileForm.touched.lastName && Boolean(profileForm.errors.lastName)}
                  helperText={profileForm.touched.lastName && profileForm.errors.lastName}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  id="email"
                  name="email"
                  label="Email"
                  value={profileForm.values.email}
                  onChange={profileForm.handleChange}
                  error={profileForm.touched.email && Boolean(profileForm.errors.email)}
                  helperText={profileForm.touched.email && profileForm.errors.email}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Notification Preferences
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          name="preferences.notifications.email"
                          checked={profileForm.values.preferences.notifications.email}
                          onChange={profileForm.handleChange}
                        />
                      }
                      label="Email Notifications"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          name="preferences.notifications.inApp"
                          checked={profileForm.values.preferences.notifications.inApp}
                          onChange={profileForm.handleChange}
                        />
                      }
                      label="In-App Notifications"
                    />
                  </Grid>
                </Grid>
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={loading}
                  sx={{ mr: 2 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Update Profile'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Grid>

      {/* Password Form */}
      <Grid item xs={12}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Change Password
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <form onSubmit={passwordForm.handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  label="Current Password"
                  value={passwordForm.values.currentPassword}
                  onChange={passwordForm.handleChange}
                  error={passwordForm.touched.currentPassword && Boolean(passwordForm.errors.currentPassword)}
                  helperText={passwordForm.touched.currentPassword && passwordForm.errors.currentPassword}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  label="New Password"
                  value={passwordForm.values.newPassword}
                  onChange={passwordForm.handleChange}
                  error={passwordForm.touched.newPassword && Boolean(passwordForm.errors.newPassword)}
                  helperText={passwordForm.touched.newPassword && passwordForm.errors.newPassword}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  label="Confirm New Password"
                  value={passwordForm.values.confirmPassword}
                  onChange={passwordForm.handleChange}
                  error={passwordForm.touched.confirmPassword && Boolean(passwordForm.errors.confirmPassword)}
                  helperText={passwordForm.touched.confirmPassword && passwordForm.errors.confirmPassword}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'Change Password'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Grid>

      {/* Feedback Messages */}
      {error && (
        <Grid item xs={12}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Grid>
      )}

      {success && (
        <Grid item xs={12}>
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </Grid>
      )}
    </Grid>
  );
};

export default ProfileSettings;