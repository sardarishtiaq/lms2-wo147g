/**
 * @fileoverview Redux slice for managing lead state in the multi-tenant CRM system
 * Implements comprehensive lead management with tenant isolation and real-time updates
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Lead, LeadFilters } from '../../types/lead';
import { LeadCategory } from '../../constants/leadCategories';
import { LeadService } from '../../services/leads';
import { ApiError } from '../../utils/api';

// Retry configuration for async operations
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Interface for pagination state
 */
interface PaginationState {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * Interface for loading states
 */
interface LoadingState {
  fetch: boolean;
  update: boolean;
  delete: boolean;
}

/**
 * Interface for error state
 */
interface ErrorState {
  message: string | null;
  code: string | null;
  retryCount: number;
}

/**
 * Interface for optimistic update tracking
 */
interface OptimisticUpdate {
  type: string;
  data: any;
  timestamp: number;
}

/**
 * Interface for tenant context
 */
interface TenantContext {
  id: string;
  settings: {
    leadCategories: string[];
    [key: string]: any;
  };
}

/**
 * Interface for lead slice state
 */
interface LeadState {
  leads: Lead[];
  selectedLead: Lead | null;
  filters: LeadFilters;
  pagination: PaginationState;
  loading: LoadingState;
  error: ErrorState;
  optimisticUpdates: Map<string, OptimisticUpdate>;
  tenantContext: TenantContext;
}

/**
 * Initial state for the lead slice
 */
const initialState: LeadState = {
  leads: [],
  selectedLead: null,
  filters: {
    category: [],
    assignedTo: [],
    status: [],
    priority: [],
    dateRange: { start: '', end: '' },
    score: { min: 0, max: 100 },
    source: []
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    hasMore: false
  },
  loading: {
    fetch: false,
    update: false,
    delete: false
  },
  error: {
    message: null,
    code: null,
    retryCount: 0
  },
  optimisticUpdates: new Map(),
  tenantContext: {
    id: '',
    settings: {
      leadCategories: []
    }
  }
};

/**
 * Async thunk for fetching leads with pagination and filters
 */
export const fetchLeadsAsync = createAsyncThunk(
  'leads/fetchLeads',
  async ({ 
    filters, 
    pagination, 
    tenantId 
  }: { 
    filters: LeadFilters; 
    pagination: { page: number; limit: number }; 
    tenantId: string 
  }, { rejectWithValue }) => {
    try {
      const response = await LeadService.fetchLeads(filters, pagination);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        return rejectWithValue({
          message: error.message,
          code: error.code
        });
      }
      throw error;
    }
  }
);

/**
 * Async thunk for updating a lead
 */
export const updateLeadAsync = createAsyncThunk(
  'leads/updateLead',
  async ({ 
    leadId, 
    data, 
    tenantId 
  }: { 
    leadId: string; 
    data: Partial<Lead>; 
    tenantId: string 
  }, { rejectWithValue }) => {
    try {
      const response = await LeadService.updateLead(leadId, data);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        return rejectWithValue({
          message: error.message,
          code: error.code
        });
      }
      throw error;
    }
  }
);

/**
 * Lead slice definition with reducers and actions
 */
const leadSlice = createSlice({
  name: 'leads',
  initialState,
  reducers: {
    setTenantContext: (state, action: PayloadAction<TenantContext>) => {
      state.tenantContext = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<LeadFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1; // Reset pagination when filters change
    },
    setSelectedLead: (state, action: PayloadAction<Lead | null>) => {
      state.selectedLead = action.payload;
    },
    addOptimisticUpdate: (state, action: PayloadAction<{ id: string; update: OptimisticUpdate }>) => {
      state.optimisticUpdates.set(action.payload.id, action.payload.update);
    },
    removeOptimisticUpdate: (state, action: PayloadAction<string>) => {
      state.optimisticUpdates.delete(action.payload);
    },
    clearErrors: (state) => {
      state.error = initialState.error;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch leads reducers
      .addCase(fetchLeadsAsync.pending, (state) => {
        state.loading.fetch = true;
        state.error = initialState.error;
      })
      .addCase(fetchLeadsAsync.fulfilled, (state, action) => {
        state.loading.fetch = false;
        state.leads = action.payload.data;
        state.pagination = {
          ...state.pagination,
          total: action.payload.total,
          hasMore: action.payload.data.length >= state.pagination.limit
        };
      })
      .addCase(fetchLeadsAsync.rejected, (state, action) => {
        state.loading.fetch = false;
        if (action.payload) {
          state.error = {
            message: (action.payload as { message: string }).message,
            code: (action.payload as { code: string }).code,
            retryCount: state.error.retryCount + 1
          };
        }
      })
      // Update lead reducers
      .addCase(updateLeadAsync.pending, (state) => {
        state.loading.update = true;
      })
      .addCase(updateLeadAsync.fulfilled, (state, action) => {
        state.loading.update = false;
        const index = state.leads.findIndex(lead => lead.id === action.payload.id);
        if (index !== -1) {
          state.leads[index] = action.payload;
        }
        if (state.selectedLead?.id === action.payload.id) {
          state.selectedLead = action.payload;
        }
        state.optimisticUpdates.delete(action.payload.id);
      })
      .addCase(updateLeadAsync.rejected, (state, action) => {
        state.loading.update = false;
        if (action.payload) {
          state.error = {
            message: (action.payload as { message: string }).message,
            code: (action.payload as { code: string }).code,
            retryCount: state.error.retryCount + 1
          };
        }
      });
  }
});

// Export actions
export const {
  setTenantContext,
  setFilters,
  setSelectedLead,
  addOptimisticUpdate,
  removeOptimisticUpdate,
  clearErrors
} = leadSlice.actions;

// Selectors
export const selectLeads = (state: { leads: LeadState }) => state.leads.leads;
export const selectSelectedLead = (state: { leads: LeadState }) => state.leads.selectedLead;
export const selectFilters = (state: { leads: LeadState }) => state.leads.filters;
export const selectPagination = (state: { leads: LeadState }) => state.leads.pagination;
export const selectLoading = (state: { leads: LeadState }) => state.leads.loading;
export const selectError = (state: { leads: LeadState }) => state.leads.error;
export const selectTenantContext = (state: { leads: LeadState }) => state.leads.tenantContext;

// Memoized selectors
export const selectLeadsByCategory = createSelector(
  [selectLeads, (state: { leads: LeadState }, category: LeadCategory) => category],
  (leads, category) => leads.filter(lead => lead.category === category)
);

export const selectLeadCount = createSelector(
  [selectLeads],
  (leads) => leads.length
);

// Export reducer
export default leadSlice.reducer;