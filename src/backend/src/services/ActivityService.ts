/**
 * @fileoverview Service class for managing activity records in the multi-tenant CRM system.
 * Implements comprehensive activity tracking, real-time updates, and tenant isolation.
 * @version 1.0.0
 */

import { Types } from 'mongoose'; // v7.x
import { EventEmitter } from 'events'; // Node.js built-in
import { createClient } from 'redis'; // v4.x
import Activity from '../db/models/Activity';
import { IActivity, ActivityType } from '../interfaces/IActivity';
import logger from '../utils/logger';

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
interface FilterOptions {
    type?: ActivityType[];
    startDate?: Date;
    endDate?: Date;
    userId?: Types.ObjectId;
}

/**
 * Enhanced service class for managing activity records with real-time updates,
 * caching, and comprehensive error handling
 */
export class ActivityService {
    private _eventEmitter: EventEmitter;
    private _maxRetries: number = 3;
    private _redisClient: ReturnType<typeof createClient>;
    private readonly CACHE_TTL = 3600; // 1 hour
    private readonly CACHE_PREFIX = 'activity:';

    /**
     * Initializes the activity service with event emitter and Redis client
     * @param eventEmitter - Event emitter instance for real-time updates
     */
    constructor(eventEmitter: EventEmitter) {
        this._eventEmitter = eventEmitter;
        this._redisClient = createClient({
            url: process.env.REDIS_URL,
            socket: {
                reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
            }
        });

        this._redisClient.connect().catch(err => {
            logger.error('Redis connection error:', { error: err.message });
        });

        // Set up error handling for event emitter
        this._eventEmitter.on('error', (error) => {
            logger.error('Event emitter error:', { error: error.message });
        });
    }

    /**
     * Creates a new activity record with enhanced validation and real-time updates
     * @param tenantId - Tenant identifier
     * @param leadId - Associated lead identifier
     * @param userId - User who performed the activity
     * @param type - Type of activity
     * @param description - Activity description
     * @param metadata - Additional activity data
     * @returns Created activity record
     */
    async createActivity(
        tenantId: Types.ObjectId,
        leadId: Types.ObjectId,
        userId: Types.ObjectId,
        type: ActivityType,
        description: string,
        metadata: Record<string, any> = {}
    ): Promise<IActivity> {
        try {
            logger.debug('Creating activity:', { tenantId, leadId, type });

            // Validate input parameters
            if (!tenantId || !leadId || !userId || !type || !description) {
                throw new Error('Missing required parameters for activity creation');
            }

            // Create activity with retry mechanism
            let activity: IActivity | null = null;
            let attempts = 0;

            while (attempts < this._maxRetries && !activity) {
                try {
                    activity = await Activity.createActivity({
                        tenantId,
                        leadId,
                        userId,
                        type,
                        description,
                        metadata
                    });

                    // Invalidate cache
                    const cacheKey = `${this.CACHE_PREFIX}${leadId}`;
                    await this._redisClient.del(cacheKey);

                    // Emit real-time update
                    this._eventEmitter.emit('activity.created', {
                        tenantId,
                        leadId,
                        activity
                    });

                    logger.info('Activity created successfully:', {
                        activityId: activity._id,
                        type,
                        leadId
                    });

                    return activity;
                } catch (error) {
                    attempts++;
                    if (attempts === this._maxRetries) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                }
            }

            throw new Error('Failed to create activity after maximum retries');
        } catch (error) {
            logger.error('Error creating activity:', {
                error: error.message,
                tenantId,
                leadId,
                type
            });
            throw error;
        }
    }

    /**
     * Retrieves paginated activities for a specific lead with caching
     * @param leadId - Lead identifier
     * @param tenantId - Tenant identifier
     * @param options - Pagination options
     * @returns Paginated list of activities
     */
    async getLeadActivities(
        leadId: Types.ObjectId,
        tenantId: Types.ObjectId,
        options: PaginationOptions = { page: 1, limit: 50 }
    ): Promise<{ data: IActivity[]; total: number; page: number; totalPages: number }> {
        try {
            logger.debug('Fetching lead activities:', { leadId, tenantId });

            // Try to get from cache first
            const cacheKey = `${this.CACHE_PREFIX}${leadId}`;
            const cachedData = await this._redisClient.get(cacheKey);

            if (cachedData) {
                logger.debug('Cache hit for lead activities:', { leadId });
                return JSON.parse(cachedData);
            }

            // Get from database if not in cache
            const result = await Activity.getLeadTimeline(leadId, tenantId, options);

            // Cache the result
            await this._redisClient.setEx(
                cacheKey,
                this.CACHE_TTL,
                JSON.stringify(result)
            );

            logger.info('Lead activities retrieved successfully:', {
                leadId,
                count: result.data.length
            });

            return result;
        } catch (error) {
            logger.error('Error fetching lead activities:', {
                error: error.message,
                leadId,
                tenantId
            });
            throw error;
        }
    }

    /**
     * Retrieves paginated activities for a tenant with advanced filtering
     * @param tenantId - Tenant identifier
     * @param filters - Filter options
     * @param options - Pagination options
     * @returns Filtered and paginated activities
     */
    async getTenantActivities(
        tenantId: Types.ObjectId,
        filters: FilterOptions = {},
        options: PaginationOptions = { page: 1, limit: 50 }
    ): Promise<{ data: IActivity[]; total: number; page: number; totalPages: number }> {
        try {
            logger.debug('Fetching tenant activities:', { tenantId, filters });

            const result = await Activity.findByTenant(tenantId, options, filters);

            logger.info('Tenant activities retrieved successfully:', {
                tenantId,
                count: result.data.length
            });

            return result;
        } catch (error) {
            logger.error('Error fetching tenant activities:', {
                error: error.message,
                tenantId
            });
            throw error;
        }
    }

    /**
     * Cleanup method to properly close connections
     */
    async cleanup(): Promise<void> {
        try {
            await this._redisClient.quit();
            logger.info('ActivityService cleanup completed successfully');
        } catch (error) {
            logger.error('Error during ActivityService cleanup:', {
                error: error.message
            });
            throw error;
        }
    }
}

export default ActivityService;