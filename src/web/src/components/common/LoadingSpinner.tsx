import React, { useMemo, useCallback } from 'react';
import { CircularProgress, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import theme from '../../styles/theme';

// Interface for component props with comprehensive documentation
interface LoadingSpinnerProps {
  /** Size of the spinner - can be predefined size or custom number in pixels */
  size?: number | 'small' | 'medium' | 'large';
  /** Custom color for the spinner - defaults to theme primary color */
  color?: string;
  /** Whether to display the spinner in a full-screen overlay */
  fullScreen?: boolean;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** Test ID for component testing */
  testId?: string;
}

// Predefined size mappings following Material Design specifications
const SIZE_MAP = {
  small: 24,
  medium: 40,
  large: 56,
} as const;

// Size constraints for validation
const MIN_SIZE = 16;
const MAX_SIZE = 96;

// Styled container component with fullScreen support
const SpinnerContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'fullScreen',
})<{ fullScreen?: boolean }>(({ fullScreen }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: theme.spacing(3),
  ...(fullScreen && {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: theme.zIndex.modal + 1,
    backdropFilter: 'blur(2px)',
  }),
}));

/**
 * Validates and calculates the spinner size based on input
 * @param size - The desired size of the spinner
 * @returns The validated pixel size for the spinner
 */
const getSpinnerSize = (size?: LoadingSpinnerProps['size']): number => {
  if (typeof size === 'number') {
    return Math.min(Math.max(size, MIN_SIZE), MAX_SIZE);
  }
  if (size && size in SIZE_MAP) {
    return SIZE_MAP[size as keyof typeof SIZE_MAP];
  }
  return SIZE_MAP.medium;
};

/**
 * LoadingSpinner Component
 * 
 * A reusable loading indicator that provides visual feedback during async operations.
 * Follows Material Design specifications and supports both inline and full-screen modes.
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = React.memo(({
  size,
  color = theme.palette.primary.main,
  fullScreen = false,
  ariaLabel = 'Loading content',
  testId = 'loading-spinner',
}) => {
  // Memoize the calculated size for performance
  const spinnerSize = useMemo(() => getSpinnerSize(size), [size]);

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (fullScreen && event.key === 'Escape') {
      // Prevent event bubbling for full-screen mode
      event.stopPropagation();
    }
  }, [fullScreen]);

  return (
    <SpinnerContainer
      fullScreen={fullScreen}
      role="progressbar"
      aria-label={ariaLabel}
      data-testid={testId}
      onKeyDown={handleKeyDown}
      tabIndex={fullScreen ? 0 : -1}
    >
      <CircularProgress
        size={spinnerSize}
        color="primary"
        sx={{
          color,
          // Add subtle animation for smoother appearance
          animation: 'circular-rotate 1.4s linear infinite',
        }}
      />
    </SpinnerContainer>
  );
});

// Display name for debugging
LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;