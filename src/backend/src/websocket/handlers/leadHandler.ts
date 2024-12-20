/**
 * @fileoverview WebSocket handler for managing real-time lead events and updates in the multi-tenant CRM system.
 * Implements comprehensive tenant isolation, subscription management, and real-time event broadcasting.
 * @version 1.0.0
 */

import { Socket } from 'socket.io'; // ^4.x
import { Types } from 'mongoose'; // ^7.0.0
import { ILead } from '../../interfaces/ILead';
import { LeadService } from '../../services/LeadService';
import logger from '../../utils/logger';

/**
 * Interface for subscription tracking with tenant isolation
 */
interface SubscriptionMap {
  [tenantId: string]: {
    [leadId: string]: Set<Socket>;
  };
}

/**
 * Class handling WebSocket events for lead management with tenant isolation
 */
export class LeadHandler {
  private readonly _leadService: LeadService;
  private readonly _subscriptions: SubscriptionMap;
  private readonly _tenantSubscriptionCounts: Map<string, number>;
  private readonly MAX_SUBSCRIPTIONS_PER_TENANT = 1000;
  private readonly MAX_RETRIES = 3;

  constructor(leadService: LeadService) {
    this._leadService = leadService;
    this._subscriptions = {};
    this._tenantSubscriptionCounts = new Map();
  }

  /**
   * Handles real-time lead updates with tenant isolation
   */
  async handleLeadUpdate(
    socket: Socket,
    tenantId: Types.ObjectId,
    leadId: Types.ObjectId,
    updateData: Partial<ILead>
  ): Promise<void> {
    try {
      logger.debug('Processing lead update:', { tenantId, leadId });

      // Validate tenant access
      await this._leadService.validateTenantAccess(tenantId, socket.data.userId);

      let attempts = 0;
      let success = false;

      while (attempts < this.MAX_RETRIES && !success) {
        try {
          // Update lead with tenant context
          const updatedLead = await this._leadService.updateLead(
            tenantId,
            leadId,
            updateData,
            { validateTransition: true, createActivity: true }
          );

          // Broadcast update to subscribed clients
          this.broadcastLeadUpdate(tenantId, leadId, updatedLead);
          success = true;

          logger.info('Lead update successful:', { tenantId, leadId });
        } catch (error) {
          attempts++;
          if (attempts === this.MAX_RETRIES) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    } catch (error) {
      logger.error('Lead update failed:', {
        error: error.message,
        tenantId,
        leadId
      });
      socket.emit('lead:updateError', {
        message: 'Failed to update lead',
        leadId
      });
    }
  }

  /**
   * Handles lead assignment events with tenant isolation
   */
  async handleLeadAssignment(
    socket: Socket,
    tenantId: Types.ObjectId,
    leadId: Types.ObjectId,
    assigneeId: Types.ObjectId
  ): Promise<void> {
    try {
      logger.debug('Processing lead assignment:', {
        tenantId,
        leadId,
        assigneeId
      });

      // Validate tenant access
      await this._leadService.validateTenantAccess(tenantId, socket.data.userId);

      const updatedLead = await this._leadService.assignLead(
        tenantId,
        leadId,
        assigneeId,
        { notifyAssignee: true }
      );

      // Broadcast assignment to subscribed clients
      this.broadcastLeadUpdate(tenantId, leadId, updatedLead);

      logger.info('Lead assignment successful:', {
        tenantId,
        leadId,
        assigneeId
      });
    } catch (error) {
      logger.error('Lead assignment failed:', {
        error: error.message,
        tenantId,
        leadId
      });
      socket.emit('lead:assignmentError', {
        message: 'Failed to assign lead',
        leadId
      });
    }
  }

  /**
   * Handles lead category updates with validation
   */
  async handleCategoryUpdate(
    socket: Socket,
    tenantId: Types.ObjectId,
    leadId: Types.ObjectId,
    newCategory: string
  ): Promise<void> {
    try {
      logger.debug('Processing category update:', {
        tenantId,
        leadId,
        category: newCategory
      });

      // Validate tenant access
      await this._leadService.validateTenantAccess(tenantId, socket.data.userId);

      const updatedLead = await this._leadService.updateLeadCategory(
        tenantId,
        leadId,
        newCategory,
        { validateTransition: true, createActivity: true }
      );

      // Broadcast category update to subscribed clients
      this.broadcastLeadUpdate(tenantId, leadId, updatedLead);

      logger.info('Category update successful:', {
        tenantId,
        leadId,
        category: newCategory
      });
    } catch (error) {
      logger.error('Category update failed:', {
        error: error.message,
        tenantId,
        leadId
      });
      socket.emit('lead:categoryError', {
        message: 'Failed to update category',
        leadId
      });
    }
  }

  /**
   * Manages lead subscriptions with tenant isolation
   */
  async subscribeToLead(
    socket: Socket,
    tenantId: Types.ObjectId,
    leadId: Types.ObjectId
  ): Promise<void> {
    try {
      // Validate tenant subscription limits
      const currentCount = this._tenantSubscriptionCounts.get(tenantId.toString()) || 0;
      if (currentCount >= this.MAX_SUBSCRIPTIONS_PER_TENANT) {
        throw new Error('Maximum subscription limit reached for tenant');
      }

      // Initialize tenant subscription structure if needed
      if (!this._subscriptions[tenantId.toString()]) {
        this._subscriptions[tenantId.toString()] = {};
      }

      // Initialize lead subscription set if needed
      const tenantSubs = this._subscriptions[tenantId.toString()];
      if (!tenantSubs[leadId.toString()]) {
        tenantSubs[leadId.toString()] = new Set();
      }

      // Add socket to subscribers
      tenantSubs[leadId.toString()].add(socket);

      // Update subscription count
      this._tenantSubscriptionCounts.set(
        tenantId.toString(),
        currentCount + 1
      );

      // Handle cleanup on disconnect
      socket.on('disconnect', () => {
        this.unsubscribeFromLead(socket, tenantId, leadId);
      });

      logger.info('Lead subscription successful:', { tenantId, leadId });
    } catch (error) {
      logger.error('Lead subscription failed:', {
        error: error.message,
        tenantId,
        leadId
      });
      socket.emit('lead:subscribeError', {
        message: 'Failed to subscribe to lead',
        leadId
      });
    }
  }

  /**
   * Handles unsubscription from lead updates
   */
  private unsubscribeFromLead(
    socket: Socket,
    tenantId: Types.ObjectId,
    leadId: Types.ObjectId
  ): void {
    try {
      const tenantSubs = this._subscriptions[tenantId.toString()];
      if (tenantSubs?.[leadId.toString()]) {
        // Remove socket from subscribers
        tenantSubs[leadId.toString()].delete(socket);

        // Clean up empty sets
        if (tenantSubs[leadId.toString()].size === 0) {
          delete tenantSubs[leadId.toString()];
        }

        // Update subscription count
        const currentCount = this._tenantSubscriptionCounts.get(tenantId.toString()) || 0;
        this._tenantSubscriptionCounts.set(
          tenantId.toString(),
          Math.max(0, currentCount - 1)
        );

        logger.debug('Lead unsubscription successful:', { tenantId, leadId });
      }
    } catch (error) {
      logger.error('Lead unsubscription failed:', {
        error: error.message,
        tenantId,
        leadId
      });
    }
  }

  /**
   * Broadcasts lead updates to subscribed clients with tenant isolation
   */
  private broadcastLeadUpdate(
    tenantId: Types.ObjectId,
    leadId: Types.ObjectId,
    updatedLead: ILead
  ): void {
    try {
      const tenantSubs = this._subscriptions[tenantId.toString()];
      const subscribers = tenantSubs?.[leadId.toString()];

      if (subscribers) {
        subscribers.forEach(socket => {
          socket.emit('lead:updated', {
            leadId,
            data: updatedLead
          });
        });

        logger.debug('Lead update broadcast successful:', {
          tenantId,
          leadId,
          subscriberCount: subscribers.size
        });
      }
    } catch (error) {
      logger.error('Lead update broadcast failed:', {
        error: error.message,
        tenantId,
        leadId
      });
    }
  }
}

export default LeadHandler;