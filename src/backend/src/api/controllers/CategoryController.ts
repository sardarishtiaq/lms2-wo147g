/**
 * @fileoverview Controller handling HTTP requests for lead category management in the CRM system.
 * Implements the 12-stage pipeline process with comprehensive multi-tenant support.
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // v4.18.x
import { injectable, inject } from 'inversify';
import { Logger } from 'winston'; // v3.x.x
import { CategoryService } from '../../services/CategoryService';
import { ICategory } from '../../interfaces/ICategory';
import { LeadCategory } from '../../constants/leadCategories';
import { validateCreateCategory, validateUpdateCategory } from '../validators/categoryValidators';
import { TYPES } from '../../constants/types';

/**
 * Controller class handling HTTP requests for lead category operations.
 * Implements comprehensive validation, error handling, and multi-tenant support.
 */
@injectable()
export class CategoryController {
    private readonly _logger: Logger;
    private readonly _categoryService: CategoryService;

    /**
     * Initializes a new instance of CategoryController
     * @param logger - Winston logger instance for operation tracking
     * @param categoryService - Service for category business logic
     */
    constructor(
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.CategoryService) categoryService: CategoryService
    ) {
        this._logger = logger.child({ controller: 'CategoryController' });
        this._categoryService = categoryService;
    }

    /**
     * Handles GET request to retrieve all categories for a tenant
     * @param req - Express request object containing tenant context
     * @param res - Express response object
     */
    public async getCategories(req: Request, res: Response): Promise<void> {
        try {
            const tenantId = req.headers['x-tenant-id'] as string;
            if (!tenantId) {
                res.status(400).json({
                    error: 'Tenant ID is required for data isolation'
                });
                return;
            }

            this._logger.debug('Retrieving categories', { tenantId });

            const categories = await this._categoryService.getAllCategories(tenantId);

            this._logger.info('Successfully retrieved categories', {
                tenantId,
                count: categories.length
            });

            res.status(200).json({
                success: true,
                data: categories
            });
        } catch (error) {
            this._logger.error('Error retrieving categories', {
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                error: 'Failed to retrieve categories',
                message: error.message
            });
        }
    }

    /**
     * Handles GET request to retrieve active categories for a tenant
     * @param req - Express request object containing tenant context
     * @param res - Express response object
     */
    public async getActiveCategories(req: Request, res: Response): Promise<void> {
        try {
            const tenantId = req.headers['x-tenant-id'] as string;
            if (!tenantId) {
                res.status(400).json({
                    error: 'Tenant ID is required for data isolation'
                });
                return;
            }

            this._logger.debug('Retrieving active categories', { tenantId });

            const categories = await this._categoryService.getActiveCategories(tenantId);

            this._logger.info('Successfully retrieved active categories', {
                tenantId,
                count: categories.length
            });

            res.status(200).json({
                success: true,
                data: categories
            });
        } catch (error) {
            this._logger.error('Error retrieving active categories', {
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                error: 'Failed to retrieve active categories',
                message: error.message
            });
        }
    }

    /**
     * Handles GET request to retrieve a specific category by type
     * @param req - Express request object containing tenant context and category type
     * @param res - Express response object
     */
    public async getCategoryByType(req: Request, res: Response): Promise<void> {
        try {
            const tenantId = req.headers['x-tenant-id'] as string;
            const type = req.params.type as LeadCategory;

            if (!tenantId || !type) {
                res.status(400).json({
                    error: 'Tenant ID and category type are required'
                });
                return;
            }

            this._logger.debug('Retrieving category by type', { tenantId, type });

            const category = await this._categoryService.getCategoryByType(tenantId, type);

            if (!category) {
                res.status(404).json({
                    error: `Category not found for type: ${type}`
                });
                return;
            }

            this._logger.info('Successfully retrieved category', {
                tenantId,
                type,
                categoryId: category.id
            });

            res.status(200).json({
                success: true,
                data: category
            });
        } catch (error) {
            this._logger.error('Error retrieving category by type', {
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                error: 'Failed to retrieve category',
                message: error.message
            });
        }
    }

    /**
     * Handles POST request to create a new category with validation
     * @param req - Express request object containing category data
     * @param res - Express response object
     */
    public async createCategory(req: Request, res: Response): Promise<void> {
        try {
            const tenantId = req.headers['x-tenant-id'] as string;
            if (!tenantId) {
                res.status(400).json({
                    error: 'Tenant ID is required for data isolation'
                });
                return;
            }

            const categoryData: Partial<ICategory> = {
                ...req.body,
                tenantId
            };

            this._logger.debug('Creating new category', { tenantId, categoryData });

            // Validate category data
            await validateCreateCategory(categoryData);

            const category = await this._categoryService.createCategory(categoryData as ICategory);

            this._logger.info('Successfully created category', {
                tenantId,
                categoryId: category.id
            });

            res.status(201).json({
                success: true,
                data: category
            });
        } catch (error) {
            this._logger.error('Error creating category', {
                error: error.message,
                stack: error.stack
            });

            res.status(error.name === 'ValidationError' ? 400 : 500).json({
                error: 'Failed to create category',
                message: error.message
            });
        }
    }

    /**
     * Handles PUT request to update an existing category
     * @param req - Express request object containing update data
     * @param res - Express response object
     */
    public async updateCategory(req: Request, res: Response): Promise<void> {
        try {
            const tenantId = req.headers['x-tenant-id'] as string;
            const categoryId = req.params.id;

            if (!tenantId || !categoryId) {
                res.status(400).json({
                    error: 'Tenant ID and category ID are required'
                });
                return;
            }

            const updateData: Partial<ICategory> = {
                ...req.body,
                id: categoryId,
                tenantId
            };

            this._logger.debug('Updating category', { tenantId, categoryId, updateData });

            // Validate update data
            await validateUpdateCategory(updateData);

            const updatedCategory = await this._categoryService.updateCategory(updateData);

            this._logger.info('Successfully updated category', {
                tenantId,
                categoryId
            });

            res.status(200).json({
                success: true,
                data: updatedCategory
            });
        } catch (error) {
            this._logger.error('Error updating category', {
                error: error.message,
                stack: error.stack
            });

            res.status(error.name === 'ValidationError' ? 400 : 500).json({
                error: 'Failed to update category',
                message: error.message
            });
        }
    }
}