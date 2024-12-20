import { jest } from '@jest/globals';
import { WEBSOCKET_EVENTS } from '../../src/services/websocket';

/**
 * Interface for WebSocket event data with tenant context
 */
interface WebSocketEventData {
  tenantId: string;
  data: any;
  timestamp: string;
}

/**
 * Interface for error simulation data
 */
interface WebSocketErrorData {
  code: string;
  message: string;
  timestamp: Date;
  context?: any;
  retryable: boolean;
}

/**
 * MockWebSocketService - Test double for WebSocket functionality
 * Provides comprehensive simulation of real-time events with tenant isolation
 */
export class MockWebSocketService {
  private _connected: boolean = false;
  private _currentTenant: string | undefined;
  private _eventHandlers: Map<string, Set<Function>>;
  private _tenantEventHandlers: Map<string, Map<string, Set<Function>>>;
  private _latencySimulation: number = 0;

  // Jest mock functions for verification
  private _connectMock: jest.Mock;
  private _disconnectMock: jest.Mock;
  private _subscribeMock: jest.Mock;
  private _emitMock: jest.Mock;
  private _errorMock: jest.Mock;

  constructor() {
    // Initialize mock functions
    this._connectMock = jest.fn();
    this._disconnectMock = jest.fn();
    this._subscribeMock = jest.fn();
    this._emitMock = jest.fn();
    this._errorMock = jest.fn();

    // Initialize event handler maps
    this._eventHandlers = new Map();
    this._tenantEventHandlers = new Map();
  }

  /**
   * Simulates WebSocket connection with tenant context
   * @param token - Authentication token
   * @param tenantId - Tenant identifier
   */
  public async connect(token: string, tenantId: string): Promise<void> {
    if (!token || !tenantId) {
      throw new Error('Authentication token and tenant ID are required');
    }

    await this.simulateLatency();
    
    this._connectMock(token, tenantId);
    this._connected = true;
    this._currentTenant = tenantId;

    // Trigger connect event handlers
    await this.simulateEvent(WEBSOCKET_EVENTS.CONNECT, { tenantId }, tenantId);
    
    return Promise.resolve();
  }

  /**
   * Simulates WebSocket disconnection
   */
  public async disconnect(): Promise<void> {
    this._disconnectMock();
    
    await this.simulateLatency();

    // Trigger disconnect event handlers
    if (this._currentTenant) {
      await this.simulateEvent(WEBSOCKET_EVENTS.DISCONNECT, {
        tenantId: this._currentTenant
      }, this._currentTenant);
    }

    this._connected = false;
    this._currentTenant = undefined;
    
    return Promise.resolve();
  }

  /**
   * Subscribes to mock WebSocket events with tenant isolation
   * @param event - Event name
   * @param handler - Event handler function
   * @param options - Subscription options with tenant context
   */
  public subscribe(
    event: string,
    handler: (data: any) => void,
    options: { tenant?: string } = {}
  ): () => void {
    this._subscribeMock(event, handler, options);

    if (options.tenant) {
      // Handle tenant-specific subscription
      if (!this._tenantEventHandlers.has(options.tenant)) {
        this._tenantEventHandlers.set(options.tenant, new Map());
      }
      const tenantHandlers = this._tenantEventHandlers.get(options.tenant)!;
      if (!tenantHandlers.has(event)) {
        tenantHandlers.set(event, new Set());
      }
      tenantHandlers.get(event)!.add(handler);
    } else {
      // Handle global subscription
      if (!this._eventHandlers.has(event)) {
        this._eventHandlers.set(event, new Set());
      }
      this._eventHandlers.get(event)!.add(handler);
    }

    // Return unsubscribe function
    return () => {
      if (options.tenant) {
        const tenantHandlers = this._tenantEventHandlers.get(options.tenant);
        if (tenantHandlers?.has(event)) {
          tenantHandlers.get(event)!.delete(handler);
        }
      } else {
        this._eventHandlers.get(event)?.delete(handler);
      }
    };
  }

  /**
   * Simulates WebSocket event emission
   * @param event - Event name to simulate
   * @param data - Event data
   * @param tenantId - Tenant context for isolation
   */
  public async simulateEvent(
    event: string,
    data: any,
    tenantId?: string
  ): Promise<void> {
    if (!this._connected) {
      throw new Error('WebSocket is not connected');
    }

    await this.simulateLatency();

    const eventData: WebSocketEventData = {
      tenantId: tenantId || this._currentTenant || '',
      data,
      timestamp: new Date().toISOString()
    };

    this._emitMock(event, eventData);

    // Trigger tenant-specific handlers
    if (tenantId) {
      const tenantHandlers = this._tenantEventHandlers.get(tenantId);
      tenantHandlers?.get(event)?.forEach(handler => handler(eventData));
    }

    // Trigger global handlers
    this._eventHandlers.get(event)?.forEach(handler => handler(eventData));
  }

  /**
   * Simulates WebSocket errors
   * @param errorType - Type of error to simulate
   * @param errorData - Additional error context
   */
  public async simulateError(
    errorType: string,
    errorData: Partial<WebSocketErrorData> = {}
  ): Promise<void> {
    const error: WebSocketErrorData = {
      code: errorType,
      message: errorData.message || 'Mock WebSocket error',
      timestamp: new Date(),
      context: errorData.context,
      retryable: errorData.retryable ?? true
    };

    this._errorMock(error);
    await this.simulateEvent(WEBSOCKET_EVENTS.ERROR, error, this._currentTenant);
  }

  /**
   * Sets artificial latency for response simulation
   * @param milliseconds - Latency duration
   */
  public setLatency(milliseconds: number): void {
    if (milliseconds < 0) {
      throw new Error('Latency must be a non-negative number');
    }
    this._latencySimulation = milliseconds;
  }

  /**
   * Checks if mock WebSocket is connected
   */
  public isConnected(): boolean {
    return this._connected;
  }

  /**
   * Gets current tenant context
   */
  public getCurrentTenant(): string | undefined {
    return this._currentTenant;
  }

  /**
   * Gets mock function for connection verification
   */
  public getConnectMock(): jest.Mock {
    return this._connectMock;
  }

  /**
   * Gets mock function for disconnection verification
   */
  public getDisconnectMock(): jest.Mock {
    return this._disconnectMock;
  }

  /**
   * Gets mock function for event emission verification
   */
  public getEmitMock(): jest.Mock {
    return this._emitMock;
  }

  private async simulateLatency(): Promise<void> {
    if (this._latencySimulation > 0) {
      await new Promise(resolve => setTimeout(resolve, this._latencySimulation));
    }
  }
}

/**
 * Creates a pre-configured instance of MockWebSocketService
 */
export function createMockWebSocketService(): MockWebSocketService {
  const service = new MockWebSocketService();
  service.setLatency(0); // Default to no latency
  return service;
}
```

This implementation provides a comprehensive mock of the WebSocket service with the following key features:

1. Full tenant isolation support through tenant-specific event handlers
2. Simulation of connection, disconnection, and error scenarios
3. Configurable latency simulation for testing timing-sensitive scenarios
4. Jest mock functions for verification of WebSocket operations
5. Support for all WebSocket events defined in the original service
6. Type-safe implementation with TypeScript
7. Clean separation of concerns with private helper methods
8. Factory function for easy instantiation with default configuration

The mock service can be used in tests like this:

```typescript
describe('WebSocket Tests', () => {
  let mockWs: MockWebSocketService;

  beforeEach(() => {
    mockWs = createMockWebSocketService();
  });

  it('should handle tenant-specific events', async () => {
    await mockWs.connect('test-token', 'tenant-1');
    const handler = jest.fn();
    
    mockWs.subscribe(WEBSOCKET_EVENTS.LEAD_UPDATED, handler, { tenant: 'tenant-1' });
    await mockWs.simulateEvent(WEBSOCKET_EVENTS.LEAD_UPDATED, { id: '123' }, 'tenant-1');
    
    expect(handler).toHaveBeenCalled();
  });
});