/**
 * @fileoverview Quote details page component with real-time updates and tenant isolation
 * Implements comprehensive quote management capabilities for the CRM system
 * @version 1.0.0
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Alert } from '@mui/material';

// Internal imports
import DashboardLayout from '../../layouts/DashboardLayout';
import QuoteDetails from '../../components/quotes/QuoteDetails';
import { useQuotes } from '../../hooks/useQuotes';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { useNotification } from '../../hooks/useNotification';
import { Quote, QuoteStatus } from '../../types/quote';
import { PERMISSIONS } from '../../constants/permissions';
import { ROUTES } from '../../constants/routes';

/**
 * Quote details page component with real-time updates and tenant isolation
 * @returns {JSX.Element} Rendered quote details page
 */
const QuoteDetailsPage: React.FC = () => {
  // Hooks
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, tenantId } = useAuth();
  const { tenant } = useTenant();
  const { showNotification } = useNotification();
  const { 
    getQuoteById, 
    updateQuote, 
    loading, 
    error,
    isOptimisticUpdate 
  } = useQuotes();

  // Local state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load quote data with tenant validation
  useEffect(() => {
    if (!id || !tenantId) return;

    try {
      const quoteData = getQuoteById(id);
      if (quoteData?.tenantId === tenantId) {
        setQuote(quoteData);
      } else {
        showNotification({
          message: 'Quote not found or access denied',
          severity: 'error'
        });
        navigate(ROUTES.QUOTES.LIST);
      }
    } catch (error) {
      showNotification({
        message: 'Failed to load quote details',
        severity: 'error'
      });
    }
  }, [id, tenantId, getQuoteById, showNotification, navigate]);

  /**
   * Handles quote status changes with optimistic updates
   */
  const handleStatusChange = useCallback(async (newStatus: QuoteStatus) => {
    if (!quote || !id || isUpdating) return;

    setIsUpdating(true);
    try {
      // Optimistic update
      const updatedQuote = { ...quote, status: newStatus };
      setQuote(updatedQuote);

      await updateQuote(id, { status: newStatus });

      showNotification({
        message: 'Quote status updated successfully',
        severity: 'success'
      });
    } catch (error) {
      // Revert on error
      setQuote(quote);
      showNotification({
        message: 'Failed to update quote status',
        severity: 'error'
      });
    } finally {
      setIsUpdating(false);
    }
  }, [quote, id, isUpdating, updateQuote, showNotification]);

  /**
   * Handles real-time quote updates
   */
  const handleRealTimeUpdate = useCallback((updatedQuote: Quote) => {
    if (updatedQuote.id === quote?.id && !isOptimisticUpdate(updatedQuote.id)) {
      setQuote(updatedQuote);
      showNotification({
        message: 'Quote details updated',
        severity: 'info'
      });
    }
  }, [quote, isOptimisticUpdate, showNotification]);

  // Render loading state
  if (loading) {
    return (
      <DashboardLayout>
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '400px' 
          }}
        >
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  // Render error state
  if (error) {
    return (
      <DashboardLayout>
        <Box sx={{ margin: '16px', padding: '16px' }}>
          <Alert 
            severity="error"
            action={
              <Button color="inherit" onClick={() => navigate(ROUTES.QUOTES.LIST)}>
                Return to Quotes
              </Button>
            }
          >
            {error}
          </Alert>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ErrorBoundary>
        {quote ? (
          <QuoteDetails
            quote={quote}
            handleStatusChange={handleStatusChange}
            onRealTimeUpdate={handleRealTimeUpdate}
          />
        ) : (
          <Box sx={{ margin: '16px', padding: '16px' }}>
            <Alert 
              severity="warning"
              action={
                <Button color="inherit" onClick={() => navigate(ROUTES.QUOTES.LIST)}>
                  Return to Quotes
                </Button>
              }
            >
              Quote not found or access denied
            </Alert>
          </Box>
        )}
      </ErrorBoundary>
    </DashboardLayout>
  );
};

export default QuoteDetailsPage;