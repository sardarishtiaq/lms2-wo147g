/**
 * @fileoverview Redux slice for quote management with tenant isolation and real-time updates
 * Implements comprehensive quote state management for the CRM system
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5
import { normalize, schema } from 'normalizr'; // ^3.6.2
import { Quote, QuoteFormData, QuoteStatus } from '../../types/quote';
import { QuoteService } from '../../services/quotes';

// Normalizr schema for quotes
const quoteSchema = new schema.Entity('quotes', {}, { idAttribute: 'id' });
const quoteListSchema = new schema.Array(quoteSchema);

/**
 * Interface defining the quote slice state structure
 */
interface QuoteState {
  quotes: Record<string, Quote>;
  loading: boolean;
  error: string | null;
  selectedQuoteId: string | null;
  lastUpdated: Record<string, number>;
  pendingOperations: Record<string, boolean>;
}

/**
 * Interface for quote filtering options
 */
interface QuoteFilters {
  tenantId: string;
  leadId?: string;
  status?: QuoteStatus;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Initial state for the quote slice
 */
const initialState: QuoteState = {
  quotes: {},
  loading: false,
  error: null,
  selectedQuoteId: null,
  lastUpdated: {},
  pendingOperations: {}
};

/**
 * Async thunk for fetching quotes with tenant isolation
 */
export const fetchQuotes = createAsyncThunk(
  'quotes/fetchQuotes',
  async (filters: QuoteFilters) => {
    const quotes = await QuoteService.getQuotes(filters);
    const normalized = normalize(quotes, quoteListSchema);
    return {
      quotes: normalized.entities.quotes || {},
      tenantId: filters.tenantId
    };
  }
);

/**
 * Async thunk for creating a new quote with optimistic updates
 */
export const createQuote = createAsyncThunk(
  'quotes/createQuote',
  async (data: QuoteFormData, { rejectWithValue }) => {
    try {
      const quote = await QuoteService.createQuote(data);
      return normalize(quote, quoteSchema).entities.quotes;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Async thunk for updating an existing quote with real-time sync
 */
export const updateQuote = createAsyncThunk(
  'quotes/updateQuote',
  async ({ id, data }: { id: string; data: Partial<QuoteFormData> }, { rejectWithValue }) => {
    try {
      const quote = await QuoteService.updateQuote(id, data);
      return normalize(quote, quoteSchema).entities.quotes;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Async thunk for deleting a quote
 */
export const deleteQuote = createAsyncThunk(
  'quotes/deleteQuote',
  async (id: string, { rejectWithValue }) => {
    try {
      await QuoteService.deleteQuote(id);
      return id;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Quote management slice with comprehensive state handling
 */
const quoteSlice = createSlice({
  name: 'quotes',
  initialState,
  reducers: {
    setSelectedQuote: (state, action: PayloadAction<string | null>) => {
      state.selectedQuoteId = action.payload;
    },
    updateQuoteOptimistically: (state, action: PayloadAction<Quote>) => {
      const quote = action.payload;
      state.quotes[quote.id] = quote;
      state.lastUpdated[quote.id] = Date.now();
    },
    clearQuoteErrors: (state) => {
      state.error = null;
    },
    resetQuoteState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Fetch quotes reducers
      .addCase(fetchQuotes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchQuotes.fulfilled, (state, action) => {
        state.quotes = {
          ...state.quotes,
          ...action.payload.quotes
        };
        state.loading = false;
        state.lastUpdated = Object.keys(action.payload.quotes).reduce(
          (acc, id) => ({ ...acc, [id]: Date.now() }),
          state.lastUpdated
        );
      })
      .addCase(fetchQuotes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch quotes';
      })

      // Create quote reducers
      .addCase(createQuote.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createQuote.fulfilled, (state, action) => {
        state.quotes = {
          ...state.quotes,
          ...action.payload
        };
        state.loading = false;
      })
      .addCase(createQuote.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to create quote';
      })

      // Update quote reducers
      .addCase(updateQuote.pending, (state, action) => {
        state.pendingOperations[action.meta.arg.id] = true;
      })
      .addCase(updateQuote.fulfilled, (state, action) => {
        state.quotes = {
          ...state.quotes,
          ...action.payload
        };
        delete state.pendingOperations[Object.keys(action.payload)[0]];
      })
      .addCase(updateQuote.rejected, (state, action) => {
        state.error = action.payload as string || 'Failed to update quote';
        delete state.pendingOperations[action.meta.arg.id];
      })

      // Delete quote reducers
      .addCase(deleteQuote.pending, (state, action) => {
        state.pendingOperations[action.meta.arg] = true;
      })
      .addCase(deleteQuote.fulfilled, (state, action) => {
        const { [action.payload]: _, ...remainingQuotes } = state.quotes;
        state.quotes = remainingQuotes;
        delete state.pendingOperations[action.payload];
        if (state.selectedQuoteId === action.payload) {
          state.selectedQuoteId = null;
        }
      })
      .addCase(deleteQuote.rejected, (state, action) => {
        state.error = action.payload as string || 'Failed to delete quote';
        delete state.pendingOperations[action.meta.arg];
      });
  }
});

// Export actions
export const {
  setSelectedQuote,
  updateQuoteOptimistically,
  clearQuoteErrors,
  resetQuoteState
} = quoteSlice.actions;

// Export reducer
export default quoteSlice.reducer;

// Memoized selectors
export const selectQuotesByTenant = (state: { quotes: QuoteState }, tenantId: string) =>
  Object.values(state.quotes.quotes).filter(quote => quote.tenantId === tenantId);

export const selectQuoteById = (state: { quotes: QuoteState }, id: string) =>
  state.quotes.quotes[id];

export const selectQuoteLoadingState = (state: { quotes: QuoteState }) =>
  state.quotes.loading;

export const selectQuoteError = (state: { quotes: QuoteState }) =>
  state.quotes.error;

export const selectSelectedQuote = (state: { quotes: QuoteState }) =>
  state.quotes.selectedQuoteId ? state.quotes.quotes[state.quotes.selectedQuoteId] : null;