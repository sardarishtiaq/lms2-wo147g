/**
 * @fileoverview Redux slice for managing global UI state in the multi-tenant CRM system
 * @version 1.0.0
 * @license MIT
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5

// Types and Interfaces
export interface NotificationPayload {
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  autoHide?: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

export interface UIState {
  notification: {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
    duration: number;
    queue: NotificationPayload[];
    autoHide: boolean;
  };
  loading: {
    global: boolean;
    requests: Record<string, boolean>;
    progress: number | null;
    message: string | null;
  };
  modal: {
    open: boolean;
    type: string | null;
    data: any;
    size: 'sm' | 'md' | 'lg' | 'xl';
    fullScreen: boolean;
    disableBackdropClick: boolean;
  };
  sidebar: {
    open: boolean;
    width: number;
    collapsed: boolean;
    persistent: boolean;
    anchor: 'left' | 'right';
  };
}

// Initial State
const INITIAL_STATE: UIState = {
  notification: {
    open: false,
    message: '',
    severity: 'info',
    duration: 6000,
    queue: [],
    autoHide: true,
  },
  loading: {
    global: false,
    requests: {},
    progress: null,
    message: null,
  },
  modal: {
    open: false,
    type: null,
    data: null,
    size: 'md',
    fullScreen: false,
    disableBackdropClick: false,
  },
  sidebar: {
    open: true,
    width: 240,
    collapsed: false,
    persistent: true,
    anchor: 'left',
  },
};

// Create Slice
export const uiSlice = createSlice({
  name: 'ui',
  initialState: INITIAL_STATE,
  reducers: {
    // Notification Actions
    showNotification: (state, action: PayloadAction<NotificationPayload>) => {
      const { message, severity, duration, autoHide = true, action: notificationAction } = action.payload;
      
      if (state.notification.open) {
        // Add to queue if notification is already showing
        state.notification.queue.push(action.payload);
        return;
      }

      state.notification = {
        ...state.notification,
        open: true,
        message,
        severity,
        duration: duration ?? state.notification.duration,
        autoHide,
      };
    },

    hideNotification: (state) => {
      const nextNotification = state.notification.queue.shift();
      
      if (nextNotification) {
        // Show next notification in queue
        state.notification = {
          ...state.notification,
          message: nextNotification.message,
          severity: nextNotification.severity,
          duration: nextNotification.duration ?? state.notification.duration,
          autoHide: nextNotification.autoHide ?? true,
        };
      } else {
        // Reset notification state
        state.notification.open = false;
        state.notification.message = '';
      }
    },

    // Loading Actions
    setLoading: (state, action: PayloadAction<{
      requestId: string;
      loading: boolean;
      progress?: number;
      message?: string;
    }>) => {
      const { requestId, loading, progress, message } = action.payload;
      
      // Update specific request loading state
      state.loading.requests[requestId] = loading;
      
      // Update progress and message if provided
      if (progress !== undefined) state.loading.progress = progress;
      if (message !== undefined) state.loading.message = message;
      
      // Calculate global loading state
      state.loading.global = Object.values(state.loading.requests).some(Boolean);
      
      // Clear progress and message when no requests are loading
      if (!state.loading.global) {
        state.loading.progress = null;
        state.loading.message = null;
      }
    },

    // Modal Actions
    showModal: (state, action: PayloadAction<{
      type: string;
      data?: any;
      size?: 'sm' | 'md' | 'lg' | 'xl';
      fullScreen?: boolean;
      disableBackdropClick?: boolean;
    }>) => {
      const { type, data, size = 'md', fullScreen = false, disableBackdropClick = false } = action.payload;
      
      state.modal = {
        open: true,
        type,
        data,
        size,
        fullScreen,
        disableBackdropClick,
      };
    },

    hideModal: (state) => {
      state.modal = {
        ...INITIAL_STATE.modal,
        open: false,
      };
    },

    // Sidebar Actions
    configureSidebar: (state, action: PayloadAction<{
      width?: number;
      collapsed?: boolean;
      persistent?: boolean;
      anchor?: 'left' | 'right';
    }>) => {
      const { width, collapsed, persistent, anchor } = action.payload;
      
      if (width !== undefined) state.sidebar.width = width;
      if (collapsed !== undefined) state.sidebar.collapsed = collapsed;
      if (persistent !== undefined) state.sidebar.persistent = persistent;
      if (anchor !== undefined) state.sidebar.anchor = anchor;
    },

    toggleSidebar: (state) => {
      state.sidebar.open = !state.sidebar.open;
    },
  },
});

// Export actions
export const {
  showNotification,
  hideNotification,
  setLoading,
  showModal,
  hideModal,
  configureSidebar,
  toggleSidebar,
} = uiSlice.actions;

// Selectors
export const selectUI = {
  selectNotification: (state: { ui: UIState }) => state.ui.notification,
  selectLoading: (state: { ui: UIState }) => state.ui.loading,
  selectModal: (state: { ui: UIState }) => state.ui.modal,
  selectSidebar: (state: { ui: UIState }) => state.ui.sidebar,
};

// Export reducer
export default uiSlice.reducer;