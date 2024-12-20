/**
 * @fileoverview Advanced custom React hook for managing quote-related operations in the CRM system
 * Implements comprehensive quote management with tenant isolation, real-time updates, and error handling
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import { debounce } from 'lodash'; // ^4.17.21

import { 
  Quote, 
  QuoteStatus, 
  QuoteFormData, 
  QuoteValidationError 
} from '../types/quote';
import { 
  fetchQuotes as fetchQuotesThunk,
  createQuote as createQuoteThunk,
  updateQuote as updateQuoteThunk,
  deleteQuote as deleteQuoteThunk,
  selectQuotesByTenant,
  selectQuoteById,
  selectQuoteLoadingState,
  selectQuoteError
} from '../store/slices/quoteSlice';
import useNotification from './useNotification';

// Constants
const DEBOUNCE_DELAY = 300;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Interface for quote operation error details
 */
interface QuoteError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Interface for quote hook state
 */
interface QuoteState {
  loading: boolean;
  error: QuoteError | null;
  optimisticUpdates: Map<string, Quote>;
  retryCount: number;
}

/**
 * Advanced custom hook for quote management with tenant isolation
 * @returns Quote management functions and state
 */
export const useQuotes = () => {
  const dispatch = useDispatch();
  const notification = useNotification();
  
  // Local state
  const [state, setState] = useState<QuoteState>({
    loading: false,
    error: null,
    optimisticUpdates: new Map(),
    retryCount: 0
  });

  // Refs for cleanup and tracking
  const abortControllerRef = useRef<AbortController>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // Selectors
  const quotes = useSelector(selectQuotesByTenant);
  const globalLoading = useSelector(selectQuoteLoadingState);
  const globalError = useSelector(selectQuoteError);

  /**
   * Cleanup function for ongoing operations
   */
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  /**
   * Fetches quotes with tenant context and filtering
   */
  const fetchQuotes = useCallback(async (
    filters: Record<string, any> = {},
    forceRefresh = false
  ) => {
    try {
      cleanup();
      abortControllerRef.current = new AbortController();

      setState(prev => ({ ...prev, loading: true, error: null }));

      const result = await dispatch(fetchQuotesThunk({ 
        ...filters,
        signal: abortControllerRef.current.signal 
      })).unwrap();

      setState(prev => ({ ...prev, loading: false, retryCount: 0 }));
      return result;
    } catch (error) {
      const quoteError = {
        code: 'FETCH_ERROR',
        message: 'Failed to fetch quotes',
        details: error
      };
      setState(prev => ({ ...prev, loading: false, error: quoteError }));
      notification.showNotification({
        message: 'Failed to fetch quotes',
        severity: 'error'
      });
      throw error;
    }
  }, [dispatch, notification, cleanup]);

  /**
   * Retrieves a specific quote by ID with tenant validation
   */
  const getQuoteById = useCallback((id: string): Quote | undefined => {
    return useSelector((state) => selectQuoteById(state, id));
  }, []);

  /**
   * Creates a new quote with optimistic updates
   */
  const createQuote = useCallback(async (quoteData: QuoteFormData): Promise<Quote> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const result = await dispatch(createQuoteThunk(quoteData)).unwrap();

      setState(prev => ({ ...prev, loading: false }));
      notification.showNotification({
        message: 'Quote created successfully',
        severity: 'success'
      });

      return result;
    } catch (error) {
      const quoteError = {
        code: 'CREATE_ERROR',
        message: 'Failed to create quote',
        details: error
      };
      setState(prev => ({ ...prev, loading: false, error: quoteError }));
      notification.showNotification({
        message: 'Failed to create quote',
        severity: 'error'
      });
      throw error;
    }
  }, [dispatch, notification]);

  /**
   * Updates an existing quote with version control
   */
  const updateQuote = useCallback(async (
    id: string, 
    quoteData: Partial<Quote>
  ): Promise<Quote> => {
    try {
      // Optimistic update
      const currentQuote = getQuoteById(id);
      if (currentQuote) {
        const optimisticQuote = { ...currentQuote, ...quoteData };
        setState(prev => ({
          ...prev,
          optimisticUpdates: new Map(prev.optimisticUpdates).set(id, optimisticQuote)
        }));
      }

      const result = await dispatch(updateQuoteThunk({ id, data: quoteData })).unwrap();

      // Clear optimistic update
      setState(prev => {
        const updates = new Map(prev.optimisticUpdates);
        updates.delete(id);
        return { ...prev, optimisticUpdates: updates };
      });

      notification.showNotification({
        message: 'Quote updated successfully',
        severity: 'success'
      });

      return result;
    } catch (error) {
      // Revert optimistic update
      setState(prev => {
        const updates = new Map(prev.optimisticUpdates);
        updates.delete(id);
        return {
          ...prev,
          error: {
            code: 'UPDATE_ERROR',
            message: 'Failed to update quote',
            details: error
          },
          optimisticUpdates: updates
        };
      });

      notification.showNotification({
        message: 'Failed to update quote',
        severity: 'error'
      });
      throw error;
    }
  }, [dispatch, notification, getQuoteById]);

  /**
   * Deletes a quote with confirmation
   */
  const deleteQuote = useCallback(async (id: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      await dispatch(deleteQuoteThunk(id)).unwrap();

      setState(prev => ({ ...prev, loading: false }));
      notification.showNotification({
        message: 'Quote deleted successfully',
        severity: 'success'
      });
    } catch (error) {
      const quoteError = {
        code: 'DELETE_ERROR',
        message: 'Failed to delete quote',
        details: error
      };
      setState(prev => ({ ...prev, loading: false, error: quoteError }));
      notification.showNotification({
        message: 'Failed to delete quote',
        severity: 'error'
      });
      throw error;
    }
  }, [dispatch, notification]);

  /**
   * Checks if a quote has pending optimistic updates
   */
  const isOptimisticUpdate = useCallback((id: string): boolean => {
    return state.optimisticUpdates.has(id);
  }, [state.optimisticUpdates]);

  /**
   * Retries a failed operation with exponential backoff
   */
  const retryOperation = useCallback(async (
    operation: () => Promise<any>
  ): Promise<any> => {
    if (state.retryCount >= MAX_RETRIES) {
      throw new Error('Maximum retry attempts exceeded');
    }

    const delay = RETRY_DELAY * Math.pow(2, state.retryCount);
    
    return new Promise((resolve, reject) => {
      retryTimeoutRef.current = setTimeout(async () => {
        try {
          setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }, [state.retryCount]);

  // Debounced fetch quotes function
  const debouncedFetch = useMemo(
    () => debounce(fetchQuotes, DEBOUNCE_DELAY),
    [fetchQuotes]
  );

  return {
    // State
    quotes,
    loading: state.loading || globalLoading,
    error: state.error || globalError,
    
    // Operations
    fetchQuotes: debouncedFetch,
    getQuoteById,
    createQuote,
    updateQuote,
    deleteQuote,
    
    // Utilities
    isOptimisticUpdate,
    retryOperation
  };
};

export default useQuotes;