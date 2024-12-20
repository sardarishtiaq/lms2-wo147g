/**
 * @fileoverview Secure multi-tenant user management page component
 * Implements comprehensive user administration with strict tenant isolation
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, CircularProgress, Alert } from '@mui/material';
import { Add as AddIcon, Security as SecurityIcon } from '@mui/icons-material';
import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader from '../../components/common/PageHeader';
import UserManagement from '../../components/settings/UserManagement';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { PERMISSIONS } from '../../constants/permissions';
import { ROUTES } from '../../constants/routes';

/**
 * User Management Page component with tenant isolation and RBAC
 */
const UserManagementPage: React.FC = memo(() => {
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { user, tenantId, isAuthenticated } = useAuth();
  const { showNotification } = useNotification();
  
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Verifies admin access with tenant context
   */
  const checkAdminAccess = useCallback((): boolean => {
    if (!isAuthenticated || !user || !tenantId) {
      return false;
    }

    return user.role === 'ADMIN' || user.role === 'MANAGER';
  }, [isAuthenticated, user, tenantId]);

  /**
   * Handles navigation to new user creation
   */
  const handleNewUser = useCallback(() => {
    if (!checkAdminAccess()) {
      showNotification({
        message: 'Insufficient permissions to create users',
        severity: 'error',
        duration: 5000
      });
      return;
    }

    navigate(ROUTES.SETTINGS.USERS + '/new');
  }, [navigate, checkAdminAccess, showNotification]);

  /**
   * Handles user management audit logging
   */
  const handleAuditLog = useCallback((action: string, details: any) => {
    if (!tenantId) return;

    // Log security audit event
    console.log('Security Audit:', {
      action,
      tenantId,
      userId: user?.id,
      timestamp: new Date().toISOString(),
      details
    });
  }, [tenantId, user]);

  /**
   * Handles user update operations
   */
  const handleUserUpdate = useCallback((userId: string, updates: any) => {
    if (!checkAdminAccess()) {
      showNotification({
        message: 'Insufficient permissions to update users',
        severity: 'error',
        duration: 5000
      });
      return;
    }

    handleAuditLog('USER_UPDATE', { userId, updates });
  }, [checkAdminAccess, showNotification, handleAuditLog]);

  // Verify access on mount and route changes
  useEffect(() => {
    if (!checkAdminAccess()) {
      navigate(ROUTES.DASHBOARD.HOME, { replace: true });
      showNotification({
        message: 'Access denied: Insufficient permissions',
        severity: 'error',
        duration: 5000
      });
    }
  }, [checkAdminAccess, navigate, showNotification, location]);

  // Handle loading state cleanup
  useEffect(() => {
    return () => {
      setLoading(false);
      setError(null);
    };
  }, []);

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="User Management"
        subtitle="Manage user accounts and permissions"
        actions={
          <>
            <Button
              variant="contained"
              startIcon={<SecurityIcon />}
              onClick={() => navigate(ROUTES.SETTINGS.PERMISSIONS)}
              sx={{ mr: 2 }}
            >
              Permissions
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleNewUser}
              disabled={!checkAdminAccess()}
            >
              New User
            </Button>
          </>
        }
      />

      {tenantId && user && (
        <UserManagement
          tenantId={tenantId}
          userRole={user.role}
          onUserUpdate={handleUserUpdate}
          onAuditLog={handleAuditLog}
        />
      )}
    </DashboardLayout>
  );
});

// Display name for debugging
UserManagementPage.displayName = 'UserManagementPage';

export default UserManagementPage;