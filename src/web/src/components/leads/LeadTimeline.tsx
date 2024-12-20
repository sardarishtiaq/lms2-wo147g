import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { 
  Timeline, 
  TimelineItem, 
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot 
} from '@mui/lab';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Lead } from '../../types/lead';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';

// Activity type enumeration for strict typing
export enum ActivityType {
  STATUS_CHANGE = 'STATUS_CHANGE',
  CATEGORY_UPDATE = 'CATEGORY_UPDATE',
  NOTE_ADDED = 'NOTE_ADDED',
  ASSIGNMENT = 'ASSIGNMENT',
  QUOTE_GENERATED = 'QUOTE_GENERATED',
  DEMO_SCHEDULED = 'DEMO_SCHEDULED',
  EMAIL_SENT = 'EMAIL_SENT',
  CALL_LOGGED = 'CALL_LOGGED',
  CUSTOM = 'CUSTOM'
}

// Interface for activity data structure
export interface LeadActivity {
  id: string;
  type: ActivityType;
  description: string;
  timestamp: string;
  userId: string;
  userName: string;
  metadata: Record<string, any>;
  isImportant: boolean;
  category?: string;
  tags: string[];
}

// Props interface with comprehensive configuration options
interface LeadTimelineProps {
  leadId: string;
  loading?: boolean;
  activities: LeadActivity[];
  enableRealtime?: boolean;
  updateInterval?: number;
  onActivityClick?: (activity: LeadActivity) => void;
  virtualization?: {
    enabled: boolean;
    itemSize: number;
    overscan: number;
  };
}

// Activity icon color mapping based on type
const activityColorMap: Record<ActivityType, string> = {
  [ActivityType.STATUS_CHANGE]: COLORS.primary,
  [ActivityType.CATEGORY_UPDATE]: COLORS.secondary,
  [ActivityType.NOTE_ADDED]: COLORS.text.secondary,
  [ActivityType.ASSIGNMENT]: COLORS.warning,
  [ActivityType.QUOTE_GENERATED]: COLORS.primary,
  [ActivityType.DEMO_SCHEDULED]: COLORS.secondary,
  [ActivityType.EMAIL_SENT]: COLORS.text.primary,
  [ActivityType.CALL_LOGGED]: COLORS.warning,
  [ActivityType.CUSTOM]: COLORS.text.secondary,
};

/**
 * LeadTimeline Component
 * 
 * Displays a chronological timeline of lead activities with real-time updates
 * and virtualization support for optimal performance with large datasets.
 */
export const LeadTimeline: React.FC<LeadTimelineProps> = React.memo(({
  leadId,
  loading = false,
  activities = [],
  enableRealtime = true,
  updateInterval = 30000,
  onActivityClick,
  virtualization = { enabled: true, itemSize: 72, overscan: 5 }
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // Virtual list configuration for performance optimization
  const rowVirtualizer = useVirtualizer({
    count: activities.length,
    getScrollElement: () => containerRef.current,
    estimateSize: useCallback(() => virtualization.itemSize, [virtualization.itemSize]),
    overscan: virtualization.overscan,
    enabled: virtualization.enabled && activities.length > 50
  });

  // Format timestamp with localization support
  const formatTimestamp = useCallback((timestamp: string): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }, []);

  // Real-time updates effect
  useEffect(() => {
    if (!enableRealtime) return;

    const intervalId = setInterval(() => {
      // Implement real-time update logic here
    }, updateInterval);

    return () => clearInterval(intervalId);
  }, [enableRealtime, updateInterval, leadId]);

  // Render timeline item with proper styling and interaction
  const renderTimelineItem = useCallback((activity: LeadActivity, index: number) => {
    const color = activityColorMap[activity.type] || COLORS.text.secondary;

    return (
      <TimelineItem 
        key={activity.id}
        sx={{ 
          minHeight: virtualization.itemSize,
          '&:before': { flex: 0 }
        }}
        onClick={() => onActivityClick?.(activity)}
      >
        <TimelineSeparator>
          <TimelineDot 
            sx={{ 
              bgcolor: color,
              cursor: onActivityClick ? 'pointer' : 'default'
            }}
          />
          {index < activities.length - 1 && <TimelineConnector />}
        </TimelineSeparator>
        <TimelineContent>
          <Typography 
            variant="body1" 
            sx={{ 
              fontWeight: activity.isImportant ? TYPOGRAPHY.fontWeight.medium : TYPOGRAPHY.fontWeight.regular 
            }}
          >
            {activity.description}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {formatTimestamp(activity.timestamp)} • {activity.userName}
          </Typography>
          {activity.tags.length > 0 && (
            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
              {activity.tags.map(tag => (
                <Typography
                  key={tag}
                  variant="caption"
                  sx={{
                    bgcolor: 'rgba(0, 0, 0, 0.08)',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1
                  }}
                >
                  {tag}
                </Typography>
              ))}
            </Box>
          )}
        </TimelineContent>
      </TimelineItem>
    );
  }, [onActivityClick, formatTimestamp, virtualization.itemSize]);

  // Loading state
  if (loading) {
    return <LoadingSpinner size="medium" />;
  }

  // Empty state
  if (!activities.length) {
    return (
      <EmptyState
        title="No Activities Yet"
        subtitle="Activities will appear here as they occur"
        icon={() => <TimelineDot />}
      />
    );
  }

  // Render timeline with virtualization support
  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        overflowY: 'auto',
        px: 2
      }}
    >
      <Timeline
        sx={{
          p: 0,
          height: rowVirtualizer.getTotalSize(),
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => (
          <Box
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            {renderTimelineItem(activities[virtualRow.index], virtualRow.index)}
          </Box>
        ))}
      </Timeline>
    </Box>
  );
});

LeadTimeline.displayName = 'LeadTimeline';

export default LeadTimeline;