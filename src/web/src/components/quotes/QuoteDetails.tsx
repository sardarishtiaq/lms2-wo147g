import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Divider, 
  Button, 
  Chip, 
  Skeleton, 
  Alert 
} from '@mui/material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

// Internal imports
import { Quote, QuoteStatus, QuoteItem } from '../../types/quote';
import { useQuotes } from '../../hooks/useQuotes';
import ErrorBoundary from '../common/ErrorBoundary';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/theme';
import { PERMISSIONS } from '../../constants/permissions';

interface QuoteDetailsProps {
  tenantId: string;
}

/**
 * Formats currency values with proper locale support
 * @param value - Numeric value to format
 * @param locale - Locale string for formatting
 * @returns Formatted currency string
 */
const formatCurrency = (value: number, locale = 'en-US'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

/**
 * Enhanced QuoteDetails component with real-time updates and tenant isolation
 * @version 1.0.0
 */
const QuoteDetails: React.FC<QuoteDetailsProps> = ({ tenantId }) => {
  // Hooks
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    getQuoteById, 
    updateQuote, 
    loading: quoteLoading,
    error: quoteError 
  } = useQuotes();

  // Local state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Memoized calculations
  const totals = useMemo(() => {
    if (!quote?.items) return { subtotal: 0, tax: 0, total: 0 };
    
    const subtotal = quote.items.reduce((sum, item) => 
      sum + (item.quantity * item.unitPrice * (1 - item.discountPercent / 100)), 0);
    
    const tax = quote.items.reduce((sum, item) => 
      sum + (item.quantity * item.unitPrice * (item.taxRate / 100)), 0);
    
    return {
      subtotal,
      tax,
      total: subtotal + tax
    };
  }, [quote?.items]);

  // Load quote data
  useEffect(() => {
    if (id && tenantId) {
      const quoteData = getQuoteById(id);
      if (quoteData?.tenantId === tenantId) {
        setQuote(quoteData);
      }
    }
  }, [id, tenantId, getQuoteById]);

  /**
   * Handles quote status updates with optimistic UI
   */
  const handleStatusChange = useCallback(async (newStatus: QuoteStatus) => {
    if (!quote || !id) return;

    setIsUpdating(true);
    try {
      // Optimistic update
      setQuote(prev => prev ? { ...prev, status: newStatus } : null);

      await updateQuote(id, { status: newStatus });
    } catch (error) {
      // Revert on error
      setQuote(prev => prev ? { ...prev, status: quote.status } : null);
      console.error('Failed to update quote status:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [quote, id, updateQuote]);

  /**
   * Handles quote printing with accessibility
   */
  const handlePrint = useCallback(() => {
    if (!quote) return;
    window.print();
  }, [quote]);

  if (quoteLoading) {
    return (
      <Box sx={{ p: SPACING.sizes.md }}>
        <Skeleton variant="rectangular" height={200} />
        <Skeleton variant="text" sx={{ mt: 2 }} />
        <Skeleton variant="text" />
        <Skeleton variant="text" />
      </Box>
    );
  }

  if (quoteError) {
    return (
      <Alert 
        severity="error"
        sx={{ m: SPACING.sizes.md }}
        aria-live="polite"
      >
        Failed to load quote details. Please try again.
      </Alert>
    );
  }

  if (!quote) {
    return (
      <Alert 
        severity="warning"
        sx={{ m: SPACING.sizes.md }}
        aria-live="polite"
      >
        Quote not found or access denied.
      </Alert>
    );
  }

  return (
    <ErrorBoundary>
      <Box 
        sx={{ 
          p: SPACING.sizes.md,
          maxWidth: '1200px',
          margin: '0 auto'
        }}
      >
        {/* Header Section */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: SPACING.sizes.md 
          }}
        >
          <Typography 
            variant="h4" 
            component="h1"
            sx={{ 
              fontFamily: TYPOGRAPHY.fontFamily,
              fontWeight: TYPOGRAPHY.fontWeight.medium 
            }}
          >
            Quote #{quote.quoteNumber}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: SPACING.sizes.sm }}>
            <Chip 
              label={quote.status}
              color={quote.status === QuoteStatus.APPROVED ? 'success' : 'default'}
              aria-label={`Quote status: ${quote.status}`}
            />
            <Button
              variant="outlined"
              onClick={handlePrint}
              disabled={isUpdating}
              aria-label="Print quote"
            >
              Print
            </Button>
          </Box>
        </Box>

        {/* Quote Details Card */}
        <Card sx={{ mb: SPACING.sizes.md }}>
          <CardContent>
            {/* Items Section */}
            <Typography variant="h6" gutterBottom>
              Items
            </Typography>
            <Box sx={{ mb: SPACING.sizes.md }}>
              {quote.items.map((item: QuoteItem) => (
                <Box 
                  key={item.id}
                  sx={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: SPACING.sizes.sm 
                  }}
                >
                  <Box>
                    <Typography>{item.description}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </Typography>
                  </Box>
                  <Typography>
                    {formatCurrency(item.amount)}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: SPACING.sizes.md }} />

            {/* Totals Section */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>Subtotal</Typography>
                <Typography>{formatCurrency(totals.subtotal)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>Tax</Typography>
                <Typography>{formatCurrency(totals.tax)}</Typography>
              </Box>
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontWeight: TYPOGRAPHY.fontWeight.bold 
                }}
              >
                <Typography>Total</Typography>
                <Typography>{formatCurrency(totals.total)}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Actions Section */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end',
            gap: SPACING.sizes.sm 
          }}
        >
          <Button
            variant="outlined"
            onClick={() => navigate(-1)}
            disabled={isUpdating}
          >
            Back
          </Button>
          {quote.status === QuoteStatus.PENDING_APPROVAL && (
            <>
              <Button
                variant="contained"
                color="success"
                onClick={() => handleStatusChange(QuoteStatus.APPROVED)}
                disabled={isUpdating}
              >
                Approve
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => handleStatusChange(QuoteStatus.REJECTED)}
                disabled={isUpdating}
              >
                Reject
              </Button>
            </>
          )}
        </Box>
      </Box>
    </ErrorBoundary>
  );
};

export default QuoteDetails;