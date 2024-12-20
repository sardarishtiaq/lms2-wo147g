import { Middleware } from '@reduxjs/toolkit';
import { batch } from 'redux-batched-actions';
import { WebSocketService, WEBSOCKET_EVENTS } from '../../services/websocket';

// Performance monitoring decorator
const performanceMonitor = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    const duration = performance.now() - start;
    metricsCollector.recordMetric('websocket_operation_duration', duration);
    return result;
  };
  return descriptor;
};

// Interfaces
export interface WebSocketMiddlewareConfig {
  url: string;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  timeout: number;
  heartbeatInterval: number;
  messageQueueSize: number;
  tenantId: string;
  securityToken: string;
  enableEncryption: boolean;
  compressionLevel: number;
}

export interface WebSocketAction {
  type: string;
  payload: any;
  meta: {
    tenantId: string;
    timestamp: number;
    priority: number;
  };
}

// Action Types
export const WEBSOCKET_ACTIONS = {
  CONNECT: 'websocket/connect',
  DISCONNECT: 'websocket/disconnect',
  MESSAGE_RECEIVED: 'websocket/messageReceived',
  SEND_MESSAGE: 'websocket/sendMessage',
  CONNECTION_ERROR: 'websocket/connectionError',
  TENANT_CHANGED: 'websocket/tenantChanged',
  BATCH_MESSAGES: 'websocket/batchMessages',
  UPDATE_METRICS: 'websocket/updateMetrics',
} as const;

// Connection States
export const WEBSOCKET_STATES = {
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING',
  ERROR: 'ERROR',
} as const;

// Utility class for metrics collection
class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)?.push(value);
  }

  getMetrics(): Record<string, { avg: number; max: number; min: number }> {
    const result: Record<string, { avg: number; max: number; min: number }> = {};
    this.metrics.forEach((values, name) => {
      result[name] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        max: Math.max(...values),
        min: Math.min(...values),
      };
    });
    return result;
  }
}

// Global instances
let wsService: WebSocketService | null = null;
const metricsCollector = new MetricsCollector();

/**
 * Creates a Redux middleware for handling WebSocket connections with tenant isolation
 * @param config WebSocket middleware configuration
 */
export const createWebSocketMiddleware = (
  config: WebSocketMiddlewareConfig
): Middleware => {
  const messageQueue: WebSocketAction[] = [];
  let batchTimeout: NodeJS.Timeout | null = null;

  const processMessageQueue = (store: any) => {
    if (messageQueue.length === 0) return;

    const actions = messageQueue.splice(0, config.messageQueueSize);
    batch(() => {
      actions.forEach(action => store.dispatch(action));
    });
  };

  @performanceMonitor
  const handleWebSocketMessage = (message: any, dispatch: any): void => {
    try {
      // Validate tenant context
      if (message.tenantId !== config.tenantId) {
        console.warn('Received message for different tenant, ignoring');
        return;
      }

      const action: WebSocketAction = {
        type: WEBSOCKET_ACTIONS.MESSAGE_RECEIVED,
        payload: message.data,
        meta: {
          tenantId: message.tenantId,
          timestamp: Date.now(),
          priority: message.priority || 0,
        },
      };

      messageQueue.push(action);

      if (!batchTimeout) {
        batchTimeout = setTimeout(() => {
          batchTimeout = null;
          processMessageQueue(dispatch);
        }, 50); // Batch window of 50ms
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      dispatch({
        type: WEBSOCKET_ACTIONS.CONNECTION_ERROR,
        payload: error,
      });
    }
  };

  return store => next => action => {
    switch (action.type) {
      case WEBSOCKET_ACTIONS.CONNECT:
        if (!wsService) {
          wsService = new WebSocketService({
            url: config.url,
            options: {
              reconnectionAttempts: config.reconnectionAttempts,
              reconnectionDelay: config.reconnectionDelay,
              timeout: config.timeout,
              auth: {
                token: config.securityToken,
                tenantId: config.tenantId,
              },
            },
          });

          // Set up event listeners
          wsService.subscribe(
            WEBSOCKET_EVENTS.LEAD_UPDATED,
            (data) => handleWebSocketMessage(data, store.dispatch),
            { tenant: config.tenantId }
          );

          wsService.subscribe(
            WEBSOCKET_EVENTS.QUOTE_UPDATED,
            (data) => handleWebSocketMessage(data, store.dispatch),
            { tenant: config.tenantId }
          );

          wsService.subscribe(
            WEBSOCKET_EVENTS.ACTIVITY_CREATED,
            (data) => handleWebSocketMessage(data, store.dispatch),
            { tenant: config.tenantId }
          );

          wsService.subscribe(
            WEBSOCKET_EVENTS.CONNECTION_ERROR,
            (error) => {
              store.dispatch({
                type: WEBSOCKET_ACTIONS.CONNECTION_ERROR,
                payload: error,
              });
            }
          );

          wsService.connect(config.securityToken, config.tenantId);
        }
        break;

      case WEBSOCKET_ACTIONS.DISCONNECT:
        if (wsService) {
          wsService.disconnect();
          wsService = null;
        }
        break;

      case WEBSOCKET_ACTIONS.SEND_MESSAGE:
        if (wsService?.isConnected()) {
          wsService.emit(action.payload.event, {
            ...action.payload.data,
            tenantId: config.tenantId,
          });
        }
        break;

      case WEBSOCKET_ACTIONS.TENANT_CHANGED:
        if (wsService) {
          wsService.disconnect().then(() => {
            config.tenantId = action.payload.tenantId;
            store.dispatch({ type: WEBSOCKET_ACTIONS.CONNECT });
          });
        }
        break;

      case WEBSOCKET_ACTIONS.UPDATE_METRICS:
        store.dispatch({
          type: WEBSOCKET_ACTIONS.UPDATE_METRICS,
          payload: metricsCollector.getMetrics(),
        });
        break;
    }

    return next(action);
  };
};

export default createWebSocketMiddleware;