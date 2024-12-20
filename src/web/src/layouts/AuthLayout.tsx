import React, { useCallback } from 'react';
import { Box, Container, Paper, Typography } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import LoadingSpinner from '../components/common/LoadingSpinner';
import theme from '../../styles/theme';

// Interface for component props with comprehensive documentation
interface AuthLayoutProps {
  /** Child components to be rendered within the layout */
  children: React.ReactNode;
  /** Loading state indicator */
  loading?: boolean;
  /** Title text for the authentication page */
  title: string;
  /** Error message to display */
  error?: string | null;
  /** Error handler callback */
  onError?: (error: Error) => void;
  /** Test ID for component testing */
  testId?: string;
}

// Styled components with theme-based styling
const AuthContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.default,
  transition: 'background-color 0.3s ease',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const AuthCard = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: {
    xs: '100%',
    sm: '450px',
    md: '450px',
  }[theme.breakpoints.values.sm],
  padding: theme.spacing(4),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  backgroundColor: theme.palette.background.paper,
  position: 'relative',
  overflow: 'hidden',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    boxShadow: 'none',
  },
}));

const LogoContainer = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  marginBottom: theme.spacing(4),
  '& img': {
    maxWidth: '200px',
    height: 'auto',
    [theme.breakpoints.down('sm')]: {
      maxWidth: '150px',
    },
  },
}));

const ErrorMessage = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  marginBottom: theme.spacing(2),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: `${theme.palette.error.light}20`,
  textAlign: 'center',
}));

/**
 * AuthLayout Component
 * 
 * A layout component that provides the authentication page structure and styling
 * for login, forgot password, and reset password pages in the multi-tenant CRM system.
 */
const AuthLayout: React.FC<AuthLayoutProps> = React.memo(({
  children,
  loading = false,
  title,
  error = null,
  onError,
  testId = 'auth-layout',
}) => {
  const theme = useTheme();

  // Handle error boundary fallback
  const handleError = useCallback((error: Error) => {
    console.error('Authentication layout error:', error);
    onError?.(error);
  }, [onError]);

  // Handle keyboard navigation for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && loading) {
      event.preventDefault();
    }
  }, [loading]);

  return (
    <AuthContainer
      maxWidth={false}
      data-testid={testId}
      onKeyDown={handleKeyDown}
      role="main"
      aria-live="polite"
    >
      <AuthCard elevation={1}>
        {/* Logo Section */}
        <LogoContainer>
          <img
            src="/assets/images/logo.svg"
            alt="CRM Logo"
            loading="eager"
            width={200}
            height={60}
          />
        </LogoContainer>

        {/* Title Section */}
        <Typography
          variant="h4"
          component="h1"
          align="center"
          gutterBottom
          sx={{
            marginBottom: theme.spacing(4),
            color: theme.palette.text.primary,
            fontWeight: theme.typography.fontWeightMedium,
          }}
        >
          {title}
        </Typography>

        {/* Error Message */}
        {error && (
          <ErrorMessage
            variant="body2"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </ErrorMessage>
        )}

        {/* Loading State */}
        {loading ? (
          <Box sx={{ position: 'relative', minHeight: 200 }}>
            <LoadingSpinner
              size="large"
              color={theme.palette.primary.main}
              ariaLabel="Authentication in progress"
              testId={`${testId}-loading`}
            />
          </Box>
        ) : (
          // Content Section
          <Box
            component="section"
            sx={{
              position: 'relative',
              opacity: loading ? 0.5 : 1,
              transition: 'opacity 0.3s ease',
            }}
          >
            {children}
          </Box>
        )}
      </AuthCard>
    </AuthContainer>
  );
});

// Display name for debugging
AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;