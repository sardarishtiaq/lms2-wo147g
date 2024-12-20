/**
 * @fileoverview Service class implementing core lead management functionality for the multi-tenant CRM system.
 * Provides comprehensive lead tracking, categorization, and pipeline management with tenant isolation.
 * @version 1.0.0
 */

import { Types } from 'mongoose'; // v7.0.0
import { EventEmitter } from 'events'; // Node.js built-in
import { MetricsClient } from 'datadog-metrics'; // v1.0.0
import { CacheService } from 'redis-cache-service'; // v2.0.0
import { TenantContext } from '@company/tenant-context'; // v1.0.0

import Lead from '../db/models/Lead';
import { ILead, ILeadDocument } from '../interfaces/ILead';
import { ActivityService } from './ActivityService';
import { LeadCategory } from '../constants/leadCategories';
import logger from '../utils/logger';

/**
 * Interface for lead creation options
 */
interface CreateLeadOptions {
  skipValidation?: boolean;
  priority?: number;
  assignToAgent?: Types.ObjectId;
}

/**
 * Interface for lead update options
 */
interface UpdateLeadOptions {
  validateTransition?: boolean;
  createActivity?: boolean;
  notifyAssignee?: boolean;
}

/**
 * Service class implementing lead management business logic with tenant isolation,
 * caching, and monitoring capabilities.
 */
@Injectable()
@Monitored()
export class LeadService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'lead:';
  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly _activityService: ActivityService,
    private readonly _eventEmitter: EventEmitter,
    private readonly _cacheService: CacheService,
    private readonly _tenantContext: TenantContext,
    private readonly _metricsClient: MetricsClient
  ) {
    // Initialize event handlers
    this._eventEmitter.on('error', (error: Error) => {
      logger.error('Event emitter error:', { error: error.message });
    });
  }

  /**
   * Creates a new lead with tenant isolation and validation
   * @param tenantId - Tenant identifier
   * @param leadData - Lead data to create
   * @param options - Creation options
   * @returns Created lead document
   */
  async createLead(
    tenantId: Types.ObjectId,
    leadData: Partial<ILead>,
    options: CreateLeadOptions = {}
  ): Promise<ILeadDocument> {
    try {
      logger.debug('Creating lead:', { tenantId, leadData });

      // Validate tenant context
      await this._tenantContext.validateTenant(tenantId);

      // Start performance tracking
      const startTime = Date.now();

      // Initialize lead data with tenant context
      const lead = new Lead({
        ...leadData,
        tenantId,
        category: LeadCategory.UNASSIGNED,
        status: 'ACTIVE',
        priority: options.priority || 3,
        assignedTo: options.assignToAgent,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Validate lead data unless explicitly skipped
      if (!options.skipValidation) {
        await lead.validate();
      }

      // Save lead with retry mechanism
      let savedLead: ILeadDocument | null = null;
      let attempts = 0;

      while (attempts < this.MAX_RETRIES && !savedLead) {
        try {
          savedLead = await lead.save();
        } catch (error) {
          attempts++;
          if (attempts === this.MAX_RETRIES) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (!savedLead) {
        throw new Error('Failed to create lead after maximum retries');
      }

      // Create activity record
      await this._activityService.createActivity(
        tenantId,
        savedLead._id,
        leadData.createdBy as Types.ObjectId,
        'LEAD_CREATED',
        'Lead created',
        { category: savedLead.category }
      );

      // Cache the new lead
      await this._cacheService.set(
        `${this.CACHE_PREFIX}${savedLead._id}`,
        savedLead,
        this.CACHE_TTL
      );

      // Emit lead created event
      this._eventEmitter.emit('lead.created', {
        tenantId,
        leadId: savedLead._id,
        category: savedLead.category
      });

      // Track metrics
      this._metricsClient.increment('lead.created', 1, [`tenant:${tenantId}`]);
      this._metricsClient.timing(
        'lead.create.duration',
        Date.now() - startTime,
        [`tenant:${tenantId}`]
      );

      logger.info('Lead created successfully:', {
        leadId: savedLead._id,
        tenantId
      });

      return savedLead;
    } catch (error) {
      logger.error('Error creating lead:', {
        error: error.message,
        tenantId,
        leadData
      });
      throw error;
    }
  }

  /**
   * Updates lead category with validation and activity tracking
   * @param tenantId - Tenant identifier
   * @param leadId - Lead identifier
   * @param newCategory - New category to assign
   * @param options - Update options
   * @returns Updated lead document
   */
  async updateLeadCategory(
    tenantId: Types.ObjectId,
    leadId: Types.ObjectId,
    newCategory: LeadCategory,
    options: UpdateLeadOptions = {}
  ): Promise<ILeadDocument> {
    try {
      logger.debug('Updating lead category:', { tenantId, leadId, newCategory });

      // Validate tenant context
      await this._tenantContext.validateTenant(tenantId);

      // Start performance tracking
      const startTime = Date.now();

      // Try cache first
      const cachedLead = await this._cacheService.get(`${this.CACHE_PREFIX}${leadId}`);
      let lead = cachedLead as ILeadDocument;

      // Fetch from database if not in cache
      if (!lead) {
        lead = await Lead.findOne({ _id: leadId, tenantId });
        if (!lead) {
          throw new Error('Lead not found');
        }
      }

      // Validate category transition if required
      if (options.validateTransition) {
        const isValidTransition = await Lead.updateCategory(
          leadId,
          newCategory,
          lead.modifiedBy as Types.ObjectId
        );
        if (!isValidTransition) {
          throw new Error('Invalid category transition');
        }
      }

      // Update category
      const previousCategory = lead.category;
      lead.category = newCategory;
      lead.updatedAt = new Date();

      // Save with retry mechanism
      let updatedLead: ILeadDocument | null = null;
      let attempts = 0;

      while (attempts < this.MAX_RETRIES && !updatedLead) {
        try {
          updatedLead = await lead.save();
        } catch (error) {
          attempts++;
          if (attempts === this.MAX_RETRIES) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (!updatedLead) {
        throw new Error('Failed to update lead after maximum retries');
      }

      // Create activity record if requested
      if (options.createActivity) {
        await this._activityService.createActivity(
          tenantId,
          leadId,
          lead.modifiedBy as Types.ObjectId,
          'CATEGORY_CHANGED',
          `Category updated from ${previousCategory} to ${newCategory}`,
          {
            previousCategory,
            newCategory
          }
        );
      }

      // Update cache
      await this._cacheService.set(
        `${this.CACHE_PREFIX}${leadId}`,
        updatedLead,
        this.CACHE_TTL
      );

      // Emit category updated event
      this._eventEmitter.emit('lead.categoryUpdated', {
        tenantId,
        leadId,
        previousCategory,
        newCategory
      });

      // Track metrics
      this._metricsClient.increment('lead.category.updated', 1, [
        `tenant:${tenantId}`,
        `category:${newCategory}`
      ]);
      this._metricsClient.timing(
        'lead.category.update.duration',
        Date.now() - startTime,
        [`tenant:${tenantId}`]
      );

      logger.info('Lead category updated successfully:', {
        leadId,
        tenantId,
        previousCategory,
        newCategory
      });

      return updatedLead;
    } catch (error) {
      logger.error('Error updating lead category:', {
        error: error.message,
        tenantId,
        leadId,
        newCategory
      });
      throw error;
    }
  }

  /**
   * Retrieves lead by ID with tenant isolation and caching
   * @param tenantId - Tenant identifier
   * @param leadId - Lead identifier
   * @returns Lead document
   */
  async getLeadById(
    tenantId: Types.ObjectId,
    leadId: Types.ObjectId
  ): Promise<ILeadDocument> {
    try {
      logger.debug('Fetching lead:', { tenantId, leadId });

      // Validate tenant context
      await this._tenantContext.validateTenant(tenantId);

      // Try cache first
      const cachedLead = await this._cacheService.get(`${this.CACHE_PREFIX}${leadId}`);
      if (cachedLead) {
        return cachedLead as ILeadDocument;
      }

      // Fetch from database
      const lead = await Lead.findOne({ _id: leadId, tenantId });
      if (!lead) {
        throw new Error('Lead not found');
      }

      // Cache the result
      await this._cacheService.set(
        `${this.CACHE_PREFIX}${leadId}`,
        lead,
        this.CACHE_TTL
      );

      return lead;
    } catch (error) {
      logger.error('Error fetching lead:', {
        error: error.message,
        tenantId,
        leadId
      });
      throw error;
    }
  }
}

export default LeadService;