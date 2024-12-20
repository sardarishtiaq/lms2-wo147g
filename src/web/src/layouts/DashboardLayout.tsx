/**
 * @fileoverview Protected dashboard layout component with tenant isolation and security features
 * Implements comprehensive access control and layout management for the CRM system
 * @version 1.0.0
 */

import React, { useEffect, useMemo, Suspense, memo } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, useTheme } from '@mui/material';
import MainLayout from './MainLayout';
import { useAuth } from '../hooks/useAuth';
import { useTenant } from '../hooks/useTenant';
import { ROUTES } from '../constants/routes';
import { COLORS } from '../constants/theme';

// Interface definitions
interface DashboardLayoutProps {
  /** Child components to render within the layout */
  children: React.ReactNode;
  /** Flag to require authentication */
  requireAuth?: boolean;
  /** Flag to require tenant context */
  requireTenant?: boolean;
  /** Custom error fallback component */
  errorFallback?: React.ComponentType<any>;
}

/**
 * Loading container component for consistent loading states
 */
const LoadingContainer = memo(() => {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.modal
      }}
      role="progressbar"
      aria-label="Loading dashboard"
    >
      <CircularProgress 
        size={48}
        thickness={4}
        sx={{ color: COLORS.primary }}
      />
    </Box>
  );
});

LoadingContainer.displayName = 'LoadingContainer';

/**
 * Validates access requirements for the dashboard
 * @param requireAuth - Whether authentication is required
 * @param requireTenant - Whether tenant context is required
 * @param isAuthenticated - Current authentication status
 * @param tenant - Current tenant context
 * @returns Access validation result
 */
const validateAccess = (
  requireAuth: boolean,
  requireTenant: boolean,
  isAuthenticated: boolean,
  tenant: any
): boolean => {
  if (requireAuth && !isAuthenticated) {
    return false;
  }
  if (requireTenant && !tenant) {
    return false;
  }
  return true;
};

/**
 * Protected dashboard layout component with enhanced security and tenant isolation
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = memo(({
  children,
  requireAuth = true,
  requireTenant = true,
  errorFallback
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();

  // Memoize access validation
  const hasAccess = useMemo(() => 
    validateAccess(requireAuth, requireTenant, isAuthenticated, tenant),
    [requireAuth, requireTenant, isAuthenticated, tenant]
  );

  // Handle authentication and tenant context changes
  useEffect(() => {
    if (!authLoading && requireAuth && !isAuthenticated) {
      navigate(ROUTES.AUTH.LOGIN, {
        replace: true,
        state: { from: location }
      });
    }
  }, [authLoading, requireAuth, isAuthenticated, navigate, location]);

  // Handle tenant context requirements
  useEffect(() => {
    if (!tenantLoading && requireTenant && !tenant && isAuthenticated) {
      navigate(ROUTES.AUTH.TENANT_SELECT, {
        replace: true,
        state: { from: location }
      });
    }
  }, [tenantLoading, requireTenant, tenant, isAuthenticated, navigate, location]);

  // Handle loading states
  if (authLoading || tenantLoading) {
    return <LoadingContainer />;
  }

  // Handle access validation
  if (!hasAccess) {
    return <Navigate to={ROUTES.AUTH.LOGIN} replace />;
  }

  // Handle tenant errors
  if (tenantError) {
    return errorFallback ? (
      <ErrorFallback error={tenantError} />
    ) : (
      <Navigate to={ROUTES.AUTH.TENANT_SELECT} replace />
    );
  }

  // Render dashboard layout with tenant context
  return (
    <Suspense fallback={<LoadingContainer />}>
      <MainLayout
        tenantId={tenant?.id}
        defaultTheme={tenant?.settings?.branding?.theme}
        errorFallback={errorFallback}
      >
        {children}
      </MainLayout>
    </Suspense>
  );
});

// Display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;