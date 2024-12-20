import React, { Component, ErrorInfo } from 'react';
import { ErrorIcon } from '@mui/icons-material';
import EmptyState from './EmptyState';
import { COLORS } from '../../constants/theme';

/**
 * Props interface for the ErrorBoundary component
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  tenantId?: string;
}

/**
 * State interface for the ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Enhanced Error Boundary component with tenant awareness and environment-specific error handling
 * 
 * @class ErrorBoundary
 * @extends {Component<ErrorBoundaryProps, ErrorBoundaryState>}
 * @version 1.0.0
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };

    // Bind methods for performance optimization
    this.resetError = this.resetError.bind(this);
  }

  /**
   * Static method to derive error state
   * @param {Error} error - The error that was caught
   * @returns {ErrorBoundaryState} Updated state with error information
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  /**
   * Lifecycle method called when an error occurs
   * Handles error reporting with tenant context
   * 
   * @param {Error} error - The error that occurred
   * @param {ErrorInfo} errorInfo - React error info object
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { tenantId } = this.props;

    // Update component state with error details
    this.setState({
      error,
      errorInfo
    });

    // Development environment logging
    if (process.env.NODE_ENV === 'development') {
      console.group('Error Boundary Caught Error:');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Tenant Context:', tenantId);
      console.groupEnd();
    }

    // Production error reporting
    if (process.env.NODE_ENV === 'production') {
      // Sanitize error information for production
      const sanitizedError = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        tenantId,
        timestamp: new Date().toISOString()
      };

      // TODO: Send to error tracking service
      // errorTrackingService.captureError(sanitizedError);
    }
  }

  /**
   * Resets the error state and allows retry
   */
  resetError(): void {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  }

  /**
   * Renders the error boundary content
   * @returns {JSX.Element} The rendered component
   */
  render(): JSX.Element {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // If a custom fallback is provided, render it
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default error UI using EmptyState component
      return (
        <EmptyState
          title="Something went wrong"
          subtitle={error?.message || 'An unexpected error occurred. Please try again.'}
          icon={ErrorIcon}
          actionLabel="Retry"
          onAction={this.resetError}
          className="error-boundary-fallback"
          sx={{
            color: COLORS.error,
            backgroundColor: `${COLORS.error}10`,
            borderRadius: '8px',
            padding: '24px'
          }}
        />
      );
    }

    // When no error occurs, render children normally
    return <>{children}</>;
  }
}

// Export the ErrorBoundary component
export default ErrorBoundary;