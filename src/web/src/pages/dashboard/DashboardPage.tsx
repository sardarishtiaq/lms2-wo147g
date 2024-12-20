/**
 * @fileoverview Main dashboard page component for the multi-tenant CRM system
 * Implements comprehensive dashboard view with real-time metrics and activity tracking
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { Grid, Box, Paper, Alert, useTheme } from '@mui/material';
import { Dashboard as DashboardIcon, Refresh } from '@mui/icons-material';

// Internal imports
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DashboardMetrics } from '../../components/dashboard/DashboardMetrics';
import { ActivityFeed } from '../../components/dashboard/ActivityFeed';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { useNotification } from '../../hooks/useNotification';

// Interface definitions
interface DashboardPageProps {
  tenantId: string;
  refreshInterval?: number;
}

/**
 * Main dashboard page component with enhanced error handling and performance optimizations
 */
const DashboardPage: React.FC<DashboardPageProps> = ({
  tenantId,
  refreshInterval = 30000 // 30 seconds default refresh
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();
  const { showNotification } = useNotification();

  // Memoize dashboard configuration based on tenant settings
  const dashboardConfig = useMemo(() => ({
    showActivityFeed: tenant?.settings?.features?.activityFeed ?? true,
    refreshInterval: tenant?.settings?.refreshInterval ?? refreshInterval,
    metrics: tenant?.settings?.dashboardMetrics ?? ['leads', 'quotes', 'activities']
  }), [tenant, refreshInterval]);

  // Handle dashboard refresh with error handling
  const handleRefresh = useCallback(async () => {
    try {
      // Trigger refresh events for child components
      document.dispatchEvent(new CustomEvent('refreshDashboard'));
      
      showNotification({
        message: 'Dashboard refreshed successfully',
        severity: 'success',
        duration: 3000
      });
    } catch (error) {
      showNotification({
        message: 'Failed to refresh dashboard',
        severity: 'error',
        duration: 5000
      });
    }
  }, [showNotification]);

  // Set up automatic refresh interval
  useEffect(() => {
    if (dashboardConfig.refreshInterval > 0) {
      const intervalId = setInterval(handleRefresh, dashboardConfig.refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [dashboardConfig.refreshInterval, handleRefresh]);

  // Handle tenant loading state
  if (tenantLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <LoadingSpinner size="large" />
      </Box>
    );
  }

  // Handle tenant error state
  if (tenantError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
        >
          Failed to load dashboard: {tenantError.message}
        </Alert>
      </Box>
    );
  }

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <Box
          sx={{
            p: theme.spacing(3),
            minHeight: '100vh',
            backgroundColor: theme.palette.background.default
          }}
        >
          <Grid container spacing={3}>
            {/* Metrics Section */}
            <Grid item xs={12}>
              <Paper
                elevation={1}
                sx={{
                  p: theme.spacing(2),
                  position: 'relative',
                  backgroundColor: theme.palette.background.paper
                }}
              >
                <DashboardMetrics
                  showActivityFeed={dashboardConfig.showActivityFeed}
                  refreshInterval={dashboardConfig.refreshInterval}
                  onError={(error) => {
                    showNotification({
                      message: `Metrics error: ${error.message}`,
                      severity: 'error',
                      duration: 5000
                    });
                  }}
                />
              </Paper>
            </Grid>

            {/* Activity Feed Section */}
            {dashboardConfig.showActivityFeed && (
              <Grid item xs={12}>
                <ActivityFeed
                  limit={10}
                  showHeader
                  autoScroll
                  filterOptions={{
                    types: ['LEAD_CREATED', 'QUOTE_GENERATED', 'DEMO_SCHEDULED'],
                    severity: ['info', 'warning', 'error']
                  }}
                  onActivityReceived={(activity) => {
                    if (activity.severity === 'error') {
                      showNotification({
                        message: activity.description,
                        severity: 'error',
                        duration: 5000
                      });
                    }
                  }}
                />
              </Grid>
            )}
          </Grid>
        </Box>
      </ErrorBoundary>
    </DashboardLayout>
  );
};

// Export with display name for debugging
DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;