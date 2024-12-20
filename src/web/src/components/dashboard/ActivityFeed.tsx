import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import { formatDistanceToNow } from 'date-fns';
import sanitizeHtml from 'sanitize-html'; // sanitize-html ^2.11.0
import {
  AssignmentInd,
  DataExploration,
  Event,
  Description,
  Notifications,
  Warning,
  Info,
} from '@mui/icons-material';

// Internal imports
import { useWebSocket, WEBSOCKET_EVENTS } from '../../hooks/useWebSocket';
import LoadingSpinner from '../common/LoadingSpinner';
import theme from '../../styles/theme';

// Activity type definitions
export interface Activity {
  id: string;
  type: 'LEAD_CREATED' | 'LEAD_UPDATED' | 'QUOTE_GENERATED' | 'DEMO_SCHEDULED' | 'SYSTEM_EVENT';
  description: string;
  createdAt: string;
  tenantId: string;
  userId: string;
  metadata: Record<string, any>;
  isSystem: boolean;
  severity: 'info' | 'warning' | 'error';
}

// Component props interface
export interface ActivityFeedProps {
  limit?: number;
  showHeader?: boolean;
  className?: string;
  autoScroll?: boolean;
  onActivityReceived?: (activity: Activity) => void;
  filterOptions?: {
    types?: Activity['type'][];
    severity?: Activity['severity'][];
  };
}

// Styled components
const ActivityContainer = styled(Paper)(({ theme }) => ({
  height: '100%',
  maxHeight: '600px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
}));

const ActivityList = styled(List)(({ theme }) => ({
  overflow: 'auto',
  padding: theme.spacing(1),
  flexGrow: 1,
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.grey[300],
    borderRadius: '3px',
  },
}));

const ActivityHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
}));

const ActivityItem = styled(ListItem)<{ severity: Activity['severity'] }>(({ theme, severity }) => ({
  marginBottom: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '& .MuiListItemIcon-root': {
    color: severity === 'error' 
      ? theme.palette.error.main 
      : severity === 'warning'
        ? theme.palette.warning.main
        : theme.palette.primary.main,
  },
}));

// Activity icon mapping
const getActivityIcon = (type: Activity['type'], severity: Activity['severity']) => {
  switch (type) {
    case 'LEAD_CREATED':
      return <AssignmentInd />;
    case 'LEAD_UPDATED':
      return <DataExploration />;
    case 'QUOTE_GENERATED':
      return <Description />;
    case 'DEMO_SCHEDULED':
      return <Event />;
    case 'SYSTEM_EVENT':
      return severity === 'error' 
        ? <Warning /> 
        : severity === 'warning'
          ? <Info />
          : <Notifications />;
    default:
      return <Info />;
  }
};

// Sanitization options
const sanitizeOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'span'],
  allowedAttributes: {
    'span': ['class']
  }
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  limit = 50,
  showHeader = true,
  className,
  autoScroll = true,
  onActivityReceived,
  filterOptions,
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);

  // Initialize WebSocket connection
  const ws = useWebSocket({
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:3000',
    tenantId: localStorage.getItem('tenantId') || '',
    options: {
      reconnection: true,
      auth: {
        token: localStorage.getItem('token') || '',
      },
    },
  });

  // Handle new activity
  const handleNewActivity = useCallback((activity: Activity) => {
    // Sanitize activity description
    const sanitizedActivity = {
      ...activity,
      description: sanitizeHtml(activity.description, sanitizeOptions),
    };

    // Apply filters if specified
    if (filterOptions) {
      const typeMatch = !filterOptions.types?.length || filterOptions.types.includes(activity.type);
      const severityMatch = !filterOptions.severity?.length || filterOptions.severity.includes(activity.severity);
      if (!typeMatch || !severityMatch) return;
    }

    setActivities(prev => {
      const updated = [sanitizedActivity, ...prev].slice(0, limit);
      return updated;
    });

    // Trigger callback if provided
    onActivityReceived?.(sanitizedActivity);
  }, [limit, filterOptions, onActivityReceived]);

  // Auto-scroll handling
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [activities, autoScroll]);

  // WebSocket connection and subscription
  useEffect(() => {
    ws.connect();

    const cleanup = ws.subscribe<Activity>(WEBSOCKET_EVENTS.ACTIVITY_CREATED, handleNewActivity);

    setLoading(false);

    return () => {
      cleanup?.();
      ws.disconnect();
    };
  }, [ws, handleNewActivity]);

  // Error handling
  if (ws.error) {
    return (
      <Box p={2} textAlign="center" color="error.main">
        <Typography variant="body1">
          Error connecting to activity feed: {ws.error.message}
        </Typography>
      </Box>
    );
  }

  return (
    <ActivityContainer className={className}>
      {showHeader && (
        <ActivityHeader>
          <Typography variant="h6" color="primary">
            Activity Feed
          </Typography>
          {ws.reconnecting && (
            <Typography variant="caption" color="text.secondary">
              Reconnecting... (Attempt {ws.connectionAttempts})
            </Typography>
          )}
        </ActivityHeader>
      )}

      {loading ? (
        <Box p={4}>
          <LoadingSpinner size="medium" />
        </Box>
      ) : (
        <ActivityList ref={listRef}>
          {activities.map((activity) => (
            <ActivityItem key={activity.id} severity={activity.severity}>
              <ListItemIcon>
                {getActivityIcon(activity.type, activity.severity)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body1" component="div">
                    <span dangerouslySetInnerHTML={{ __html: activity.description }} />
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </Typography>
                }
              />
            </ActivityItem>
          ))}
        </ActivityList>
      )}
    </ActivityContainer>
  );
};

export default React.memo(ActivityFeed);
```

This implementation provides a robust, real-time activity feed component with the following features:

1. Real-time updates using WebSocket connection with tenant isolation
2. Content sanitization for security
3. Auto-scrolling capability
4. Filtering options for activity types and severity
5. Error handling and reconnection logic
6. Loading states and error states
7. Styled components following Material Design
8. Accessibility support
9. Memory optimization with React.memo
10. Type safety with TypeScript
11. Proper cleanup of WebSocket connections and subscriptions

The component can be used like this:

```typescript
<ActivityFeed
  limit={50}
  showHeader={true}
  autoScroll={true}
  onActivityReceived={(activity) => console.log('New activity:', activity)}
  filterOptions={{
    types: ['LEAD_CREATED', 'QUOTE_GENERATED'],
    severity: ['info', 'warning']
  }}
/>