import React, { useEffect, useMemo, useCallback } from 'react';
import { 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Divider, 
  useTheme, 
  Box 
} from '@mui/material';
import { 
  TrendingUp, 
  TrendingDown, 
  Error as ErrorIcon 
} from '@mui/icons-material';

// Internal imports
import { Quote, QuoteStatus } from '../../types/quote';
import { useQuotes } from '../../hooks/useQuotes';
import { LoadingSpinner } from '../common/LoadingSpinner';

// Interface definitions
interface QuoteMetricsProps {
  timeRange: string;
  className?: string;
  onError?: (error: Error) => void;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  trend: number;
  color?: string;
  loading?: boolean;
  error?: Error | null;
}

interface QuoteMetrics {
  totalQuotes: number;
  totalValue: number;
  approvalRate: number;
  averageValue: number;
  trends: {
    quotesChange: number;
    valueChange: number;
    approvalChange: number;
    averageChange: number;
  };
}

// Helper function to format currency
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// Helper function to format percentage
const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

// Internal MetricCard component
const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  color,
  loading,
  error
}) => {
  const theme = useTheme();

  const renderTrendIndicator = useCallback(() => {
    if (trend === 0) return null;
    
    const TrendIcon = trend > 0 ? TrendingUp : TrendingDown;
    const trendColor = trend > 0 ? theme.palette.success.main : theme.palette.error.main;
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', color: trendColor }}>
        <TrendIcon sx={{ mr: 0.5 }} />
        <Typography variant="body2">
          {Math.abs(trend * 100).toFixed(1)}%
        </Typography>
      </Box>
    );
  }, [trend, theme]);

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ minHeight: 120, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <LoadingSpinner size="small" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent sx={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <ErrorIcon color="error" sx={{ mb: 1 }} />
          <Typography variant="body2" color="error">
            Failed to load metric
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" color={color || 'textPrimary'} sx={{ my: 2 }}>
          {value}
        </Typography>
        <Divider sx={{ my: 1 }} />
        {renderTrendIndicator()}
      </CardContent>
    </Card>
  );
};

// Main QuoteMetrics component
export const QuoteMetrics: React.FC<QuoteMetricsProps> = ({
  timeRange,
  className,
  onError
}) => {
  const theme = useTheme();
  const { quotes, loading, error } = useQuotes();

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const calculateMetrics = useCallback((currentQuotes: Quote[]): QuoteMetrics => {
    // Filter quotes based on time range
    const now = new Date();
    const timeRangeMs = timeRange === 'week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(now.getTime() - timeRangeMs);

    const recentQuotes = currentQuotes.filter(quote => 
      new Date(quote.createdAt) >= cutoffDate
    );

    const previousQuotes = currentQuotes.filter(quote => 
      new Date(quote.createdAt) >= new Date(cutoffDate.getTime() - timeRangeMs) &&
      new Date(quote.createdAt) < cutoffDate
    );

    // Calculate current period metrics
    const totalQuotes = recentQuotes.length;
    const totalValue = recentQuotes.reduce((sum, quote) => sum + quote.total, 0);
    const approvedQuotes = recentQuotes.filter(quote => quote.status === QuoteStatus.APPROVED);
    const approvalRate = totalQuotes > 0 ? approvedQuotes.length / totalQuotes : 0;
    const averageValue = totalQuotes > 0 ? totalValue / totalQuotes : 0;

    // Calculate previous period metrics for trends
    const prevTotalQuotes = previousQuotes.length;
    const prevTotalValue = previousQuotes.reduce((sum, quote) => sum + quote.total, 0);
    const prevApprovedQuotes = previousQuotes.filter(quote => quote.status === QuoteStatus.APPROVED);
    const prevApprovalRate = prevTotalQuotes > 0 ? prevApprovedQuotes.length / prevTotalQuotes : 0;
    const prevAverageValue = prevTotalQuotes > 0 ? prevTotalValue / prevTotalQuotes : 0;

    // Calculate trends
    const calculateTrend = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return (current - previous) / previous;
    };

    return {
      totalQuotes,
      totalValue,
      approvalRate,
      averageValue,
      trends: {
        quotesChange: calculateTrend(totalQuotes, prevTotalQuotes),
        valueChange: calculateTrend(totalValue, prevTotalValue),
        approvalChange: calculateTrend(approvalRate, prevApprovalRate),
        averageChange: calculateTrend(averageValue, prevAverageValue)
      }
    };
  }, [timeRange]);

  const metrics = useMemo(() => {
    if (!quotes || quotes.length === 0) return null;
    return calculateMetrics(quotes);
  }, [quotes, calculateMetrics]);

  return (
    <Grid container spacing={3} className={className}>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Total Quotes"
          value={metrics?.totalQuotes || 0}
          trend={metrics?.trends.quotesChange || 0}
          loading={loading}
          error={error}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Total Value"
          value={formatCurrency(metrics?.totalValue || 0)}
          trend={metrics?.trends.valueChange || 0}
          color={theme.palette.primary.main}
          loading={loading}
          error={error}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Approval Rate"
          value={formatPercentage(metrics?.approvalRate || 0)}
          trend={metrics?.trends.approvalChange || 0}
          color={theme.palette.success.main}
          loading={loading}
          error={error}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Average Value"
          value={formatCurrency(metrics?.averageValue || 0)}
          trend={metrics?.trends.averageChange || 0}
          color={theme.palette.secondary.main}
          loading={loading}
          error={error}
        />
      </Grid>
    </Grid>
  );
};

export default QuoteMetrics;