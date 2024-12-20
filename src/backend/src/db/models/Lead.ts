/**
 * @fileoverview Enhanced Mongoose model implementation for lead entities in the CRM system.
 * Provides comprehensive database operations and business logic for the 12-stage pipeline
 * process with tenant isolation, activity tracking, and validation.
 * @version 1.0.0
 */

import { model, Document, Schema, Types, FilterQuery, QueryOptions } from 'mongoose'; // v7.0.0
import { ILead, ILeadDocument } from '../../interfaces/ILead';
import { LeadCategory, getCategoryById, getNextCategory } from '../../constants/leadCategories';
import leadSchema from '../schemas/leadSchema';

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for workload management options
 */
interface WorkloadOptions {
  maxLeadsPerAgent: number;
  priorityWeighting: boolean;
}

/**
 * Decorator for caching frequently accessed queries
 */
function cacheResponse(ttl: number = 300) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `lead:${propertyKey}:${JSON.stringify(args)}`;
      // Implementation would use Redis or similar caching system
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

/**
 * Decorator for tenant validation
 */
function validateTenant() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (tenantId: Types.ObjectId, ...args: any[]) {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }
      return originalMethod.apply(this, [tenantId, ...args]);
    };
    return descriptor;
  };
}

/**
 * Enhanced Lead model class with comprehensive validation and tracking
 */
class LeadModel {
  /**
   * Find leads by tenant and category with pagination
   */
  @cacheResponse(300)
  @validateTenant()
  static async findByTenantAndCategory(
    tenantId: Types.ObjectId,
    category: LeadCategory,
    options: PaginationOptions,
    queryOptions: QueryOptions = {}
  ): Promise<ILeadDocument[]> {
    const filter: FilterQuery<ILeadDocument> = { tenantId };
    
    if (category !== LeadCategory.ALL_LEADS) {
      filter.category = category;
    }

    const query = Lead.find(filter)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .sort({ [options.sortBy || 'createdAt']: options.sortOrder === 'desc' ? -1 : 1 })
      .lean(queryOptions.lean)
      .select(queryOptions.select);

    return query.exec();
  }

  /**
   * Find leads assigned to specific user within tenant
   */
  @validateTenant()
  static async findByTenantAndAssignee(
    tenantId: Types.ObjectId,
    assignedTo: Types.ObjectId,
    options: PaginationOptions,
    workloadOptions: WorkloadOptions
  ): Promise<ILeadDocument[]> {
    const filter: FilterQuery<ILeadDocument> = {
      tenantId,
      assignedTo,
      status: 'ACTIVE'
    };

    // Apply workload limits
    if (workloadOptions.maxLeadsPerAgent) {
      const currentWorkload = await Lead.countDocuments({
        tenantId,
        assignedTo,
        status: 'ACTIVE'
      });

      if (currentWorkload >= workloadOptions.maxLeadsPerAgent) {
        throw new Error('Agent workload limit reached');
      }
    }

    const query = Lead.find(filter)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .sort({ priority: workloadOptions.priorityWeighting ? -1 : 1 })
      .populate('lastActivity.performedBy', 'name email');

    return query.exec();
  }

  /**
   * Update lead category with validation and activity tracking
   */
  static async updateCategory(
    leadId: Types.ObjectId,
    newCategory: LeadCategory,
    modifiedBy: Types.ObjectId
  ): Promise<ILeadDocument> {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Validate category transition
    const currentCategory = getCategoryById(lead.category as LeadCategory);
    const nextCategory = getNextCategory(lead.category as LeadCategory);
    
    if (newCategory !== nextCategory?.id && newCategory !== currentCategory?.id) {
      throw new Error('Invalid category transition');
    }

    // Update category and track activity
    lead.category = newCategory;
    lead.lastActivity = {
      type: 'CATEGORY_CHANGE',
      timestamp: new Date(),
      performedBy: modifiedBy,
      details: {
        fromCategory: currentCategory?.id,
        toCategory: newCategory
      }
    };

    // Save with optimistic locking
    const updatedLead = await lead.save();
    
    // Update search indices (implementation would depend on search service)
    await this.updateSearchIndices(updatedLead);

    return updatedLead;
  }

  /**
   * Private helper to update search indices
   */
  private static async updateSearchIndices(lead: ILeadDocument): Promise<void> {
    // Implementation would update Elasticsearch or similar search service
  }
}

// Create the Mongoose model with the schema
const Lead = model<ILeadDocument>('Lead', leadSchema);

// Add the static methods to the model
Object.assign(Lead, LeadModel);

// Export the enhanced model
export default Lead;

// Export named functions for specific use cases
export const {
  findByTenantAndCategory,
  findByTenantAndAssignee,
  updateCategory
} = LeadModel;