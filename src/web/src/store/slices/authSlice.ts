/**
 * @fileoverview Redux slice for authentication state management in multi-tenant CRM system
 * Implements secure JWT-based authentication with tenant isolation and token lifecycle
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  AuthState, 
  LoginCredentials, 
  AuthResponse, 
  AuthError, 
  TokenValidationResponse 
} from '../../types/auth';
import { AuthService } from '../../services/auth';

// Token refresh constants
const REFRESH_INTERVAL = 840000; // 14 minutes in milliseconds
const MAX_REFRESH_RETRIES = 3;

/**
 * Initial authentication state with proper tenant isolation
 */
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tenantId: null,
  loading: false,
  error: null,
  tokenRefreshStatus: 'idle',
  lastRefreshAttempt: null,
  refreshRetryCount: 0
};

/**
 * Async thunk for handling user login with tenant context
 */
export const loginAsync = createAsyncThunk<
  AuthResponse,
  LoginCredentials,
  { rejectValue: AuthError }
>(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await AuthService.login(credentials);
      // Start token refresh cycle after successful login
      startTokenRefreshCycle();
      return response;
    } catch (error) {
      return rejectWithValue({
        code: error instanceof Error ? 'AUTH_ERROR' : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Authentication failed'
      });
    }
  }
);

/**
 * Async thunk for handling secure logout
 */
export const logoutAsync = createAsyncThunk<
  void,
  string,
  { rejectValue: AuthError }
>(
  'auth/logout',
  async (tenantId: string, { rejectWithValue }) => {
    try {
      await AuthService.logout(tenantId);
      // Stop token refresh cycle on logout
      stopTokenRefreshCycle();
    } catch (error) {
      return rejectWithValue({
        code: error instanceof Error ? 'LOGOUT_ERROR' : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Logout failed'
      });
    }
  }
);

/**
 * Async thunk for token refresh with tenant context
 */
export const refreshTokenAsync = createAsyncThunk<
  TokenValidationResponse,
  string,
  { rejectValue: AuthError }
>(
  'auth/refreshToken',
  async (tenantId: string, { rejectWithValue, getState }) => {
    try {
      const response = await AuthService.refreshToken(tenantId);
      return response;
    } catch (error) {
      return rejectWithValue({
        code: error instanceof Error ? 'REFRESH_ERROR' : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Token refresh failed'
      });
    }
  }
);

/**
 * Authentication slice with comprehensive state management
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Reset authentication error state
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * Update token refresh status
     */
    setTokenRefreshStatus: (state, action: PayloadAction<'idle' | 'pending' | 'success' | 'error'>) => {
      state.tokenRefreshStatus = action.payload;
    },

    /**
     * Reset authentication state
     */
    resetAuth: (state) => {
      return { ...initialState };
    }
  },
  extraReducers: (builder) => {
    // Login action handlers
    builder
      .addCase(loginAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.tenantId = action.payload.tenantId;
        state.loading = false;
        state.error = null;
        state.tokenRefreshStatus = 'idle';
        state.refreshRetryCount = 0;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.isAuthenticated = false;
        state.user = null;
        state.loading = false;
        state.error = action.payload || {
          code: 'AUTH_ERROR',
          message: 'Authentication failed'
        };
      })

    // Logout action handlers
    builder
      .addCase(logoutAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutAsync.fulfilled, (state) => {
        return { ...initialState };
      })
      .addCase(logoutAsync.rejected, (state, action) => {
        state.error = action.payload || {
          code: 'LOGOUT_ERROR',
          message: 'Logout failed'
        };
        state.loading = false;
      })

    // Token refresh action handlers
    builder
      .addCase(refreshTokenAsync.pending, (state) => {
        state.tokenRefreshStatus = 'pending';
        state.lastRefreshAttempt = Date.now();
      })
      .addCase(refreshTokenAsync.fulfilled, (state) => {
        state.tokenRefreshStatus = 'success';
        state.refreshRetryCount = 0;
      })
      .addCase(refreshTokenAsync.rejected, (state, action) => {
        state.tokenRefreshStatus = 'error';
        state.refreshRetryCount += 1;
        state.error = action.payload || {
          code: 'REFRESH_ERROR',
          message: 'Token refresh failed'
        };
        
        // Handle authentication expiry after max retries
        if (state.refreshRetryCount >= MAX_REFRESH_RETRIES) {
          return { ...initialState };
        }
      });
  }
});

// Token refresh cycle management
let refreshInterval: NodeJS.Timeout | null = null;

/**
 * Starts the token refresh cycle
 */
const startTokenRefreshCycle = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  refreshInterval = setInterval(() => {
    const state = store.getState();
    if (state.auth.isAuthenticated && state.auth.tenantId) {
      store.dispatch(refreshTokenAsync(state.auth.tenantId));
    }
  }, REFRESH_INTERVAL);
};

/**
 * Stops the token refresh cycle
 */
const stopTokenRefreshCycle = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
};

// Export actions and reducer
export const { clearError, setTokenRefreshStatus, resetAuth } = authSlice.actions;
export default authSlice.reducer;

// Selector for authentication state
export const selectAuth = (state: { auth: AuthState }) => state.auth;