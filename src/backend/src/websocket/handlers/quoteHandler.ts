/**
 * @fileoverview WebSocket handler for managing real-time quote events in the multi-tenant CRM system.
 * Implements secure, tenant-isolated quote operations with comprehensive subscription management,
 * rate limiting, and performance monitoring capabilities.
 * @version 1.0.0
 */

import { Socket } from 'socket.io'; // ^4.x
import { Types } from 'mongoose'; // ^7.0.0
import { IQuote, IQuoteDocument } from '../../interfaces/IQuote';
import { QuoteService } from '../../services/QuoteService';
import logger from '../../utils/logger';

/**
 * Interface for rate limiting information
 */
interface RateLimitInfo {
  count: number;
  lastReset: Date;
}

/**
 * Interface for subscription tracking
 */
interface SubscriptionInfo {
  socketId: string;
  userId: string;
  lastActivity: Date;
}

/**
 * Class handling real-time quote operations with tenant isolation and security
 */
export class QuoteHandler {
  private readonly quoteService: QuoteService;
  private readonly subscriptions: Map<string, Map<string, Set<string>>>;
  private readonly rateLimiter: Map<string, RateLimitInfo>;
  private readonly MAX_SUBSCRIPTIONS_PER_TENANT = 1000;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100;

  constructor(quoteService: QuoteService) {
    this.quoteService = quoteService;
    this.subscriptions = new Map(); // tenantId -> quoteId -> Set<socketId>
    this.rateLimiter = new Map();
  }

  /**
   * Handles new quote creation with tenant validation and rate limiting
   * @param socket - WebSocket connection instance
   * @param tenantId - Tenant identifier
   * @param quoteData - Quote data to create
   */
  public async handleQuoteCreated(
    socket: Socket,
    tenantId: Types.ObjectId,
    quoteData: Partial<IQuote>
  ): Promise<void> {
    try {
      // Validate tenant context
      if (!tenantId) {
        throw new Error('Tenant context is required');
      }

      // Check rate limiting
      this.checkRateLimit(tenantId.toString());

      logger.info('Creating quote via WebSocket', {
        tenantId,
        socketId: socket.id,
        userId: socket.data.userId
      });

      // Create quote with tenant context
      const createdQuote = await this.quoteService.createQuote(
        tenantId,
        quoteData.leadId!,
        quoteData,
        { notifyStakeholders: true }
      );

      // Broadcast to tenant room
      socket.to(`tenant:${tenantId}`).emit('quote:created', {
        quoteId: createdQuote._id,
        leadId: createdQuote.leadId,
        status: createdQuote.status
      });

      logger.debug('Quote created and broadcast', {
        quoteId: createdQuote._id,
        tenantId
      });
    } catch (error) {
      logger.error('Error handling quote creation', {
        error,
        tenantId,
        socketId: socket.id
      });
      socket.emit('quote:error', {
        message: 'Failed to create quote',
        error: (error as Error).message
      });
    }
  }

  /**
   * Handles quote updates with enhanced security and validation
   * @param socket - WebSocket connection instance
   * @param tenantId - Tenant identifier
   * @param quoteId - Quote identifier
   * @param updateData - Quote update data
   */
  public async handleQuoteUpdated(
    socket: Socket,
    tenantId: Types.ObjectId,
    quoteId: Types.ObjectId,
    updateData: Partial<IQuote>
  ): Promise<void> {
    try {
      // Check rate limiting
      this.checkRateLimit(tenantId.toString());

      logger.info('Updating quote via WebSocket', {
        tenantId,
        quoteId,
        socketId: socket.id
      });

      // Update quote with tenant context
      const updatedQuote = await this.quoteService.updateQuote(
        tenantId,
        quoteId,
        updateData,
        {
          validateTransition: true,
          notifyStakeholders: true
        }
      );

      // Broadcast to subscribed clients
      this.broadcastQuoteUpdate(tenantId, quoteId, {
        status: updatedQuote.status,
        version: updatedQuote.version,
        lastModifiedBy: socket.data.userId
      });

      logger.debug('Quote updated and broadcast', {
        quoteId,
        tenantId,
        status: updatedQuote.status
      });
    } catch (error) {
      logger.error('Error handling quote update', {
        error,
        tenantId,
        quoteId,
        socketId: socket.id
      });
      socket.emit('quote:error', {
        message: 'Failed to update quote',
        error: (error as Error).message
      });
    }
  }

  /**
   * Manages quote subscriptions with tenant isolation
   * @param socket - WebSocket connection instance
   * @param tenantId - Tenant identifier
   * @param quoteId - Quote identifier
   */
  public async handleQuoteSubscription(
    socket: Socket,
    tenantId: Types.ObjectId,
    quoteId: Types.ObjectId
  ): Promise<void> {
    try {
      logger.debug('Processing quote subscription', {
        tenantId,
        quoteId,
        socketId: socket.id
      });

      // Validate tenant access
      const quote = await this.quoteService.getQuoteById(tenantId, quoteId);
      if (!quote) {
        throw new Error('Quote not found or access denied');
      }

      // Check subscription limits
      if (!this.checkSubscriptionLimit(tenantId.toString())) {
        throw new Error('Subscription limit exceeded for tenant');
      }

      // Add to subscription tracking
      this.addSubscription(tenantId.toString(), quoteId.toString(), socket.id);

      // Join quote-specific room
      socket.join(`quote:${tenantId}:${quoteId}`);

      // Set up unsubscribe handler
      socket.on('disconnect', () => {
        this.removeSubscription(tenantId.toString(), quoteId.toString(), socket.id);
      });

      logger.info('Quote subscription processed', {
        tenantId,
        quoteId,
        socketId: socket.id
      });
    } catch (error) {
      logger.error('Error handling quote subscription', {
        error,
        tenantId,
        quoteId,
        socketId: socket.id
      });
      socket.emit('quote:error', {
        message: 'Failed to subscribe to quote updates',
        error: (error as Error).message
      });
    }
  }

  /**
   * Broadcasts quote updates to subscribed clients
   * @private
   */
  private broadcastQuoteUpdate(
    tenantId: Types.ObjectId,
    quoteId: Types.ObjectId,
    updateData: Partial<IQuote>
  ): void {
    const room = `quote:${tenantId}:${quoteId}`;
    const subscribers = this.getSubscribers(tenantId.toString(), quoteId.toString());

    if (subscribers?.size) {
      logger.debug('Broadcasting quote update', {
        tenantId,
        quoteId,
        subscriberCount: subscribers.size
      });

      this.quoteService.getQuoteById(tenantId, quoteId).then(quote => {
        if (quote) {
          subscribers.forEach(socketId => {
            this.emitQuoteUpdate(socketId, quote, updateData);
          });
        }
      });
    }
  }

  /**
   * Emits quote update to specific socket
   * @private
   */
  private emitQuoteUpdate(
    socketId: string,
    quote: IQuoteDocument,
    updateData: Partial<IQuote>
  ): void {
    const eventData = {
      quoteId: quote._id,
      leadId: quote.leadId,
      status: quote.status,
      version: quote.version,
      updatedAt: quote.updatedAt,
      ...updateData
    };
    this.getSocket(socketId)?.emit('quote:updated', eventData);
  }

  /**
   * Manages rate limiting for quote operations
   * @private
   */
  private checkRateLimit(tenantId: string): boolean {
    const now = new Date();
    let rateInfo = this.rateLimiter.get(tenantId);

    if (!rateInfo || (now.getTime() - rateInfo.lastReset.getTime()) > this.RATE_LIMIT_WINDOW) {
      rateInfo = { count: 0, lastReset: now };
    }

    if (rateInfo.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      throw new Error('Rate limit exceeded');
    }

    rateInfo.count++;
    this.rateLimiter.set(tenantId, rateInfo);
    return true;
  }

  /**
   * Manages subscription tracking and limits
   * @private
   */
  private checkSubscriptionLimit(tenantId: string): boolean {
    const tenantSubs = this.subscriptions.get(tenantId);
    const totalSubs = Array.from(tenantSubs?.values() || [])
      .reduce((total, subs) => total + subs.size, 0);
    return totalSubs < this.MAX_SUBSCRIPTIONS_PER_TENANT;
  }

  /**
   * Adds subscription to tracking
   * @private
   */
  private addSubscription(tenantId: string, quoteId: string, socketId: string): void {
    if (!this.subscriptions.has(tenantId)) {
      this.subscriptions.set(tenantId, new Map());
    }
    const tenantSubs = this.subscriptions.get(tenantId)!;
    
    if (!tenantSubs.has(quoteId)) {
      tenantSubs.set(quoteId, new Set());
    }
    tenantSubs.get(quoteId)!.add(socketId);
  }

  /**
   * Removes subscription from tracking
   * @private
   */
  private removeSubscription(tenantId: string, quoteId: string, socketId: string): void {
    const tenantSubs = this.subscriptions.get(tenantId);
    const quoteSubs = tenantSubs?.get(quoteId);
    
    if (quoteSubs) {
      quoteSubs.delete(socketId);
      if (quoteSubs.size === 0) {
        tenantSubs.delete(quoteId);
      }
    }

    if (tenantSubs?.size === 0) {
      this.subscriptions.delete(tenantId);
    }
  }

  /**
   * Gets subscribers for a specific quote
   * @private
   */
  private getSubscribers(tenantId: string, quoteId: string): Set<string> | undefined {
    return this.subscriptions.get(tenantId)?.get(quoteId);
  }

  /**
   * Gets socket instance by ID
   * @private
   */
  private getSocket(socketId: string): Socket | undefined {
    // Implementation depends on socket.io server instance access
    // This would be implemented based on the actual socket.io setup
    return undefined;
  }
}

export default QuoteHandler;