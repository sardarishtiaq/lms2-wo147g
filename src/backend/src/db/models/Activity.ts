/**
 * @fileoverview Mongoose model implementation for activity records in the CRM system.
 * Provides comprehensive activity tracking with multi-tenant isolation, real-time updates,
 * and advanced querying capabilities.
 * @version 1.0.0
 */

import { model, Model, Types, FilterQuery } from 'mongoose'; // v7.x
import { IActivity, ActivityType } from '../../interfaces/IActivity';
import ActivitySchema from '../schemas/activitySchema';

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
 * Interface for activity filter options
 */
interface ActivityFilterOptions {
    type?: ActivityType[];
    startDate?: Date;
    endDate?: Date;
    userId?: Types.ObjectId;
}

/**
 * Interface for paginated results
 */
interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
}

/**
 * Interface for activity creation data
 */
interface CreateActivityDTO {
    tenantId: Types.ObjectId;
    leadId: Types.ObjectId;
    userId: Types.ObjectId;
    type: ActivityType;
    description: string;
    metadata?: Record<string, any>;
}

/**
 * Enhanced Activity model with static methods for advanced querying and data management
 */
interface ActivityModel extends Model<IActivity> {
    /**
     * Find activities for a specific tenant with pagination and filtering
     */
    findByTenant(
        tenantId: Types.ObjectId,
        options: PaginationOptions,
        filters?: ActivityFilterOptions
    ): Promise<PaginatedResult<IActivity>>;

    /**
     * Find activities for a specific lead with tenant isolation
     */
    findByLead(
        leadId: Types.ObjectId,
        tenantId: Types.ObjectId,
        type?: ActivityType[]
    ): Promise<IActivity[]>;

    /**
     * Create a new activity with validation
     */
    createActivity(data: CreateActivityDTO): Promise<IActivity>;

    /**
     * Get activity timeline for a lead
     */
    getLeadTimeline(
        leadId: Types.ObjectId,
        tenantId: Types.ObjectId,
        options?: PaginationOptions
    ): Promise<PaginatedResult<IActivity>>;
}

// Add static methods to the schema
ActivitySchema.statics.findByTenant = async function(
    tenantId: Types.ObjectId,
    options: PaginationOptions,
    filters?: ActivityFilterOptions
): Promise<PaginatedResult<IActivity>> {
    const query: FilterQuery<IActivity> = { tenantId };

    // Apply filters
    if (filters) {
        if (filters.type?.length) {
            query.type = { $in: filters.type };
        }
        if (filters.startDate || filters.endDate) {
            query.createdAt = {};
            if (filters.startDate) {
                query.createdAt.$gte = filters.startDate;
            }
            if (filters.endDate) {
                query.createdAt.$lte = filters.endDate;
            }
        }
        if (filters.userId) {
            query.userId = filters.userId;
        }
    }

    const page = Math.max(1, options.page);
    const limit = Math.min(100, Math.max(1, options.limit));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        this.find(query)
            .sort({ [options.sortBy || 'createdAt']: options.sortOrder === 'asc' ? 1 : -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec(),
        this.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
        data,
        total,
        page,
        totalPages,
        hasMore: page < totalPages
    };
};

ActivitySchema.statics.findByLead = async function(
    leadId: Types.ObjectId,
    tenantId: Types.ObjectId,
    type?: ActivityType[]
): Promise<IActivity[]> {
    const query: FilterQuery<IActivity> = { leadId, tenantId };
    
    if (type?.length) {
        query.type = { $in: type };
    }

    return this.find(query)
        .sort({ createdAt: -1 })
        .lean()
        .exec();
};

ActivitySchema.statics.createActivity = async function(
    data: CreateActivityDTO
): Promise<IActivity> {
    // Validate required fields
    if (!data.tenantId || !data.leadId || !data.userId || !data.type || !data.description) {
        throw new Error('Missing required fields for activity creation');
    }

    // Create new activity document
    const activity = new this({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    // Save and return the new activity
    return activity.save();
};

ActivitySchema.statics.getLeadTimeline = async function(
    leadId: Types.ObjectId,
    tenantId: Types.ObjectId,
    options: PaginationOptions = { page: 1, limit: 50 }
): Promise<PaginatedResult<IActivity>> {
    const query: FilterQuery<IActivity> = { leadId, tenantId };
    const page = Math.max(1, options.page);
    const limit = Math.min(100, Math.max(1, options.limit));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        this.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec(),
        this.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
        data,
        total,
        page,
        totalPages,
        hasMore: page < totalPages
    };
};

// Create and export the Activity model
const Activity = model<IActivity, ActivityModel>('Activity', ActivitySchema);

export default Activity;