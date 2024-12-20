/**
 * @fileoverview Service class implementing tenant management operations for the multi-tenant CRM system.
 * Provides comprehensive tenant lifecycle management with enhanced security and validation.
 * @version 1.0.0
 */

import { Types } from 'mongoose'; // v7.x
import winston from 'winston'; // v3.x
import { ITenant, ITenantSettings, TenantStatus } from '../../interfaces/ITenant';
import TenantModel from '../db/models/Tenant';
import { validateTenantContext } from '../utils/validation';
import { ErrorCode, ErrorMessage } from '../constants/errorCodes';

/**
 * Custom error class for tenant-related operations
 */
class TenantServiceError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'TenantServiceError';
  }
}

/**
 * Service class implementing tenant management operations with comprehensive
 * security measures and data isolation
 */
export class TenantService {
  private tenantModel: typeof TenantModel;
  private logger: winston.Logger;
  private readonly rateLimits = {
    tenantCreation: {
      windowMs: 3600000, // 1 hour
      maxRequests: 10
    }
  };

  /**
   * Initializes the TenantService with required dependencies
   */
  constructor() {
    this.tenantModel = TenantModel;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: 'tenant-service.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * Creates a new tenant with comprehensive validation and security checks
   * @param name - Tenant organization name
   * @param settings - Initial tenant settings
   * @returns Promise resolving to created tenant
   * @throws TenantServiceError if validation fails or tenant already exists
   */
  public async createTenant(
    name: string,
    settings: ITenantSettings
  ): Promise<ITenant> {
    try {
      // Validate tenant name format
      const nameRegex = /^[a-zA-Z0-9\s\-&.]{3,50}$/;
      if (!nameRegex.test(name)) {
        throw new TenantServiceError(
          'Invalid tenant name format',
          ErrorCode.VALIDATION_ERROR,
          { name: 'Name must be 3-50 characters and contain only letters, numbers, spaces, and common symbols' }
        );
      }

      // Check for existing tenant
      const existingTenant = await this.tenantModel.findByName(name);
      if (existingTenant) {
        throw new TenantServiceError(
          'Tenant already exists',
          ErrorCode.DUPLICATE_RESOURCE,
          { name }
        );
      }

      // Create new tenant
      const tenant = await this.tenantModel.createTenant(name, {
        ...settings,
        maxUsers: settings.maxUsers || 10,
        maxLeads: settings.maxLeads || 1000,
        features: {
          quoteManagement: true,
          advancedReporting: false,
          apiAccess: false,
          customFields: false,
          ...settings.features
        }
      });

      this.logger.info('Tenant created successfully', {
        tenantId: tenant.id,
        name: tenant.name
      });

      return tenant;
    } catch (error) {
      this.logger.error('Error creating tenant', { error, name });
      throw error instanceof TenantServiceError ? error : new TenantServiceError(
        ErrorMessage.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Retrieves tenant by ID with security validation
   * @param id - Tenant identifier
   * @returns Promise resolving to found tenant or null
   * @throws TenantServiceError if validation fails
   */
  public async getTenantById(id: Types.ObjectId): Promise<ITenant | null> {
    try {
      // Validate tenant context
      await validateTenantContext({ tenantId: id.toString() });

      const tenant = await this.tenantModel.getModel().findById(id);
      
      if (tenant) {
        this.logger.info('Tenant retrieved successfully', { tenantId: id });
      }

      return tenant;
    } catch (error) {
      this.logger.error('Error retrieving tenant', { error, tenantId: id });
      throw error instanceof TenantServiceError ? error : new TenantServiceError(
        ErrorMessage.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Updates tenant settings with comprehensive validation
   * @param id - Tenant identifier
   * @param settings - Updated settings
   * @returns Promise resolving to updated tenant
   * @throws TenantServiceError if validation fails or tenant not found
   */
  public async updateTenantSettings(
    id: Types.ObjectId,
    settings: Partial<ITenantSettings>
  ): Promise<ITenant> {
    try {
      // Validate tenant context
      await validateTenantContext({ tenantId: id.toString() });

      const tenant = await this.tenantModel.updateSettings(
        id.toString(),
        settings
      );

      if (!tenant) {
        throw new TenantServiceError(
          'Tenant not found',
          ErrorCode.RESOURCE_NOT_FOUND,
          { id }
        );
      }

      this.logger.info('Tenant settings updated successfully', {
        tenantId: id,
        settings
      });

      return tenant;
    } catch (error) {
      this.logger.error('Error updating tenant settings', { error, tenantId: id });
      throw error instanceof TenantServiceError ? error : new TenantServiceError(
        ErrorMessage.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Updates tenant status with transition validation
   * @param id - Tenant identifier
   * @param status - New tenant status
   * @returns Promise resolving to updated tenant
   * @throws TenantServiceError if validation fails or tenant not found
   */
  public async updateTenantStatus(
    id: Types.ObjectId,
    status: TenantStatus
  ): Promise<ITenant> {
    try {
      // Validate tenant context
      await validateTenantContext({ tenantId: id.toString() });

      // Validate status transition
      const tenant = await this.tenantModel.getModel().findById(id);
      if (!tenant) {
        throw new TenantServiceError(
          'Tenant not found',
          ErrorCode.RESOURCE_NOT_FOUND,
          { id }
        );
      }

      // Prevent reactivation of suspended tenants
      if (tenant.status === TenantStatus.SUSPENDED && status === TenantStatus.ACTIVE) {
        throw new TenantServiceError(
          'Cannot reactivate suspended tenant',
          ErrorCode.VALIDATION_ERROR,
          { id, currentStatus: tenant.status, newStatus: status }
        );
      }

      const updatedTenant = await this.tenantModel.updateStatus(
        id.toString(),
        status
      );

      this.logger.info('Tenant status updated successfully', {
        tenantId: id,
        oldStatus: tenant.status,
        newStatus: status
      });

      return updatedTenant;
    } catch (error) {
      this.logger.error('Error updating tenant status', { error, tenantId: id });
      throw error instanceof TenantServiceError ? error : new TenantServiceError(
        ErrorMessage.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Soft deletes a tenant with security validation
   * @param id - Tenant identifier
   * @returns Promise resolving to deactivated tenant
   * @throws TenantServiceError if validation fails or tenant not found
   */
  public async deleteTenant(id: Types.ObjectId): Promise<ITenant> {
    try {
      // Validate tenant context
      await validateTenantContext({ tenantId: id.toString() });

      const tenant = await this.tenantModel.getModel().findById(id);
      if (!tenant) {
        throw new TenantServiceError(
          'Tenant not found',
          ErrorCode.RESOURCE_NOT_FOUND,
          { id }
        );
      }

      // Perform soft delete by setting status to inactive
      const deletedTenant = await this.tenantModel.updateStatus(
        id.toString(),
        TenantStatus.INACTIVE
      );

      this.logger.info('Tenant deleted successfully', { tenantId: id });

      return deletedTenant;
    } catch (error) {
      this.logger.error('Error deleting tenant', { error, tenantId: id });
      throw error instanceof TenantServiceError ? error : new TenantServiceError(
        ErrorMessage.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR
      );
    }
  }
}

// Export singleton instance
export default new TenantService();