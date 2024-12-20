/**
 * @fileoverview Activity Controller for managing lead-related activities in the multi-tenant CRM system.
 * Implements secure, performant endpoints for activity tracking with tenant isolation.
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.x
import { Types } from 'mongoose'; // ^7.x
import { RateLimit } from 'express-rate-limit'; // ^6.x
import { body, query, param, validationResult } from 'express-validator'; // ^7.x
import { ActivityService } from '../../services/ActivityService';
import { IActivity, ActivityType } from '../../interfaces/IActivity';
import { TenantRequest } from '../middlewares/tenantContextMiddleware';
import { ErrorCode, ErrorMessage, HttpStatusCode } from '../../constants/errorCodes';
import logger from '../../utils/logger';

/**
 * Activity Controller class handling HTTP requests for activity management
 * with comprehensive security, validation, and caching features.
 */
export class ActivityController {
    private readonly _activityService: ActivityService;
    private readonly _defaultPageSize: number = 50;
    private readonly _maxPageSize: number = 100;

    /**
     * Initializes the activity controller with required services
     * @param activityService - Service for activity management
     */
    constructor(activityService: ActivityService) {
        this._activityService = activityService;
    }

    /**
     * Validation rules for activity creation
     */
    private readonly createActivityValidation = [
        body('leadId').isMongoId().withMessage('Invalid lead ID'),
        body('type').isIn(Object.values(ActivityType)).withMessage('Invalid activity type'),
        body('description').trim().isLength({ min: 1, max: 1000 })
            .withMessage('Description must be between 1 and 1000 characters'),
        body('metadata').optional().isObject().withMessage('Invalid metadata format')
    ];

    /**
     * Validation rules for activity retrieval
     */
    private readonly getActivitiesValidation = [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: this._maxPageSize }).toInt(),
        query('type').optional().isIn(Object.values(ActivityType)),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601()
    ];

    /**
     * Creates a new activity with tenant isolation and validation
     * @param req - Express request with tenant context
     * @param res - Express response
     */
    public async createActivity(req: TenantRequest, res: Response): Promise<void> {
        try {
            // Validate request
            await Promise.all(this.createActivityValidation.map(validation => validation.run(req)));
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn('Activity creation validation failed', { 
                    errors: errors.array(),
                    tenantId: req.tenantId 
                });
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    code: ErrorCode.VALIDATION_ERROR,
                    message: ErrorMessage.VALIDATION_ERROR,
                    errors: errors.array()
                });
                return;
            }

            const { leadId, type, description, metadata } = req.body;

            const activity = await this._activityService.createActivity(
                new Types.ObjectId(req.tenantId),
                new Types.ObjectId(leadId),
                new Types.ObjectId(req.user.id),
                type,
                description,
                metadata
            );

            logger.info('Activity created successfully', {
                activityId: activity._id,
                tenantId: req.tenantId,
                leadId
            });

            res.status(HttpStatusCode.OK).json(activity);
        } catch (error: any) {
            logger.error('Error creating activity', {
                error: error.message,
                tenantId: req.tenantId,
                stack: error.stack
            });

            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_SERVER_ERROR,
                message: ErrorMessage.INTERNAL_SERVER_ERROR
            });
        }
    }

    /**
     * Retrieves paginated activities for a specific lead with caching
     * @param req - Express request with tenant context
     * @param res - Express response
     */
    public async getLeadActivities(req: TenantRequest, res: Response): Promise<void> {
        try {
            // Validate request
            await Promise.all(this.getActivitiesValidation.map(validation => validation.run(req)));
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn('Lead activities retrieval validation failed', {
                    errors: errors.array(),
                    tenantId: req.tenantId
                });
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    code: ErrorCode.VALIDATION_ERROR,
                    message: ErrorMessage.VALIDATION_ERROR,
                    errors: errors.array()
                });
                return;
            }

            const leadId = req.params.leadId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || this._defaultPageSize;

            const activities = await this._activityService.getLeadActivities(
                new Types.ObjectId(leadId),
                new Types.ObjectId(req.tenantId),
                { page, limit }
            );

            // Set cache headers
            res.set('Cache-Control', 'private, max-age=300');
            res.status(HttpStatusCode.OK).json(activities);
        } catch (error: any) {
            logger.error('Error retrieving lead activities', {
                error: error.message,
                tenantId: req.tenantId,
                stack: error.stack
            });

            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_SERVER_ERROR,
                message: ErrorMessage.INTERNAL_SERVER_ERROR
            });
        }
    }

    /**
     * Retrieves paginated activities for a tenant with filtering
     * @param req - Express request with tenant context
     * @param res - Express response
     */
    public async getTenantActivities(req: TenantRequest, res: Response): Promise<void> {
        try {
            // Validate request
            await Promise.all(this.getActivitiesValidation.map(validation => validation.run(req)));
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn('Tenant activities retrieval validation failed', {
                    errors: errors.array(),
                    tenantId: req.tenantId
                });
                res.status(HttpStatusCode.BAD_REQUEST).json({
                    code: ErrorCode.VALIDATION_ERROR,
                    message: ErrorMessage.VALIDATION_ERROR,
                    errors: errors.array()
                });
                return;
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || this._defaultPageSize;
            const filters = {
                type: req.query.type as ActivityType[],
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
                userId: req.query.userId ? new Types.ObjectId(req.query.userId as string) : undefined
            };

            const activities = await this._activityService.getTenantActivities(
                new Types.ObjectId(req.tenantId),
                filters,
                { page, limit }
            );

            // Set cache headers
            res.set('Cache-Control', 'private, max-age=180');
            res.status(HttpStatusCode.OK).json(activities);
        } catch (error: any) {
            logger.error('Error retrieving tenant activities', {
                error: error.message,
                tenantId: req.tenantId,
                stack: error.stack
            });

            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                code: ErrorCode.INTERNAL_SERVER_ERROR,
                message: ErrorMessage.INTERNAL_SERVER_ERROR
            });
        }
    }
}

export default ActivityController;