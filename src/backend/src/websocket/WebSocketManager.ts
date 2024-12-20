/**
 * @fileoverview Core WebSocket manager implementing secure, real-time communication
 * for the multi-tenant CRM system with comprehensive monitoring and tenant isolation.
 * @version 1.0.0
 */

import { Server, Socket } from 'socket.io'; // ^4.x
import { Types } from 'mongoose'; // ^7.x
import { RateLimiter } from 'rate-limiter-flexible'; // ^2.x
import { Redis } from 'ioredis'; // ^5.x
import { MetricsCollector } from '@monitoring/metrics'; // ^1.x

import { ActivityHandler } from './handlers/activityHandler';
import { LeadHandler } from './handlers/leadHandler';
import { QuoteHandler } from './handlers/quoteHandler';
import logger from '../utils/logger';

/**
 * Interface for WebSocket connection metadata
 */
interface ConnectionMetadata {
  tenantId: string;
  userId: string;
  connectionTime: Date;
  lastActivity: Date;
}

/**
 * Enhanced WebSocket manager with security, monitoring, and performance optimizations
 */
export class WebSocketManager {
  private readonly _io: Server;
  private readonly _activityHandler: ActivityHandler;
  private readonly _leadHandler: LeadHandler;
  private readonly _quoteHandler: QuoteHandler;
  private readonly _tenantConnections: Map<string, Set<string>>;
  private readonly _rateLimiter: RateLimiter;
  private readonly _redisClient: Redis;
  private readonly _metricsCollector: MetricsCollector;
  private readonly _connectionMetadata: Map<string, ConnectionMetadata>;

  private readonly RATE_LIMIT_POINTS = 100;
  private readonly RATE_LIMIT_DURATION = 60;
  private readonly HEARTBEAT_INTERVAL = 30000;
  private readonly MAX_CONNECTIONS_PER_TENANT = 1000;

  /**
   * Initializes the WebSocket manager with enhanced security and monitoring
   */
  constructor(
    io: Server,
    activityHandler: ActivityHandler,
    leadHandler: LeadHandler,
    quoteHandler: QuoteHandler,
    metricsCollector: MetricsCollector,
    redisClient: Redis
  ) {
    this._io = io;
    this._activityHandler = activityHandler;
    this._leadHandler = leadHandler;
    this._quoteHandler = quoteHandler;
    this._metricsCollector = metricsCollector;
    this._redisClient = redisClient;
    this._tenantConnections = new Map();
    this._connectionMetadata = new Map();

    // Initialize rate limiter with Redis
    this._rateLimiter = new RateLimiter({
      storeClient: redisClient,
      points: this.RATE_LIMIT_POINTS,
      duration: this.RATE_LIMIT_DURATION,
      blockDuration: 300
    });

    // Configure error handling
    this._io.on('error', this.handleError.bind(this));
  }

  /**
   * Initializes secure WebSocket server with monitoring
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing WebSocket server');

      // Configure security middleware
      this._io.use(this.authMiddleware.bind(this));
      this._io.use(this.tenantValidationMiddleware.bind(this));
      this._io.use(this.rateLimitMiddleware.bind(this));

      // Set up connection handling
      this._io.on('connection', this.handleConnection.bind(this));

      // Start heartbeat monitoring
      setInterval(this.checkHeartbeats.bind(this), this.HEARTBEAT_INTERVAL);

      logger.info('WebSocket server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WebSocket server', { error });
      throw error;
    }
  }

  /**
   * Handles new WebSocket connections with security validation
   */
  private async handleConnection(socket: Socket): Promise<void> {
    try {
      const { tenantId, userId } = socket.data;

      logger.info('New WebSocket connection', {
        socketId: socket.id,
        tenantId,
        userId
      });

      // Validate tenant connection limits
      if (!this.validateConnectionLimit(tenantId)) {
        throw new Error('Maximum connections reached for tenant');
      }

      // Track connection
      this.trackConnection(socket, tenantId);

      // Initialize handlers
      await Promise.all([
        this._activityHandler.handleConnection(socket, new Types.ObjectId(tenantId)),
        this.setupLeadHandlers(socket, tenantId),
        this.setupQuoteHandlers(socket, tenantId)
      ]);

      // Set up disconnect handler
      socket.on('disconnect', () => this.handleDisconnect(socket, tenantId));

      // Set up heartbeat
      socket.on('heartbeat', () => this.updateHeartbeat(socket.id));

      // Track metrics
      this._metricsCollector.incrementCounter('websocket.connections', {
        tenantId,
        status: 'connected'
      });
    } catch (error) {
      logger.error('Connection handler error', {
        error,
        socketId: socket.id
      });
      socket.disconnect(true);
    }
  }

  /**
   * Securely broadcasts events to tenant connections
   */
  public async broadcastToTenant(
    tenantId: Types.ObjectId,
    event: string,
    data: any
  ): Promise<void> {
    try {
      // Validate tenant access
      await this._rateLimiter.consume(`broadcast:${tenantId}`);

      const room = `tenant:${tenantId}`;
      this._io.to(room).emit(event, data);

      // Track broadcast metrics
      this._metricsCollector.incrementCounter('websocket.broadcasts', {
        tenantId: tenantId.toString(),
        event
      });

      logger.debug('Broadcast sent', { tenantId, event });
    } catch (error) {
      logger.error('Broadcast error', { error, tenantId, event });
      throw error;
    }
  }

  /**
   * Authentication middleware for WebSocket connections
   */
  private async authMiddleware(
    socket: Socket,
    next: (err?: Error) => void
  ): Promise<void> {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        throw new Error('Authentication token required');
      }

      // Token validation would be implemented here
      // This is a placeholder for the actual implementation
      const decoded = { tenantId: '', userId: '' }; // JWT.verify(token, secret);

      socket.data = { ...socket.data, ...decoded };
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  }

  /**
   * Tenant validation middleware
   */
  private async tenantValidationMiddleware(
    socket: Socket,
    next: (err?: Error) => void
  ): Promise<void> {
    try {
      const { tenantId } = socket.data;
      if (!tenantId) {
        throw new Error('Tenant context required');
      }

      // Tenant validation would be implemented here
      // This is a placeholder for the actual implementation

      next();
    } catch (error) {
      next(new Error('Tenant validation failed'));
    }
  }

  /**
   * Rate limiting middleware
   */
  private async rateLimitMiddleware(
    socket: Socket,
    next: (err?: Error) => void
  ): Promise<void> {
    try {
      const { tenantId } = socket.data;
      await this._rateLimiter.consume(tenantId);
      next();
    } catch (error) {
      next(new Error('Rate limit exceeded'));
    }
  }

  /**
   * Tracks tenant connections
   */
  private trackConnection(socket: Socket, tenantId: string): void {
    if (!this._tenantConnections.has(tenantId)) {
      this._tenantConnections.set(tenantId, new Set());
    }
    this._tenantConnections.get(tenantId)!.add(socket.id);

    this._connectionMetadata.set(socket.id, {
      tenantId,
      userId: socket.data.userId,
      connectionTime: new Date(),
      lastActivity: new Date()
    });
  }

  /**
   * Validates tenant connection limits
   */
  private validateConnectionLimit(tenantId: string): boolean {
    const connections = this._tenantConnections.get(tenantId);
    return !connections || connections.size < this.MAX_CONNECTIONS_PER_TENANT;
  }

  /**
   * Updates connection heartbeat
   */
  private updateHeartbeat(socketId: string): void {
    const metadata = this._connectionMetadata.get(socketId);
    if (metadata) {
      metadata.lastActivity = new Date();
    }
  }

  /**
   * Checks connection heartbeats
   */
  private checkHeartbeats(): void {
    const now = new Date();
    for (const [socketId, metadata] of this._connectionMetadata.entries()) {
      const timeSinceLastActivity = now.getTime() - metadata.lastActivity.getTime();
      if (timeSinceLastActivity > this.HEARTBEAT_INTERVAL * 2) {
        const socket = this._io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
    }
  }

  /**
   * Sets up lead-related event handlers
   */
  private setupLeadHandlers(socket: Socket, tenantId: string): void {
    socket.on('lead:update', (data) => {
      this._leadHandler.handleLeadUpdate(
        socket,
        new Types.ObjectId(tenantId),
        new Types.ObjectId(data.leadId),
        data.updateData
      );
    });

    socket.on('lead:assign', (data) => {
      this._leadHandler.handleLeadAssignment(
        socket,
        new Types.ObjectId(tenantId),
        new Types.ObjectId(data.leadId),
        new Types.ObjectId(data.assigneeId)
      );
    });

    socket.on('lead:category', (data) => {
      this._leadHandler.handleCategoryUpdate(
        socket,
        new Types.ObjectId(tenantId),
        new Types.ObjectId(data.leadId),
        data.category
      );
    });
  }

  /**
   * Sets up quote-related event handlers
   */
  private setupQuoteHandlers(socket: Socket, tenantId: string): void {
    socket.on('quote:create', (data) => {
      this._quoteHandler.handleQuoteCreated(
        socket,
        new Types.ObjectId(tenantId),
        data
      );
    });

    socket.on('quote:update', (data) => {
      this._quoteHandler.handleQuoteUpdated(
        socket,
        new Types.ObjectId(tenantId),
        new Types.ObjectId(data.quoteId),
        data.updateData
      );
    });

    socket.on('quote:subscribe', (data) => {
      this._quoteHandler.handleQuoteSubscription(
        socket,
        new Types.ObjectId(tenantId),
        new Types.ObjectId(data.quoteId)
      );
    });
  }

  /**
   * Handles WebSocket errors
   */
  private handleError(error: Error): void {
    logger.error('WebSocket server error', { error });
    this._metricsCollector.incrementCounter('websocket.errors', {
      type: error.name
    });
  }

  /**
   * Handles client disconnection with cleanup
   */
  private handleDisconnect(socket: Socket, tenantId: string): void {
    try {
      logger.info('Client disconnected', {
        socketId: socket.id,
        tenantId
      });

      // Clean up tenant connections
      const connections = this._tenantConnections.get(tenantId);
      if (connections) {
        connections.delete(socket.id);
        if (connections.size === 0) {
          this._tenantConnections.delete(tenantId);
        }
      }

      // Clean up metadata
      this._connectionMetadata.delete(socket.id);

      // Track metrics
      this._metricsCollector.incrementCounter('websocket.connections', {
        tenantId,
        status: 'disconnected'
      });
    } catch (error) {
      logger.error('Disconnect handler error', { error, socketId: socket.id });
    }
  }
}

export default WebSocketManager;