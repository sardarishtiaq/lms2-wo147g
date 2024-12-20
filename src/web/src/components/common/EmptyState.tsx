import React from 'react';
import { Box, Typography, Button, SvgIcon } from '@mui/material';
import { styled } from '@mui/material/styles';
import { SvgIconProps } from '@mui/material/SvgIcon';
import { COLORS } from '../../constants/theme';

// Styled components for consistent layout and styling
const StyledBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(3),
  minHeight: '200px',
  textAlign: 'center',
  width: '100%',
  maxWidth: '600px',
  margin: '0 auto',
  gap: theme.spacing(2),
}));

const StyledIcon = styled(SvgIcon)(({ theme }) => ({
  fontSize: 64,
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(2),
  opacity: 0.8,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    opacity: 1,
    transform: 'scale(1.05)',
  },
}));

// Interface for component props with proper TypeScript typing
interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<SvgIconProps>;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * EmptyState Component
 * 
 * A reusable component for displaying empty state messages across the application.
 * Implements Material Design principles and accessibility features.
 *
 * @param {EmptyStateProps} props - Component props
 * @returns {JSX.Element} Rendered empty state component
 */
const EmptyState: React.FC<EmptyStateProps> = React.memo(({
  title,
  subtitle,
  icon: IconComponent,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <StyledBox 
      className={className}
      role="status"
      aria-label={title}
    >
      {IconComponent && (
        <StyledIcon
          as={IconComponent}
          aria-hidden="true"
          role="presentation"
        />
      )}

      <Typography
        variant="h6"
        component="h2"
        color="textPrimary"
        gutterBottom
      >
        {title}
      </Typography>

      {subtitle && (
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ mb: 2 }}
        >
          {subtitle}
        </Typography>
      )}

      {actionLabel && onAction && (
        <Button
          variant="contained"
          color="primary"
          onClick={onAction}
          sx={{
            mt: 2,
            backgroundColor: COLORS.primary,
            '&:hover': {
              backgroundColor: COLORS.primary,
              opacity: 0.9,
            },
          }}
        >
          {actionLabel}
        </Button>
      )}
    </StyledBox>
  );
});

// Display name for debugging purposes
EmptyState.displayName = 'EmptyState';

// Default export with proper TypeScript typing
export default EmptyState;