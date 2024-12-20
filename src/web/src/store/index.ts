/**
 * @fileoverview Central Redux store configuration with multi-tenant support and real-time updates
 * Implements comprehensive state management with TypeScript type safety and performance optimizations
 * @version 1.0.0
 */

import { configureStore, combineReducers, Middleware } from '@reduxjs/toolkit'; // ^1.9.5
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'; // ^8.1.0

// Import reducers
import authReducer from './slices/authSlice';
import leadReducer from './slices/leadSlice';
import quoteReducer from './slices/quoteSlice';
import uiReducer from './slices/uiSlice';

// Import middleware
import { apiMiddleware } from './middleware/api';
import createWebSocketMiddleware from './middleware/websocket';

// WebSocket configuration
const WEBSOCKET_CONFIG = {
  url: process.env.REACT_APP_WS_URL || 'ws://localhost:3000',
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  timeout: 20000,
  heartbeatInterval: 30000,
  messageQueueSize: 100,
  tenantId: '',
  securityToken: '',
  enableEncryption: true,
  compressionLevel: 6
};

// Redux DevTools configuration
const REDUX_DEVTOOLS_CONFIG = {
  maxAge: 50,
  trace: true,
  traceLimit: 25,
  serialize: {
    options: {
      undefined: true,
      function: false
    }
  }
};

/**
 * Root state interface combining all slice states
 */
export interface RootState {
  auth: ReturnType<typeof authReducer>;
  leads: ReturnType<typeof leadReducer>;
  quotes: ReturnType<typeof quoteReducer>;
  ui: ReturnType<typeof uiReducer>;
}

/**
 * Typed dispatch function for the store
 */
export type AppDispatch = ReturnType<typeof store.dispatch>;

/**
 * Combines all reducers with proper typing
 */
const rootReducer = combineReducers({
  auth: authReducer,
  leads: leadReducer,
  quotes: quoteReducer,
  ui: uiReducer
});

/**
 * Configures middleware chain with proper order and tenant context
 */
const configureMiddleware = (tenantId: string): Middleware[] => {
  const wsConfig = {
    ...WEBSOCKET_CONFIG,
    tenantId
  };

  return [
    apiMiddleware,
    createWebSocketMiddleware(wsConfig)
  ];
};

/**
 * Creates and configures the Redux store with all enhancers
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          'websocket/connect',
          'websocket/disconnect',
          'websocket/messageReceived'
        ],
        // Ignore these field paths in state
        ignoredPaths: ['websocket.socket']
      },
      thunk: {
        extraArgument: {
          // Add any extra arguments for thunks here
        }
      }
    }).concat(configureMiddleware('')), // Empty tenant ID initially
  devTools: process.env.NODE_ENV !== 'production' 
    ? REDUX_DEVTOOLS_CONFIG 
    : false,
  preloadedState: undefined, // Initial state is handled by individual slices
  enhancers: [] // Additional enhancers can be added here
});

/**
 * Updates tenant context in middleware configuration
 * @param tenantId - New tenant identifier
 */
export const updateTenantContext = (tenantId: string): void => {
  store.dispatch({ 
    type: 'websocket/tenantChanged', 
    payload: { tenantId } 
  });
};

/**
 * Type-safe hooks for accessing the store
 */
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/**
 * Resets the entire store state
 * Useful for tenant switching or logout
 */
export const resetStore = (): void => {
  store.dispatch({ type: 'RESET_STORE' });
};

/**
 * Subscribes to store changes for persistence or monitoring
 */
store.subscribe(() => {
  const state = store.getState();
  // Add any global state change handlers here
  // e.g., persistence, analytics, etc.
});

// Export configured store instance
export default store;