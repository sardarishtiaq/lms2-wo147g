import React, { useCallback } from 'react';
import { 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import theme from '../../styles/theme';

/**
 * Maps severity levels to Material-UI color variants
 */
const SEVERITY_COLORS = {
  info: 'primary',
  warning: 'warning',
  error: 'error'
} as const;

/**
 * Default labels for dialog buttons
 */
const DEFAULT_LABELS = {
  confirm: 'Confirm',
  cancel: 'Cancel'
} as const;

/**
 * Props interface for the ConfirmDialog component
 */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'info' | 'warning' | 'error';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  disableBackdropClick?: boolean;
  autoFocus?: boolean;
  analyticsEvent?: string;
}

/**
 * A reusable confirmation dialog component that follows Material-UI design specifications.
 * Provides accessibility features, internationalization support, and analytics tracking.
 *
 * @param props - Component props
 * @returns React component
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = DEFAULT_LABELS.confirm,
  cancelLabel = DEFAULT_LABELS.cancel,
  severity = 'info',
  onConfirm,
  onCancel,
  isLoading = false,
  disableBackdropClick = false,
  autoFocus = true,
  analyticsEvent
}) => {
  const { t } = useTranslation();
  
  /**
   * Handles the confirmation action with loading state and analytics tracking
   */
  const handleConfirm = useCallback(async () => {
    try {
      if (analyticsEvent) {
        // Track confirmation analytics event
        window.analytics?.track(analyticsEvent, {
          action: 'confirm',
          severity
        });
      }
      
      await onConfirm();
    } catch (error) {
      console.error('Confirmation action failed:', error);
      // Track error analytics
      window.analytics?.track('confirmation_error', {
        event: analyticsEvent,
        error: error.message
      });
    }
  }, [onConfirm, analyticsEvent, severity]);

  /**
   * Handles the cancel action with analytics tracking
   */
  const handleCancel = useCallback(() => {
    if (analyticsEvent) {
      // Track cancellation analytics event
      window.analytics?.track(analyticsEvent, {
        action: 'cancel',
        severity
      });
    }
    onCancel();
  }, [onCancel, analyticsEvent, severity]);

  /**
   * Handles clicking outside the dialog
   */
  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!disableBackdropClick) {
      handleCancel();
    }
  }, [disableBackdropClick, handleCancel]);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      onClick={handleBackdropClick}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      sx={{
        '& .MuiDialog-paper': {
          width: '100%',
          maxWidth: 400,
          padding: theme.spacing(2),
          margin: theme.spacing(2)
        }
      }}
    >
      <DialogTitle 
        id="confirm-dialog-title"
        sx={{
          color: theme.palette[SEVERITY_COLORS[severity]].main
        }}
      >
        {t(title)}
      </DialogTitle>

      <DialogContent>
        <Typography
          id="confirm-dialog-description"
          variant="body1"
          sx={{ 
            color: theme.palette.text.secondary,
            marginBottom: theme.spacing(2)
          }}
        >
          {t(message)}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ padding: theme.spacing(2, 0) }}>
        <Button
          onClick={handleCancel}
          color="inherit"
          disabled={isLoading}
          sx={{ 
            marginRight: theme.spacing(1),
            color: theme.palette.text.secondary
          }}
        >
          {t(cancelLabel)}
        </Button>
        <Button
          onClick={handleConfirm}
          color={SEVERITY_COLORS[severity]}
          variant="contained"
          disabled={isLoading}
          autoFocus={autoFocus}
          sx={{
            minWidth: 100,
            '&.Mui-disabled': {
              backgroundColor: theme.palette[SEVERITY_COLORS[severity]].light,
              color: theme.palette.common.white
            }
          }}
        >
          {t(confirmLabel)}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;