/**
 * @fileoverview Root application component for the multi-tenant CRM system
 * Implements core application structure with providers, routing, and real-time updates
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Internal imports
import MainLayout from './layouts/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import Notification from './components/common/Notification';
import { store, updateTenantContext } from './store';
import theme from './styles/theme';

// Constants
const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';
const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL;
const ERROR_REPORTING_URL = process.env.REACT_APP_ERROR_REPORTING_URL;

/**
 * Root application component that sets up the core application structure
 * Implements providers, routing, error boundaries, and real-time updates
 */
const App: React.FC = React.memo(() => {
  // State for performance monitoring
  const [performanceMetrics, setPerformanceMetrics] = useState({
    initialLoadTime: 0,
    lastInteractionTime: 0
  });

  // Effect for performance monitoring
  useEffect(() => {
    // Record initial load time
    const loadTime = performance.now();
    setPerformanceMetrics(prev => ({
      ...prev,
      initialLoadTime: loadTime
    }));

    // Set up performance observer
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.entryType === 'interaction') {
          setPerformanceMetrics(prev => ({
            ...prev,
            lastInteractionTime: entry.duration
          }));
        }
      });
    });

    observer.observe({ entryTypes: ['interaction'] });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Effect for WebSocket connection
  useEffect(() => {
    if (WEBSOCKET_URL) {
      store.dispatch({
        type: 'websocket/connect',
        payload: {
          url: WEBSOCKET_URL,
          version: APP_VERSION
        }
      });
    }

    return () => {
      store.dispatch({ type: 'websocket/disconnect' });
    };
  }, []);

  // Error handler for error boundary
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log error to error reporting service
    if (ERROR_REPORTING_URL) {
      fetch(ERROR_REPORTING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          errorInfo,
          version: APP_VERSION,
          timestamp: new Date().toISOString()
        })
      }).catch(console.error);
    }
  };

  return (
    <ErrorBoundary onError={handleError}>
      <Provider store={store}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>
            {/* Apply CSS baseline reset */}
            <CssBaseline />

            {/* Main application layout */}
            <MainLayout>
              {/* Global notification system */}
              <Notification />

              {/* Performance monitoring */}
              {process.env.NODE_ENV === 'development' && (
                <div style={{ display: 'none' }}>
                  <span data-testid="initial-load-time">
                    {performanceMetrics.initialLoadTime}
                  </span>
                  <span data-testid="last-interaction-time">
                    {performanceMetrics.lastInteractionTime}
                  </span>
                </div>
              )}
            </MainLayout>
          </ThemeProvider>
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  );
});

// Display name for debugging
App.displayName = 'App';

export default App;