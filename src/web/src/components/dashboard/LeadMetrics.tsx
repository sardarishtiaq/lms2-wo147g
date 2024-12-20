import React, { useMemo } from 'react';
import { Grid, Card, CardContent, Typography, Icon, Box, Skeleton, useTheme } from '@mui/material';
import { useLeads } from '../../hooks/useLeads';
import { Lead } from '../../types/lead';
import { CATEGORY_DETAILS } from '../../constants/leadCategories';

/**
 * Interface for lead metrics component props
 */
interface LeadMetricsProps {
  tenantId: string;
}

/**
 * Interface for category metrics data
 */
interface CategoryMetrics {
  count: number;
  percentage: number;
  trend: number;
}

/**
 * LeadMetrics Component - Displays comprehensive lead metrics across the 12-stage pipeline
 * with real-time updates and enhanced accessibility features
 */
const LeadMetrics: React.FC<LeadMetricsProps> = ({ tenantId }) => {
  const theme = useTheme();
  const { leads, loading, error } = useLeads(tenantId);

  /**
   * Calculate metrics for each lead category with memoization
   */
  const categoryMetrics = useMemo(() => {
    if (!leads?.length) return {};

    const metrics: Record<string, CategoryMetrics> = {};
    const totalLeads = leads.length;

    // Initialize metrics for all categories
    CATEGORY_DETAILS.forEach(category => {
      metrics[category.id] = {
        count: 0,
        percentage: 0,
        trend: 0
      };
    });

    // Calculate current counts and percentages
    leads.forEach(lead => {
      if (lead.category && metrics[lead.category]) {
        metrics[lead.category].count++;
      }
    });

    // Calculate percentages and trends
    Object.keys(metrics).forEach(category => {
      metrics[category].percentage = (metrics[category].count / totalLeads) * 100;
      // Trend calculation would typically compare with historical data
      metrics[category].trend = Math.random() * 10 - 5; // Placeholder trend calculation
    });

    return metrics;
  }, [leads]);

  /**
   * Calculate conversion rates between pipeline stages
   */
  const conversionRates = useMemo(() => {
    const rates: Record<string, number> = {};
    
    if (!categoryMetrics) return rates;

    // Calculate conversion rates between consecutive stages
    for (let i = 1; i < CATEGORY_DETAILS.length; i++) {
      const currentCategory = CATEGORY_DETAILS[i];
      const previousCategory = CATEGORY_DETAILS[i - 1];
      
      const currentCount = categoryMetrics[currentCategory.id]?.count || 0;
      const previousCount = categoryMetrics[previousCategory.id]?.count || 1;
      
      rates[currentCategory.id] = (currentCount / previousCount) * 100;
    }

    return rates;
  }, [categoryMetrics]);

  /**
   * Renders a metric card for a category with accessibility support
   */
  const renderCategoryCard = (category: typeof CATEGORY_DETAILS[0]) => {
    const metrics = categoryMetrics[category.id] || { count: 0, percentage: 0, trend: 0 };
    const conversionRate = conversionRates[category.id];

    return (
      <Card
        key={category.id}
        sx={{
          height: '100%',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)'
          }
        }}
        aria-label={`${category.name} metrics`}
      >
        <CardContent>
          {loading ? (
            <Box>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="80%" />
            </Box>
          ) : (
            <>
              <Box display="flex" alignItems="center" mb={2}>
                <Icon
                  sx={{
                    mr: 1,
                    color: theme.palette.primary.main
                  }}
                  aria-hidden="true"
                >
                  {category.icon}
                </Icon>
                <Typography
                  variant="h6"
                  component="h2"
                  sx={{ fontWeight: 'medium' }}
                >
                  {category.name}
                </Typography>
              </Box>

              <Typography
                variant="h4"
                component="p"
                sx={{ mb: 1 }}
                aria-label={`${metrics.count} leads`}
              >
                {metrics.count}
              </Typography>

              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography
                  variant="body2"
                  color="textSecondary"
                  aria-label={`${metrics.percentage.toFixed(1)}% of total leads`}
                >
                  {metrics.percentage.toFixed(1)}%
                </Typography>

                {conversionRate && (
                  <Box
                    display="flex"
                    alignItems="center"
                    sx={{
                      color: conversionRate > 50 ? 'success.main' : 'warning.main'
                    }}
                    aria-label={`Conversion rate: ${conversionRate.toFixed(1)}%`}
                  >
                    <Icon fontSize="small" sx={{ mr: 0.5 }}>
                      {conversionRate > 50 ? 'trending_up' : 'trending_down'}
                    </Icon>
                    <Typography variant="body2">
                      {conversionRate.toFixed(1)}%
                    </Typography>
                  </Box>
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  if (error) {
    return (
      <Typography color="error" role="alert">
        Error loading lead metrics: {error.message}
      </Typography>
    );
  }

  return (
    <Box sx={{ p: 2 }} role="region" aria-label="Lead metrics dashboard">
      <Grid container spacing={3}>
        {CATEGORY_DETAILS.map(category => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={category.id}>
            {renderCategoryCard(category)}
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default LeadMetrics;