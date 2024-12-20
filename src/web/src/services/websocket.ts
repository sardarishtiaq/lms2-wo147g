import { io, Socket } from 'socket.io-client'; // socket.io-client ^4.0.0

// Constants for WebSocket events
export const WEBSOCKET_EVENTS = {
  CONNECT: 'websocket:connect',
  DISCONNECT: 'websocket:disconnect',
  ERROR: 'websocket:error',
  LEAD_UPDATED: 'lead:updated',
  QUOTE_UPDATED: 'quote:updated',
  ACTIVITY_CREATED: 'activity:created',
  HEARTBEAT: 'websocket:heartbeat',
  RECONNECT: 'websocket:reconnect',
  TENANT_EVENT: 'tenant:event'
} as const;

// Default configuration for WebSocket
export const DEFAULT_CONFIG = {
  url: process.env.REACT_APP_WS_URL || 'ws://localhost:3000',
  options: {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    timeout: 10000,
    transports: ['websocket', 'polling'],
    query: { version: '1.0.0' }
  }
} as const;

// Interface definitions
export interface WebSocketConfig {
  url: string;
  options: {
    autoConnect: boolean;
    reconnection: boolean;
    reconnectionAttempts: number;
    reconnectionDelay: number;
    timeout: number;
    auth?: { token: string; tenantId: string };
    transports: string[];
    query: { version: string };
  };
}

export interface WebSocketError {
  code: string;
  message: string;
  timestamp: Date;
  context?: { event?: string; data?: any };
  retryable: boolean;
}

export interface WebSocketEventHandler {
  event: string;
  handler: (data: any) => void;
  options: {
    tenant: string;
    priority: number;
  };
}

export interface SubscribeOptions {
  tenant?: string;
  priority?: number;
}

/**
 * WebSocketService - Manages real-time communication with tenant isolation
 * Provides secure WebSocket connections with automatic reconnection and comprehensive event handling
 */
export class WebSocketService {
  private _socket: Socket | null = null;
  private _config: WebSocketConfig;
  private _eventHandlers: Map<string, Set<Function>> = new Map();
  private _connected: boolean = false;
  private _reconnectAttempts: number = 0;
  private _tenantId: string = '';
  private _heartbeatInterval: NodeJS.Timeout | null = null;
  private _connectionTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this._config = {
      ...DEFAULT_CONFIG,
      ...config,
      options: {
        ...DEFAULT_CONFIG.options,
        ...config.options
      }
    };
    this._initializeEventHandlers();
  }

  /**
   * Establishes an authenticated WebSocket connection with tenant context
   * @param token - Authentication token
   * @param tenantId - Tenant identifier for isolation
   */
  public async connect(token: string, tenantId: string): Promise<void> {
    if (this._connected) {
      return;
    }

    if (!token || !tenantId) {
      throw new Error('Authentication token and tenant ID are required');
    }

    this._tenantId = tenantId;
    this._config.options.auth = { token, tenantId };

    return new Promise((resolve, reject) => {
      try {
        this._socket = io(this._config.url, this._config.options);
        this._setupConnectionHandlers(resolve, reject);
        this._startConnectionTimeout();
      } catch (error) {
        reject(this._createError('CONNECTION_ERROR', error));
      }
    });
  }

  /**
   * Safely disconnects the WebSocket connection and performs cleanup
   */
  public async disconnect(): Promise<void> {
    if (!this._connected || !this._socket) {
      return;
    }

    return new Promise((resolve) => {
      this._clearHeartbeat();
      this._clearConnectionTimeout();
      this._eventHandlers.clear();
      
      if (this._socket) {
        this._socket.once('disconnect', () => {
          this._connected = false;
          this._socket = null;
          this._tenantId = '';
          resolve();
        });
        
        this._socket.disconnect();
      } else {
        resolve();
      }
    });
  }

  /**
   * Subscribes to WebSocket events with tenant isolation
   * @param event - Event name to subscribe to
   * @param handler - Event handler function
   * @param options - Subscription options including tenant and priority
   */
  public subscribe(
    event: string,
    handler: (data: any) => void,
    options: SubscribeOptions = {}
  ): () => void {
    if (!event || typeof handler !== 'function') {
      throw new Error('Event name and handler function are required');
    }

    const eventHandler = this._wrapEventHandler(handler, options);
    const handlers = this._eventHandlers.get(event) || new Set();
    handlers.add(eventHandler);
    this._eventHandlers.set(event, handlers);

    if (this._socket) {
      this._socket.on(event, eventHandler);
    }

    return () => this._unsubscribe(event, eventHandler);
  }

  /**
   * Emits an event through the WebSocket connection
   * @param event - Event name to emit
   * @param data - Data to send with the event
   */
  public emit(event: string, data: any): void {
    if (!this._connected || !this._socket) {
      throw new Error('WebSocket is not connected');
    }

    this._socket.emit(event, {
      tenantId: this._tenantId,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Checks if the WebSocket connection is currently established
   */
  public isConnected(): boolean {
    return this._connected && !!this._socket?.connected;
  }

  private _initializeEventHandlers(): void {
    this._eventHandlers = new Map();
  }

  private _setupConnectionHandlers(
    resolve: (value: void) => void,
    reject: (reason: any) => void
  ): void {
    if (!this._socket) {
      reject(new Error('Socket instance not initialized'));
      return;
    }

    this._socket.on('connect', () => {
      this._connected = true;
      this._reconnectAttempts = 0;
      this._startHeartbeat();
      this._clearConnectionTimeout();
      resolve();
    });

    this._socket.on('connect_error', (error) => {
      this._handleConnectionError(error, reject);
    });

    this._socket.on('disconnect', (reason) => {
      this._handleDisconnect(reason);
    });

    this._socket.on('error', (error) => {
      this._handleError(error);
    });
  }

  private _handleConnectionError(error: Error, reject: (reason: any) => void): void {
    this._reconnectAttempts++;
    if (this._reconnectAttempts >= this._config.options.reconnectionAttempts) {
      reject(this._createError('MAX_RECONNECTION_ATTEMPTS', error));
    }
  }

  private _handleDisconnect(reason: string): void {
    this._connected = false;
    this._clearHeartbeat();
    
    if (reason === 'io server disconnect') {
      // Server initiated disconnect, don't reconnect
      this._socket?.close();
    }
  }

  private _handleError(error: any): void {
    const wsError = this._createError('SOCKET_ERROR', error);
    this.emit(WEBSOCKET_EVENTS.ERROR, wsError);
  }

  private _startHeartbeat(): void {
    this._clearHeartbeat();
    this._heartbeatInterval = setInterval(() => {
      if (this._connected && this._socket) {
        this._socket.emit(WEBSOCKET_EVENTS.HEARTBEAT, {
          tenantId: this._tenantId,
          timestamp: new Date().toISOString()
        });
      }
    }, 30000); // 30 seconds interval
  }

  private _startConnectionTimeout(): void {
    this._clearConnectionTimeout();
    this._connectionTimeout = setTimeout(() => {
      if (!this._connected) {
        this.disconnect();
      }
    }, this._config.options.timeout);
  }

  private _clearHeartbeat(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  private _clearConnectionTimeout(): void {
    if (this._connectionTimeout) {
      clearTimeout(this._connectionTimeout);
      this._connectionTimeout = null;
    }
  }

  private _wrapEventHandler(
    handler: (data: any) => void,
    options: SubscribeOptions
  ): (data: any) => void {
    return (data: any) => {
      // Ensure tenant isolation
      if (options.tenant && data.tenantId !== options.tenant) {
        return;
      }
      handler(data);
    };
  }

  private _unsubscribe(event: string, handler: Function): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this._eventHandlers.delete(event);
      }
    }

    if (this._socket) {
      this._socket.off(event, handler as any);
    }
  }

  private _createError(code: string, error: any): WebSocketError {
    return {
      code,
      message: error.message || 'WebSocket error occurred',
      timestamp: new Date(),
      context: error.context,
      retryable: code !== 'MAX_RECONNECTION_ATTEMPTS'
    };
  }
}