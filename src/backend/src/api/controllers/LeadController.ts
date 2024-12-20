/**
 * @fileoverview Controller implementing RESTful API endpoints for lead management
 * in the multi-tenant CRM system. Handles the 12-stage pipeline process with
 * complete tenant isolation and comprehensive activity tracking.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { Types } from 'mongoose'; // ^7.0.0
import { StatusCodes } from 'http-status-codes'; // ^2.2.0

import { LeadService } from '../../services/LeadService';
import { ActivityService } from '../../services/ActivityService';
import { ILead } from '../../interfaces/ILead';
import { validateCreateLead, validateUpdateLead } from '../validators/leadValidators';
import logger from '../../utils/logger';
import { ErrorCode, ErrorMessage } from '../../constants/errorCodes';

/**
 * Controller class implementing RESTful API endpoints for lead management with tenant isolation
 */
export class LeadController {
    private readonly _leadService: LeadService;
    private readonly _activityService: ActivityService;
    private readonly _logger: typeof logger;

    /**
     * Initializes lead controller with required dependencies
     * @param leadService - Service for lead management operations
     * @param activityService - Service for activity tracking
     * @param logger - Logger instance for request and error tracking
     */
    constructor(
        leadService: LeadService,
        activityService: ActivityService,
        logger: typeof logger
    ) {
        this._leadService = leadService;
        this._activityService = activityService;
        this._logger = logger;
    }

    /**
     * Creates a new lead with tenant isolation and activity tracking
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next function
     */
    public createLead = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> => {
        try {
            this._logger.debug('Creating new lead:', {
                tenantId: req.body.tenantId,
                data: req.body
            });

            // Validate tenant context and lead data
            await validateCreateLead(req.body, { tenantId: req.body.tenantId });

            // Create lead with tenant isolation
            const createdLead = await this._leadService.createLead(
                new Types.ObjectId(req.body.tenantId),
                req.body,
                {
                    skipValidation: false,
                    priority: req.body.priority || 3
                }
            );

            // Log lead creation activity
            await this._activityService.logActivity(
                new Types.ObjectId(req.body.tenantId),
                createdLead._id,
                new Types.ObjectId(req.user?.id),
                'LEAD_CREATED',
                'Lead created successfully',
                {
                    category: createdLead.category,
                    source: req.body.source
                }
            );

            this._logger.info('Lead created successfully:', {
                leadId: createdLead._id,
                tenantId: createdLead.tenantId
            });

            return res.status(StatusCodes.CREATED).json({
                success: true,
                data: createdLead
            });
        } catch (error) {
            this._logger.error('Error creating lead:', {
                error: error.message,
                stack: error.stack,
                tenantId: req.body.tenantId
            });

            next(error);
        }
    };

    /**
     * Updates an existing lead with validation and activity tracking
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next function
     */
    public updateLead = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> => {
        try {
            const { id: leadId } = req.params;
            const tenantId = req.body.tenantId;

            this._logger.debug('Updating lead:', {
                leadId,
                tenantId,
                updates: req.body
            });

            // Validate tenant context and update data
            await validateUpdateLead(req.body, { tenantId });

            // Update lead with tenant isolation
            const updatedLead = await this._leadService.updateLead(
                new Types.ObjectId(tenantId),
                new Types.ObjectId(leadId),
                req.body,
                {
                    validateTransition: true,
                    createActivity: true,
                    notifyAssignee: true
                }
            );

            // Log lead update activity
            await this._activityService.logActivity(
                new Types.ObjectId(tenantId),
                updatedLead._id,
                new Types.ObjectId(req.user?.id),
                'LEAD_UPDATED',
                'Lead updated successfully',
                {
                    changes: req.body,
                    previousCategory: updatedLead.category
                }
            );

            this._logger.info('Lead updated successfully:', {
                leadId,
                tenantId,
                changes: req.body
            });

            return res.status(StatusCodes.OK).json({
                success: true,
                data: updatedLead
            });
        } catch (error) {
            this._logger.error('Error updating lead:', {
                error: error.message,
                stack: error.stack,
                leadId: req.params.id,
                tenantId: req.body.tenantId
            });

            next(error);
        }
    };

    /**
     * Retrieves leads by category with pagination and tenant isolation
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next function
     */
    public getLeadsByCategory = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> => {
        try {
            const { category } = req.params;
            const tenantId = req.query.tenantId as string;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;

            this._logger.debug('Fetching leads by category:', {
                category,
                tenantId,
                page,
                limit
            });

            // Get leads with tenant isolation
            const leads = await this._leadService.getLeadsByCategory(
                new Types.ObjectId(tenantId),
                category,
                { page, limit }
            );

            this._logger.info('Leads retrieved successfully:', {
                category,
                tenantId,
                count: leads.length
            });

            return res.status(StatusCodes.OK).json({
                success: true,
                data: leads,
                pagination: {
                    page,
                    limit,
                    total: leads.length
                }
            });
        } catch (error) {
            this._logger.error('Error fetching leads:', {
                error: error.message,
                stack: error.stack,
                category: req.params.category,
                tenantId: req.query.tenantId
            });

            next(error);
        }
    };

    /**
     * Assigns a lead to an agent with activity tracking
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next function
     */
    public assignLead = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> => {
        try {
            const { id: leadId } = req.params;
            const { tenantId, assignedTo } = req.body;

            this._logger.debug('Assigning lead:', {
                leadId,
                tenantId,
                assignedTo
            });

            // Assign lead with tenant isolation
            const updatedLead = await this._leadService.assignLead(
                new Types.ObjectId(tenantId),
                new Types.ObjectId(leadId),
                new Types.ObjectId(assignedTo)
            );

            // Log lead assignment activity
            await this._activityService.logActivity(
                new Types.ObjectId(tenantId),
                updatedLead._id,
                new Types.ObjectId(req.user?.id),
                'LEAD_ASSIGNED',
                'Lead assigned successfully',
                {
                    assignedTo,
                    previousAssignee: updatedLead.assignedTo
                }
            );

            this._logger.info('Lead assigned successfully:', {
                leadId,
                tenantId,
                assignedTo
            });

            return res.status(StatusCodes.OK).json({
                success: true,
                data: updatedLead
            });
        } catch (error) {
            this._logger.error('Error assigning lead:', {
                error: error.message,
                stack: error.stack,
                leadId: req.params.id,
                tenantId: req.body.tenantId
            });

            next(error);
        }
    };
}

export default LeadController;