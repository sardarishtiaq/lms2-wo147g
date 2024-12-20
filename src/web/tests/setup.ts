import { setupServer } from 'msw/node'; // v1.2.0
import { afterAll, afterEach, beforeAll } from '@jest/globals'; // v29.0.0
import '@testing-library/jest-dom'; // v5.16.5

import { handlers } from './mocks/handlers';
import { createMockWebSocketService } from './mocks/websocket';

// Configure MSW server with enhanced error handling and monitoring
export const server = setupServer(...handlers, {
  onUnhandledRequest: 'error',
  delay: process.env.TEST_RESPONSE_DELAY ? parseInt(process.env.TEST_RESPONSE_DELAY) : 0
});

// Initialize tenant-aware WebSocket mock service
export const mockWebSocketService = createMockWebSocketService();

/**
 * Global test environment setup with enhanced error handling and monitoring
 */
beforeAll(async () => {
  // Configure console to capture test output
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalConsoleError.call(console, ...args);
  };

  // Start MSW server with request logging
  server.listen({
    onUnhandledRequest: 'error'
  });

  // Configure global test timeouts
  jest.setTimeout(30000);

  // Configure custom test environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_TENANT = 'test-tenant-id';

  // Configure snapshot serializers
  expect.addSnapshotSerializer({
    test: (val) => typeof val === 'string' && val.includes('data-testid'),
    print: (val) => val.toString()
  });

  // Initialize memory leak detection
  if (process.env.NODE_ENV === 'test') {
    const gc = (global as any).gc;
    if (gc) {
      gc();
    }
  }

  // Configure global error boundary
  const originalError = console.error;
  console.error = (...args) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return;
    }
    originalError.apply(console, args);
  };

  // Initialize performance monitoring
  if (process.env.ENABLE_PERFORMANCE_MONITORING) {
    const { performance, PerformanceObserver } = require('perf_hooks');
    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.duration > 100) {
          console.warn(`Slow test detected: ${entry.name} took ${entry.duration}ms`);
        }
      });
    });
    obs.observe({ entryTypes: ['measure'], buffered: true });
    global.__PERFORMANCE_MONITORING__ = true;
  }
});

/**
 * Reset test state between test runs with enhanced cleanup
 */
afterEach(async () => {
  // Reset MSW request handlers and history
  server.resetHandlers();

  // Clear all mocks
  jest.clearAllMocks();

  // Reset localStorage and sessionStorage
  window.localStorage.clear();
  window.sessionStorage.clear();

  // Reset document body
  document.body.innerHTML = '';

  // Clear all timers
  jest.clearAllTimers();

  // Reset WebSocket mock state
  mockWebSocketService.disconnect();

  // Reset test-specific environment variables
  process.env.TEST_RESPONSE_DELAY = undefined;
  process.env.WS_LATENCY = undefined;

  // Clear any registered event listeners
  const events = document.body.getElementsByTagName('*');
  for (let i = 0; i < events.length; i++) {
    const element = events[i];
    for (const eventType in element) {
      if (eventType.startsWith('on') && element[eventType]) {
        element[eventType] = null;
      }
    }
  }

  // Reset network condition simulations
  if (window.navigator.connection) {
    Object.defineProperty(window.navigator, 'connection', {
      value: undefined,
      configurable: true
    });
  }

  // Clear any pending animations
  const animations = document.getAnimations();
  animations.forEach((animation) => animation.cancel());

  // Reset intersection observer mocks
  if ((global as any).IntersectionObserver) {
    (global as any).IntersectionObserver.mockReset();
  }
});

/**
 * Global test environment cleanup
 */
afterAll(async () => {
  // Stop MSW server and clear request history
  server.close();

  // Close WebSocket connections
  await mockWebSocketService.disconnect();

  // Clear all registered mocks
  jest.resetAllMocks();

  // Clear performance monitoring
  if (global.__PERFORMANCE_MONITORING__) {
    delete global.__PERFORMANCE_MONITORING__;
  }

  // Reset environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_TENANT = undefined;
  process.env.TEST_RESPONSE_DELAY = undefined;
  process.env.WS_LATENCY = undefined;
  process.env.ENABLE_PERFORMANCE_MONITORING = undefined;

  // Clear any remaining timeouts
  jest.useRealTimers();

  // Reset console overrides
  console.error = console.error;
  console.warn = console.warn;

  // Clear memory leak detection
  if (process.env.NODE_ENV === 'test') {
    const gc = (global as any).gc;
    if (gc) {
      gc();
    }
  }
});