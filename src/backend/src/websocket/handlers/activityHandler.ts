/**
 * @fileoverview WebSocket handler for managing real-time activity events in the multi-tenant CRM system.
 * Implements secure subscription management, real-time broadcasts, and tenant-specific activity monitoring.
 * @version 1.0.0
 */

import { Socket } from 'socket.io'; // ^4.x
import { Types } from 'mongoose'; // ^7.x
import { RateLimiter } from 'rate-limiter-flexible'; // ^2.x
import { ActivityService } from '../../services/ActivityService';
import { IActivity, ActivityType } from '../../interfaces/IActivity';
import logger from '../../utils/logger';

/**
 * Interface for tenant-specific subscription tracking
 */
interface TenantSubscriptions {
  [leadId: string]: Set<string>; // Set of socket IDs
}

/**
 * Class handling WebSocket activity events with tenant isolation and security measures
 */
export class ActivityHandler {
  private _activityService: ActivityService;
  private _tenantSubscriptions: Map<string, TenantSubscriptions>;
  private _rateLimiter: RateLimiter;

  /**
   * Initializes the activity handler with required services and security measures
   * @param activityService - Service for managing activity records
   * @param rateLimiter - Rate limiter for tenant-specific connections
   */
  constructor(activityService: ActivityService, rateLimiter: RateLimiter) {
    this._activityService = activityService;
    this._tenantSubscriptions = new Map();
    this._rateLimiter = rateLimiter;
  }

  /**
   * Handles new WebSocket connections with tenant context and security validation
   * @param socket - Socket.io socket instance
   * @param tenantId - Tenant identifier
   */
  async handleConnection(socket: Socket, tenantId: Types.ObjectId): Promise<void> {
    try {
      logger.info('New WebSocket connection established', {
        socketId: socket.id,
        tenantId: tenantId.toString()
      });

      // Set up event listeners with tenant context
      socket.on('subscribe', async (leadId: string) => {
        try {
          await this.handleSubscribe(socket, new Types.ObjectId(leadId), tenantId);
        } catch (error) {
          logger.error('Subscription error', {
            error: error.message,
            socketId: socket.id,
            tenantId: tenantId.toString(),
            leadId
          });
          socket.emit('error', { message: 'Subscription failed' });
        }
      });

      socket.on('unsubscribe', async (leadId: string) => {
        try {
          await this.handleUnsubscribe(socket, leadId, tenantId);
        } catch (error) {
          logger.error('Unsubscribe error', {
            error: error.message,
            socketId: socket.id,
            tenantId: tenantId.toString(),
            leadId
          });
        }
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket, tenantId);
      });

    } catch (error) {
      logger.error('Connection handler error', {
        error: error.message,
        socketId: socket.id,
        tenantId: tenantId.toString()
      });
      socket.disconnect(true);
    }
  }

  /**
   * Handles lead activity subscriptions with tenant validation
   * @param socket - Socket.io socket instance
   * @param leadId - Lead identifier
   * @param tenantId - Tenant identifier
   */
  private async handleSubscribe(
    socket: Socket,
    leadId: Types.ObjectId,
    tenantId: Types.ObjectId
  ): Promise<void> {
    try {
      // Apply rate limiting per tenant
      await this._rateLimiter.consume(tenantId.toString());

      // Initialize tenant subscriptions if not exists
      if (!this._tenantSubscriptions.has(tenantId.toString())) {
        this._tenantSubscriptions.set(tenantId.toString(), {});
      }

      const tenantSubs = this._tenantSubscriptions.get(tenantId.toString())!;
      
      // Initialize lead subscriptions if not exists
      if (!tenantSubs[leadId.toString()]) {
        tenantSubs[leadId.toString()] = new Set();
      }

      // Add socket to lead subscriptions
      tenantSubs[leadId.toString()].add(socket.id);

      // Join tenant-specific room
      const roomName = `tenant:${tenantId}:lead:${leadId}`;
      await socket.join(roomName);

      // Fetch initial activities
      const activities = await this._activityService.getLeadActivities(
        leadId,
        tenantId,
        { page: 1, limit: 50 }
      );

      // Send initial activities to subscriber
      socket.emit('activities', activities.data);

      logger.info('Lead subscription successful', {
        socketId: socket.id,
        tenantId: tenantId.toString(),
        leadId: leadId.toString()
      });

    } catch (error) {
      logger.error('Subscription handler error', {
        error: error.message,
        socketId: socket.id,
        tenantId: tenantId.toString(),
        leadId: leadId.toString()
      });
      throw error;
    }
  }

  /**
   * Handles unsubscription from lead activities
   * @param socket - Socket.io socket instance
   * @param leadId - Lead identifier
   * @param tenantId - Tenant identifier
   */
  private async handleUnsubscribe(
    socket: Socket,
    leadId: string,
    tenantId: Types.ObjectId
  ): Promise<void> {
    try {
      const tenantSubs = this._tenantSubscriptions.get(tenantId.toString());
      if (tenantSubs && tenantSubs[leadId]) {
        tenantSubs[leadId].delete(socket.id);
        
        // Remove lead subscriptions if empty
        if (tenantSubs[leadId].size === 0) {
          delete tenantSubs[leadId];
        }

        // Leave tenant-specific room
        const roomName = `tenant:${tenantId}:lead:${leadId}`;
        await socket.leave(roomName);

        logger.info('Lead unsubscription successful', {
          socketId: socket.id,
          tenantId: tenantId.toString(),
          leadId
        });
      }
    } catch (error) {
      logger.error('Unsubscribe handler error', {
        error: error.message,
        socketId: socket.id,
        tenantId: tenantId.toString(),
        leadId
      });
      throw error;
    }
  }

  /**
   * Handles socket disconnection and cleanup
   * @param socket - Socket.io socket instance
   * @param tenantId - Tenant identifier
   */
  private handleDisconnect(socket: Socket, tenantId: Types.ObjectId): void {
    try {
      const tenantSubs = this._tenantSubscriptions.get(tenantId.toString());
      if (tenantSubs) {
        // Remove socket from all lead subscriptions
        Object.keys(tenantSubs).forEach(leadId => {
          tenantSubs[leadId].delete(socket.id);
          if (tenantSubs[leadId].size === 0) {
            delete tenantSubs[leadId];
          }
        });

        // Remove tenant subscriptions if empty
        if (Object.keys(tenantSubs).length === 0) {
          this._tenantSubscriptions.delete(tenantId.toString());
        }
      }

      logger.info('Socket disconnected', {
        socketId: socket.id,
        tenantId: tenantId.toString()
      });
    } catch (error) {
      logger.error('Disconnect handler error', {
        error: error.message,
        socketId: socket.id,
        tenantId: tenantId.toString()
      });
    }
  }

  /**
   * Broadcasts activity updates to subscribed clients with tenant isolation
   * @param leadId - Lead identifier
   * @param tenantId - Tenant identifier
   * @param activity - Activity data to broadcast
   */
  async broadcastActivity(
    leadId: Types.ObjectId,
    tenantId: Types.ObjectId,
    activity: IActivity
  ): Promise<void> {
    try {
      // Apply rate limiting for broadcasts
      await this._rateLimiter.consume(`broadcast:${tenantId.toString()}`);

      // Broadcast to tenant-specific room
      const roomName = `tenant:${tenantId}:lead:${leadId}`;
      const eventName = `activity.${activity.type.toLowerCase()}`;
      
      global.io.to(roomName).emit(eventName, activity);

      logger.info('Activity broadcast successful', {
        tenantId: tenantId.toString(),
        leadId: leadId.toString(),
        activityType: activity.type
      });
    } catch (error) {
      logger.error('Broadcast error', {
        error: error.message,
        tenantId: tenantId.toString(),
        leadId: leadId.toString(),
        activityType: activity.type
      });
      throw error;
    }
  }
}

export default ActivityHandler;