import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Grid, Paper, Box, Typography, useTheme } from '@mui/material';
import { debounce } from 'lodash';

// Internal imports
import { LeadMetrics } from './LeadMetrics';
import { QuoteMetrics } from './QuoteMetrics';
import { ActivityFeed } from './ActivityFeed';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useWebSocket } from '../../hooks/useWebSocket';

// Interface definitions
interface DashboardMetricsProps {
  className?: string;
  showActivityFeed?: boolean;
  refreshInterval?: number;
  onError?: (error: Error) => void;
}

/**
 * DashboardMetrics Component
 * 
 * Main dashboard container that aggregates and displays key business metrics
 * including lead statistics, quote performance, and recent activities.
 * Implements real-time updates and tenant isolation.
 */
export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  className,
  showActivityFeed = true,
  refreshInterval = 30000, // 30 seconds default refresh
  onError
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [error, setError] = useState<Error | null>(null);

  // Initialize WebSocket connection for real-time updates
  const ws = useWebSocket({
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:3000',
    tenantId: localStorage.getItem('tenantId') || '',
    options: {
      reconnection: true,
      auth: {
        token: localStorage.getItem('token') || ''
      }
    }
  });

  // Handle refresh of all metrics
  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Trigger refresh of child components
      await Promise.all([
        document.dispatchEvent(new CustomEvent('refreshLeadMetrics')),
        document.dispatchEvent(new CustomEvent('refreshQuoteMetrics')),
        showActivityFeed && document.dispatchEvent(new CustomEvent('refreshActivityFeed'))
      ]);

      setLastRefresh(new Date());
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh metrics');
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [showActivityFeed, onError]);

  // Debounced refresh function to prevent excessive updates
  const debouncedRefresh = useMemo(
    () => debounce(handleRefresh, 1000),
    [handleRefresh]
  );

  // Set up automatic refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const intervalId = setInterval(debouncedRefresh, refreshInterval);
      return () => {
        clearInterval(intervalId);
        debouncedRefresh.cancel();
      };
    }
  }, [refreshInterval, debouncedRefresh]);

  // Subscribe to WebSocket events for real-time updates
  useEffect(() => {
    if (!ws.connected) {
      ws.connect();
    }

    const unsubscribeLeads = ws.subscribe('lead:updated', debouncedRefresh);
    const unsubscribeQuotes = ws.subscribe('quote:updated', debouncedRefresh);

    return () => {
      unsubscribeLeads?.();
      unsubscribeQuotes?.();
      ws.disconnect();
    };
  }, [ws, debouncedRefresh]);

  // Render WebSocket connection status indicator
  const renderConnectionStatus = () => {
    if (ws.error) {
      return (
        <Typography variant="caption" color="error" sx={{ ml: 2 }}>
          Connection Error: {ws.error.message}
        </Typography>
      );
    }
    if (ws.reconnecting) {
      return (
        <Typography variant="caption" color="warning.main" sx={{ ml: 2 }}>
          Reconnecting... (Attempt {ws.connectionAttempts})
        </Typography>
      );
    }
    return null;
  };

  return (
    <Box
      className={className}
      sx={{
        p: theme.spacing(3),
        height: '100%',
        overflow: 'auto'
      }}
    >
      <Grid container spacing={3}>
        {/* Lead Metrics Section */}
        <Grid item xs={12} md={showActivityFeed ? 8 : 12}>
          <Paper
            elevation={1}
            sx={{
              p: theme.spacing(2),
              height: '100%',
              position: 'relative'
            }}
          >
            <Box display="flex" alignItems="center" mb={2}>
              <Typography variant="h6" color="primary">
                Lead Performance
              </Typography>
              {renderConnectionStatus()}
            </Box>
            <LeadMetrics tenantId={localStorage.getItem('tenantId') || ''} />
          </Paper>
        </Grid>

        {/* Quote Metrics Section */}
        <Grid item xs={12} md={showActivityFeed ? 4 : 12}>
          <Paper
            elevation={1}
            sx={{
              p: theme.spacing(2),
              height: '100%',
              position: 'relative'
            }}
          >
            <Typography variant="h6" color="primary" gutterBottom>
              Quote Analytics
            </Typography>
            <QuoteMetrics timeRange="week" />
          </Paper>
        </Grid>

        {/* Activity Feed Section */}
        {showActivityFeed && (
          <Grid item xs={12}>
            <ActivityFeed
              limit={10}
              showHeader
              autoScroll
              filterOptions={{
                types: ['LEAD_CREATED', 'QUOTE_GENERATED', 'DEMO_SCHEDULED'],
                severity: ['info', 'warning', 'error']
              }}
            />
          </Grid>
        )}
      </Grid>

      {/* Loading Overlay */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: theme.zIndex.modal + 1
          }}
        >
          <LoadingSpinner size="large" />
        </Box>
      )}

      {/* Error Display */}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            bottom: theme.spacing(2),
            left: theme.spacing(2),
            right: theme.spacing(2),
            zIndex: theme.zIndex.modal + 2
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: theme.spacing(2),
              backgroundColor: theme.palette.error.light,
              color: theme.palette.error.contrastText
            }}
          >
            <Typography variant="body2">
              Error refreshing metrics: {error.message}
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default DashboardMetrics;
```

This implementation provides a comprehensive dashboard metrics container with the following features:

1. Real-time updates using WebSocket integration
2. Tenant isolation through configuration
3. Automatic refresh mechanism with debouncing
4. Loading states and error handling
5. Responsive layout with Grid system
6. Activity feed integration (optional)
7. Connection status indicators
8. Clean error presentation
9. Performance optimizations with useMemo and useCallback
10. Proper cleanup of intervals and subscriptions
11. Type safety with TypeScript
12. Material-UI theming and styling

The component can be used in the application like this:

```typescript
<DashboardMetrics
  showActivityFeed={true}
  refreshInterval={30000}
  onError={(error) => console.error('Dashboard error:', error)}
/>