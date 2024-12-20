import React, { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Alert, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';

// Internal imports
import LeadBoard from '../../components/leads/LeadBoard';
import LeadFilters from '../../components/leads/LeadFilters';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useLeads } from '../../hooks/useLeads';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Lead, LeadFilters as ILeadFilters } from '../../types/lead';
import { LeadCategory } from '../../constants/leadCategories';

// Styled components
const PageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  padding: theme.spacing(2),
  gap: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  overflow: 'hidden'
}));

const FiltersContainer = styled(Box)(({ theme }) => ({
  flexShrink: 0,
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1]
}));

const BoardContainer = styled(Box)({
  flexGrow: 1,
  overflow: 'hidden',
  position: 'relative',
  minHeight: 0 // Required for proper scrolling
});

/**
 * LeadListPage Component - Main page for lead management with Kanban board
 * Implements real-time updates, filtering, and comprehensive error handling
 */
const LeadListPage: React.FC = () => {
  // State management
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [filters, setFilters] = useState<ILeadFilters>({
    category: [],
    assignedTo: [],
    status: [],
    priority: [],
    dateRange: { start: '', end: '' },
    score: { min: 0, max: 100 },
    source: []
  });

  // Hooks
  const {
    leads,
    loading,
    error,
    fetchLeads,
    updateLeadCategory,
    retryOperation
  } = useLeads();

  const {
    subscribe,
    connected: wsConnected,
    error: wsError
  } = useWebSocket();

  // Handle real-time lead updates
  useEffect(() => {
    if (!wsConnected) return;

    const handleLeadUpdate = (updatedLead: Lead) => {
      fetchLeads(filters);
    };

    const unsubscribe = subscribe('lead:updated', handleLeadUpdate);
    return () => {
      unsubscribe?.();
    };
  }, [wsConnected, subscribe, fetchLeads, filters]);

  // Initial data fetch
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await fetchLeads(filters);
      } finally {
        setIsInitialLoad(false);
      }
    };

    loadInitialData();
  }, [fetchLeads]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: ILeadFilters) => {
    setFilters(newFilters);
    fetchLeads(newFilters);
  }, [fetchLeads]);

  // Handle category updates with optimistic updates
  const handleCategoryChange = useCallback(async (
    leadId: string,
    category: LeadCategory
  ) => {
    try {
      await updateLeadCategory(leadId, category);
    } catch (error) {
      // Error will be handled by the useLeads hook
      console.error('Failed to update lead category:', error);
    }
  }, [updateLeadCategory]);

  // Render loading state
  if (isInitialLoad) {
    return (
      <PageContainer>
        <FiltersContainer>
          <Skeleton variant="rectangular" height={80} />
        </FiltersContainer>
        <BoardContainer>
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
          </Box>
        </BoardContainer>
      </PageContainer>
    );
  }

  // Render error state
  if (error || wsError) {
    return (
      <PageContainer>
        <Alert 
          severity="error" 
          action={
            error ? (
              <button onClick={() => retryOperation(() => fetchLeads(filters))}>
                Retry
              </button>
            ) : undefined
          }
        >
          {error?.message || wsError?.message || 'An error occurred'}
        </Alert>
      </PageContainer>
    );
  }

  return (
    <ErrorBoundary>
      <PageContainer role="main" aria-label="Lead Management">
        <FiltersContainer>
          <LeadFilters
            initialFilters={filters}
            onFilterChange={handleFilterChange}
            disabled={loading}
          />
        </FiltersContainer>

        <BoardContainer>
          <LeadBoard
            leads={leads}
            onCategoryChange={handleCategoryChange}
            isLoading={loading}
            error={error?.message || null}
          />
        </BoardContainer>
      </PageContainer>
    </ErrorBoundary>
  );
};

// Add display name for debugging
LeadListPage.displayName = 'LeadListPage';

export default LeadListPage;