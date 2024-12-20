import React, { useCallback, useState } from 'react';
import { Container, CircularProgress, Alert } from '@mui/material'; // ^5.0.0
import { useNavigate } from 'react-router-dom'; // ^6.0.0

import QuoteForm from '../../components/quotes/QuoteForm';
import PageHeader from '../../components/common/PageHeader';
import useQuotes from '../../hooks/useQuotes';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { Quote } from '../../types/quote';

/**
 * Props interface for NewQuotePage component
 */
interface NewQuotePageProps {
  /** Optional lead ID if quote is being created from lead context */
  leadId?: string;
  /** Tenant ID for proper isolation */
  tenantId: string;
}

/**
 * NewQuotePage component for creating new quotes in the CRM system
 * Implements comprehensive quote creation with validation and tenant isolation
 * 
 * @component
 */
const NewQuotePage: React.FC<NewQuotePageProps> = ({ leadId, tenantId }) => {
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const navigate = useNavigate();
  const { createQuote } = useQuotes();

  /**
   * Handles quote form submission with proper validation and error handling
   */
  const handleQuoteSubmit = useCallback(async (quoteData: Quote) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Ensure tenant context
      const quoteWithTenant = {
        ...quoteData,
        tenantId,
        leadId: leadId || quoteData.leadId,
      };

      // Create quote
      await createQuote(quoteWithTenant);

      // Navigate to quotes list on success
      navigate('/quotes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quote');
      console.error('Quote creation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [createQuote, navigate, tenantId, leadId]);

  /**
   * Handles cancellation of quote creation
   */
  const handleCancel = useCallback(() => {
    navigate('/quotes');
  }, [navigate]);

  return (
    <ErrorBoundary tenantId={tenantId}>
      <Container maxWidth="lg">
        <PageHeader
          title="Create New Quote"
          actions={null}
        />

        {isSubmitting && (
          <CircularProgress
            size={24}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: '-12px',
              marginLeft: '-12px'
            }}
          />
        )}

        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <QuoteForm
          leadId={leadId || ''}
          tenantId={tenantId}
          onSubmitSuccess={handleQuoteSubmit}
          onCancel={handleCancel}
          tenantConfig={{
            taxRate: 10, // This should come from tenant settings
            roundingPrecision: 2,
            currency: 'USD',
            minQuoteAmount: 0,
            maxQuoteAmount: 1000000
          }}
        />
      </Container>
    </ErrorBoundary>
  );
};

export default NewQuotePage;