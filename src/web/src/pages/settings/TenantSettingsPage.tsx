/**
 * @fileoverview Tenant Settings Page component for the multi-tenant CRM system
 * Implements secure tenant settings management with real-time validation and audit logging
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, CircularProgress, Alert } from '@mui/material';
import DashboardLayout from '../../layouts/DashboardLayout';
import TenantSettings from '../../components/settings/TenantSettings';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { PERMISSIONS } from '../../constants/permissions';
import { ROUTES } from '../../constants/routes';

/**
 * TenantSettingsPage component providing secure tenant settings management
 * with enhanced permission controls and validation
 */
const TenantSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { tenant, loading, error, validateSettings } = useTenant();
  const [permissionError, setPermissionError] = useState<string | null>(null);

  /**
   * Validates user permissions for accessing tenant settings
   */
  const checkPermissions = useCallback(async () => {
    if (!user || !tenant) return false;

    try {
      // Check for required permissions
      const hasViewPermission = user.role && [PERMISSIONS.TENANT_SETTINGS_VIEW].some(
        permission => user.hasPermission?.(permission)
      );

      if (!hasViewPermission) {
        setPermissionError('You do not have permission to view tenant settings');
        return false;
      }

      // Validate tenant access
      const tenantAccess = await validateSettings(tenant.settings);
      if (!tenantAccess) {
        setPermissionError('Invalid tenant settings configuration');
        return false;
      }

      return true;
    } catch (error) {
      setPermissionError(
        error instanceof Error ? error.message : 'Failed to validate permissions'
      );
      return false;
    }
  }, [user, tenant, validateSettings]);

  /**
   * Effect hook for permission validation and access control
   */
  useEffect(() => {
    const validateAccess = async () => {
      if (!isAuthenticated) {
        navigate(ROUTES.AUTH.LOGIN, { replace: true });
        return;
      }

      const hasPermission = await checkPermissions();
      if (!hasPermission) {
        navigate(ROUTES.DASHBOARD.HOME, { replace: true });
      }
    };

    validateAccess();
  }, [isAuthenticated, checkPermissions, navigate]);

  /**
   * Renders loading state
   */
  if (loading) {
    return (
      <DashboardLayout>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  /**
   * Renders error state
   */
  if (error || permissionError) {
    return (
      <DashboardLayout>
        <Container>
          <Alert 
            severity="error"
            sx={{ mt: 3 }}
          >
            {permissionError || error}
          </Alert>
        </Container>
      </DashboardLayout>
    );
  }

  /**
   * Renders main tenant settings page
   */
  return (
    <DashboardLayout>
      <Container>
        <TenantSettings />
      </Container>
    </DashboardLayout>
  );
};

// Export the component
export default TenantSettingsPage;