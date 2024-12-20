/**
 * @fileoverview Enhanced notification component with queue support and accessibility features
 * for the multi-tenant CRM system. Implements Material-UI's Snackbar and Alert components
 * with responsive design and animation support.
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { Snackbar, Alert, useMediaQuery } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import useNotification from '../../hooks/useNotification';
import theme from '../../styles/theme';

// Constants for component configuration
const DEFAULT_AUTO_HIDE_DURATION = 6000;
const SNACKBAR_POSITION = {
  vertical: 'bottom' as const,
  horizontal: 'right' as const,
};
const ANIMATION_DURATION = 300;
const MAX_QUEUE_SIZE = 5;
const MOBILE_BREAKPOINT = 'sm';

// Enhanced styled Alert component with responsive design
const StyledAlert = styled(Alert)(({ theme, hasAction }) => ({
  borderRadius: 4,
  fontWeight: 500,
  padding: theme.spacing(1, 2),
  minWidth: '280px',
  maxWidth: '80vw',
  boxShadow: theme.shadows[2],
  transition: `all ${ANIMATION_DURATION}ms ease-in-out`,
  
  // Responsive styling for mobile devices
  [theme.breakpoints.down(MOBILE_BREAKPOINT)]: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: 0,
    padding: theme.spacing(1.5, 2),
  },

  // Adjust padding when action is present
  ...(hasAction && {
    paddingRight: theme.spacing(1),
    '& .MuiAlert-action': {
      paddingLeft: theme.spacing(2),
      alignItems: 'center',
    },
  }),

  // Custom styling for different severity levels
  '&.MuiAlert-standardSuccess': {
    backgroundColor: theme.palette.success.light,
  },
  '&.MuiAlert-standardError': {
    backgroundColor: theme.palette.error.light,
  },
  '&.MuiAlert-standardWarning': {
    backgroundColor: theme.palette.warning.light,
  },
  '&.MuiAlert-standardInfo': {
    backgroundColor: theme.palette.info.light,
  },
}));

/**
 * Enhanced notification component with queue support and accessibility features
 */
const Notification: React.FC = () => {
  const { notification, hideNotification } = useNotification();
  const isMobile = useMediaQuery(theme.breakpoints.down(MOBILE_BREAKPOINT));

  // Process notification queue on mount and update
  useEffect(() => {
    if (!notification.open && notification.message) {
      hideNotification();
    }
  }, [notification.open, notification.message, hideNotification]);

  /**
   * Enhanced handler for notification closure with queue processing
   * @param {React.SyntheticEvent | Event} event - The event triggering the close
   * @param {string} reason - The reason for closing
   */
  const handleClose = useCallback(
    (event: React.SyntheticEvent | Event, reason?: string) => {
      // Don't close if clicking away on mobile
      if (reason === 'clickaway' && isMobile) {
        return;
      }

      // Handle custom action if present
      if (reason === 'action' && notification.action) {
        // Action handling is managed by the action component itself
        return;
      }

      hideNotification();
    },
    [hideNotification, notification.action, isMobile]
  );

  return (
    <Snackbar
      open={notification.open}
      anchorOrigin={SNACKBAR_POSITION}
      autoHideDuration={
        notification.autoHide ? notification.duration || DEFAULT_AUTO_HIDE_DURATION : null
      }
      onClose={handleClose}
      TransitionProps={{
        enter: true,
        exit: true,
        timeout: ANIMATION_DURATION,
      }}
      // Enhanced accessibility features
      role="status"
      aria-live="polite"
    >
      <StyledAlert
        elevation={2}
        variant="filled"
        onClose={handleClose}
        severity={notification.severity}
        action={notification.action}
        hasAction={Boolean(notification.action)}
        // Enhanced accessibility attributes
        role="alert"
        aria-label={notification.ariaLabel || notification.message}
      >
        {notification.message}
      </StyledAlert>
    </Snackbar>
  );
};

export default Notification;