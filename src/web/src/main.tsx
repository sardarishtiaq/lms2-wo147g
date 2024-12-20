/**
 * @fileoverview Entry point for the multi-tenant CRM React application
 * Implements root render with providers, global configurations, and real-time capabilities
 * @version 1.0.0
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import App from './App';
import { store } from './store';
import theme from './styles/theme';

// Constants
const ROOT_ELEMENT_ID = 'root';
const ENV = process.env.NODE_ENV;
const API_URL = process.env.REACT_APP_API_URL;
const WS_URL = process.env.REACT_APP_WS_URL;

/**
 * Initializes performance and error monitoring services
 */
const initializeMonitoring = (): void => {
  if (ENV === 'production') {
    // Initialize performance monitoring
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        // Report performance metrics
        console.log(`Performance Entry: ${entry.name} - ${entry.duration}ms`);
      });
    });
    observer.observe({ entryTypes: ['navigation', 'resource', 'paint'] });

    // Initialize error tracking
    window.addEventListener('error', (event) => {
      // Report error to monitoring service
      console.error('Global Error:', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      // Report unhandled promise rejection
      console.error('Unhandled Promise Rejection:', event.reason);
    });
  }
};

/**
 * Configures security settings and headers
 */
const configureSecurity = (): void => {
  // Validate API and WebSocket URLs
  if (!API_URL || !WS_URL) {
    throw new Error('Required environment variables are not configured');
  }

  // Set security headers if not in development
  if (ENV !== 'development') {
    // Content Security Policy
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = `
      default-src 'self';
      connect-src ${API_URL} ${WS_URL};
      img-src 'self' data: https:;
      style-src 'self' 'unsafe-inline';
      script-src 'self';
    `;
    document.head.appendChild(meta);
  }
};

/**
 * Renders the root application with all required providers and configurations
 */
const renderApp = (): void => {
  // Initialize monitoring and security
  initializeMonitoring();
  configureSecurity();

  // Get root element
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);
  if (!rootElement) {
    throw new Error(`Root element with id '${ROOT_ELEMENT_ID}' not found`);
  }

  // Create React root
  const root = ReactDOM.createRoot(rootElement);

  // Error handler for error boundary
  const handleError = (error: Error, info: { componentStack: string }) => {
    console.error('Application Error:', error);
    console.error('Component Stack:', info.componentStack);

    if (ENV === 'production') {
      // Report error to monitoring service
      // errorReportingService.captureError(error, info);
    }
  };

  // Render application with providers
  root.render(
    <React.StrictMode>
      <ErrorBoundary
        fallback={
          <div>
            <h1>Something went wrong</h1>
            <p>Please refresh the page or contact support if the problem persists.</p>
          </div>
        }
        onError={handleError}
      >
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            {/* Apply CSS baseline reset */}
            <CssBaseline />
            
            {/* Main application component */}
            <App />
          </ThemeProvider>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Initialize and render application
renderApp();

// Enable hot module replacement in development
if (ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}