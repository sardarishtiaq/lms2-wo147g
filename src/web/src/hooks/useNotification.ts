/**
 * @fileoverview Custom React hook for managing system-wide notifications in the multi-tenant CRM
 * @version 1.0.0
 * @license MIT
 */

import { useCallback, useEffect, useRef } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { 
  selectUI, 
  showNotification as showNotificationAction,
  hideNotification as hideNotificationAction,
  queueNotification as queueNotificationAction
} from '../store/slices/uiSlice';

// Types
export interface NotificationPayload {
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  ariaLabel?: string;
  autoHide?: boolean;
  action?: React.ReactNode;
  priority?: number;
}

interface UseNotificationReturn {
  notification: {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
    duration: number;
    ariaLabel?: string;
    autoHide: boolean;
    action?: React.ReactNode;
  };
  showNotification: (payload: NotificationPayload) => void;
  hideNotification: () => void;
  queueNotification: (payload: NotificationPayload) => void;
}

// Default durations by severity (in milliseconds)
const DEFAULT_DURATIONS = {
  success: 3000,
  info: 4000,
  warning: 5000,
  error: 6000,
};

/**
 * Custom hook for managing system-wide notifications with queue support
 * and accessibility features
 * 
 * @returns {UseNotificationReturn} Notification state and control functions
 */
export const useNotification = (): UseNotificationReturn => {
  const dispatch = useDispatch();
  const notificationState = useSelector(selectUI.selectNotification);
  const timerRef = useRef<NodeJS.Timeout>();

  // Clear any existing timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Handle auto-hide timer
  useEffect(() => {
    if (notificationState.open && notificationState.autoHide) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        dispatch(hideNotificationAction());
      }, notificationState.duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [notificationState.open, notificationState.autoHide, notificationState.duration, dispatch]);

  /**
   * Show a notification with enhanced payload
   * @param {NotificationPayload} payload - Notification configuration
   */
  const showNotification = useCallback((payload: NotificationPayload): void => {
    const {
      message,
      severity,
      duration = DEFAULT_DURATIONS[severity],
      ariaLabel = message,
      autoHide = true,
      action,
    } = payload;

    // Validate required fields
    if (!message || !severity) {
      console.error('Notification requires message and severity');
      return;
    }

    // Enhanced payload with accessibility and mobile optimizations
    const enhancedPayload = {
      message,
      severity,
      duration,
      ariaLabel,
      autoHide,
      action,
      // Add mobile-specific adjustments
      ...(window.innerWidth < 768 && {
        duration: duration * 1.5, // Increase duration on mobile
      }),
    };

    dispatch(showNotificationAction(enhancedPayload));
  }, [dispatch]);

  /**
   * Hide the current notification and process queue
   */
  const hideNotification = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    dispatch(hideNotificationAction());
  }, [dispatch]);

  /**
   * Add a notification to the queue with priority handling
   * @param {NotificationPayload} payload - Notification configuration
   */
  const queueNotification = useCallback((payload: NotificationPayload): void => {
    const {
      message,
      severity,
      duration = DEFAULT_DURATIONS[severity],
      priority = 0,
    } = payload;

    // Validate required fields
    if (!message || !severity) {
      console.error('Queued notification requires message and severity');
      return;
    }

    const queuePayload = {
      message,
      severity,
      duration,
      priority,
      timestamp: Date.now(),
    };

    dispatch(queueNotificationAction(queuePayload));
  }, [dispatch]);

  return {
    notification: {
      open: notificationState.open,
      message: notificationState.message,
      severity: notificationState.severity,
      duration: notificationState.duration,
      ariaLabel: notificationState.ariaLabel,
      autoHide: notificationState.autoHide,
      action: notificationState.action,
    },
    showNotification,
    hideNotification,
    queueNotification,
  };
};

export default useNotification;