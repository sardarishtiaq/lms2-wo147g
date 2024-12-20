/**
 * @fileoverview Service class implementing business logic for managing lead categories
 * in the multi-tenant CRM system's 12-stage pipeline process.
 * @version 1.0.0
 */

import { injectable, inject } from 'inversify'; // v7.x
import { Logger } from 'winston'; // v3.x
import { Category } from '../db/models/Category';
import { ICategory } from '../interfaces/ICategory';
import { LeadCategory } from '../constants/leadCategories';
import { CategoryValidationError } from '../errors/CategoryValidationError';
import { TYPES } from '../constants/types';

/**
 * Service class handling lead category business logic with strict multi-tenant support.
 * Implements comprehensive validation, error handling, and data isolation.
 */
@injectable()
export class CategoryService {
  private readonly _logger: Logger;
  private readonly _categoryModel = Category;

  /**
   * Initializes a new instance of CategoryService
   * @param logger - Winston logger instance for operation tracking
   */
  constructor(
    @inject(TYPES.Logger) logger: Logger
  ) {
    this._logger = logger.child({ service: 'CategoryService' });
  }

  /**
   * Retrieves all categories for a specific tenant with enhanced error handling
   * @param tenantId - Tenant identifier for data isolation
   * @returns Promise resolving to sorted array of categories
   * @throws CategoryValidationError if tenantId is invalid
   */
  public async getAllCategories(tenantId: string): Promise<ICategory[]> {
    try {
      this._validateTenantId(tenantId);
      
      this._logger.debug('Retrieving all categories', { tenantId });
      
      const categories = await this._categoryModel.findByTenantId(tenantId);
      
      this._logger.info('Successfully retrieved categories', { 
        tenantId, 
        count: categories.length 
      });
      
      return categories.sort((a, b) => a.order - b.order);
    } catch (error) {
      this._logger.error('Error retrieving categories', { 
        tenantId, 
        error: error.message 
      });
      throw this._handleError(error);
    }
  }

  /**
   * Retrieves a specific category by type with validation
   * @param tenantId - Tenant identifier for data isolation
   * @param type - Category type from LeadCategory enum
   * @returns Promise resolving to matching category
   * @throws CategoryValidationError if parameters are invalid
   */
  public async getCategoryByType(
    tenantId: string, 
    type: LeadCategory
  ): Promise<ICategory> {
    try {
      this._validateTenantId(tenantId);
      this._validateCategoryType(type);
      
      this._logger.debug('Retrieving category by type', { tenantId, type });
      
      const category = await this._categoryModel.findByType(tenantId, type);
      
      if (!category) {
        throw new CategoryValidationError(
          `Category not found for type: ${type}`
        );
      }
      
      this._logger.info('Successfully retrieved category', { 
        tenantId, 
        type,
        categoryId: category.id 
      });
      
      return category;
    } catch (error) {
      this._logger.error('Error retrieving category by type', { 
        tenantId, 
        type, 
        error: error.message 
      });
      throw this._handleError(error);
    }
  }

  /**
   * Retrieves active categories with enhanced filtering
   * @param tenantId - Tenant identifier for data isolation
   * @returns Promise resolving to filtered list of active categories
   * @throws CategoryValidationError if tenantId is invalid
   */
  public async getActiveCategories(tenantId: string): Promise<ICategory[]> {
    try {
      this._validateTenantId(tenantId);
      
      this._logger.debug('Retrieving active categories', { tenantId });
      
      const categories = await this._categoryModel.findActiveCategories(tenantId);
      
      this._logger.info('Successfully retrieved active categories', { 
        tenantId, 
        count: categories.length 
      });
      
      return categories.sort((a, b) => a.order - b.order);
    } catch (error) {
      this._logger.error('Error retrieving active categories', { 
        tenantId, 
        error: error.message 
      });
      throw this._handleError(error);
    }
  }

  /**
   * Validates tenant ID parameter
   * @param tenantId - Tenant identifier to validate
   * @throws CategoryValidationError if validation fails
   */
  private _validateTenantId(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      throw new CategoryValidationError('Invalid tenant ID provided');
    }
  }

  /**
   * Validates category type parameter
   * @param type - Category type to validate
   * @throws CategoryValidationError if validation fails
   */
  private _validateCategoryType(type: LeadCategory): void {
    if (!Object.values(LeadCategory).includes(type)) {
      throw new CategoryValidationError('Invalid category type provided');
    }
  }

  /**
   * Handles and transforms errors for consistent error responses
   * @param error - Error to handle
   * @returns Transformed error
   */
  private _handleError(error: Error): Error {
    if (error instanceof CategoryValidationError) {
      return error;
    }
    
    if (error.name === 'MongoError') {
      return new CategoryValidationError(
        'Database operation failed: ' + error.message
      );
    }
    
    return new CategoryValidationError(
      'An unexpected error occurred: ' + error.message
    );
  }
}