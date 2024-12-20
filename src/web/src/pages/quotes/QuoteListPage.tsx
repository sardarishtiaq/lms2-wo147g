import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CircularProgress, Alert } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { debounce } from 'lodash';

// Internal imports
import QuoteList from '../../components/quotes/QuoteList';
import PageHeader from '../../components/common/PageHeader';
import useQuotes from '../../hooks/useQuotes';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { QuoteFilters } from '../../types/quote';

/**
 * Initial filter state for quote list
 */
const initialFilters: QuoteFilters = {
  status: undefined,
  leadId: undefined,
  startDate: undefined,
  endDate: undefined,
  minAmount: undefined,
  maxAmount: undefined
};

/**
 * QuoteListPage Component
 * Displays a list of quotes with filtering, sorting, and search capabilities
 * Implements real-time updates and tenant isolation
 */
const QuoteListPage: React.FC = () => {
  const navigate = useNavigate();
  const { quotes, loading, error, fetchQuotes } = useQuotes();
  
  // Local state
  const [filters, setFilters] = useState<QuoteFilters>(initialFilters);
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * Fetch quotes on component mount and when filters change
   */
  useEffect(() => {
    fetchQuotes({ ...filters, search: searchTerm });
  }, [fetchQuotes, filters, searchTerm]);

  /**
   * Handle navigation to create new quote
   */
  const handleCreateQuote = useCallback(() => {
    navigate('/quotes/new');
  }, [navigate]);

  /**
   * Handle search with debouncing
   */
  const handleSearch = useCallback(
    debounce((term: string) => {
      setSearchTerm(term);
    }, 300),
    []
  );

  /**
   * Handle filter changes
   */
  const handleFilterChange = useCallback((newFilters: QuoteFilters) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      ...newFilters
    }));
  }, []);

  /**
   * Render loading state
   */
  if (loading && !quotes.length) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <CircularProgress />
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ margin: '2rem' }}
        action={
          <Button color="inherit" size="small" onClick={() => fetchQuotes()}>
            Retry
          </Button>
        }
      >
        {error.message || 'Failed to load quotes'}
      </Alert>
    );
  }

  return (
    <ErrorBoundary>
      <PageHeader
        title="Quote Management"
        subtitle={`${quotes.length} quotes found`}
        showSearch
        onSearch={handleSearch}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleCreateQuote}
            aria-label="Create new quote"
          >
            Create Quote
          </Button>
        }
      />

      <QuoteList
        initialFilters={filters}
        onFilterChange={handleFilterChange}
        onQuoteUpdate={() => fetchQuotes()}
      />
    </ErrorBoundary>
  );
};

export default QuoteListPage;