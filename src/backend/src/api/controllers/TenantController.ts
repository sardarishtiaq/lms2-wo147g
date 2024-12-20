/**
 * @fileoverview Controller handling HTTP endpoints for tenant management operations
 * Implements secure multi-tenant operations with comprehensive validation and error handling
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // v4.18.2
import { Types } from 'mongoose'; // v7.x
import rateLimit from 'express-rate-limit'; // v6.x
import createError from 'http-errors'; // v2.x

import { ITenant, ITenantSettings, TenantStatus } from '../../interfaces/ITenant';
import TenantService from '../../services/TenantService';
import { validateTenantCreation, validateTenantUpdate, validateTenantSettings } from '../validators/tenantValidators';
import { ErrorCode, ErrorMessage, HttpStatusCode } from '../../constants/errorCodes';

/**
 * Controller class handling tenant management operations with enhanced security
 * and comprehensive validation for the multi-tenant CRM system
 */
export class TenantController {
  // Rate limiting configuration for tenant operations
  private readonly rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later'
  });

  constructor(private readonly tenantService: typeof TenantService) {}

  /**
   * Creates a new tenant with comprehensive validation and security checks
   * @param req Express request object containing tenant data
   * @param res Express response object
   * @returns Promise resolving to created tenant or error response
   */
  public createTenant = async (req: Request, res: Response): Promise<Response> => {
    try {
      // Apply rate limiting
      await this.rateLimiter(req, res, () => {});

      // Validate request data
      const isValid = await validateTenantCreation(req.body);
      if (!isValid) {
        return res.status(HttpStatusCode.BAD_REQUEST).json({
          code: ErrorCode.VALIDATION_ERROR,
          message: ErrorMessage.VALIDATION_ERROR
        });
      }

      // Create tenant
      const tenant = await this.tenantService.createTenant(
        req.body.name,
        req.body.settings
      );

      return res.status(HttpStatusCode.OK).json(tenant);
    } catch (error: any) {
      console.error('Error creating tenant:', error);
      return res.status(ErrorCode.INTERNAL_SERVER_ERROR).json({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: ErrorMessage.INTERNAL_SERVER_ERROR
      });
    }
  };

  /**
   * Retrieves tenant by ID with security validation
   * @param req Express request object containing tenant ID
   * @param res Express response object
   * @returns Promise resolving to tenant data or error response
   */
  public getTenant = async (req: Request, res: Response): Promise<Response> => {
    try {
      const tenantId = new Types.ObjectId(req.params.id);
      
      // Retrieve tenant
      const tenant = await this.tenantService.getTenantById(tenantId);
      
      if (!tenant) {
        return res.status(HttpStatusCode.NOT_FOUND).json({
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: ErrorMessage.RESOURCE_NOT_FOUND
        });
      }

      return res.status(HttpStatusCode.OK).json(tenant);
    } catch (error: any) {
      console.error('Error retrieving tenant:', error);
      return res.status(ErrorCode.INTERNAL_SERVER_ERROR).json({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: ErrorMessage.INTERNAL_SERVER_ERROR
      });
    }
  };

  /**
   * Updates tenant settings with comprehensive validation
   * @param req Express request object containing settings updates
   * @param res Express response object
   * @returns Promise resolving to updated tenant or error response
   */
  public updateTenantSettings = async (req: Request, res: Response): Promise<Response> => {
    try {
      const tenantId = new Types.ObjectId(req.params.id);
      const settings: Partial<ITenantSettings> = req.body.settings;

      // Validate settings
      const isValid = await validateTenantSettings(settings);
      if (!isValid) {
        return res.status(HttpStatusCode.BAD_REQUEST).json({
          code: ErrorCode.VALIDATION_ERROR,
          message: ErrorMessage.VALIDATION_ERROR
        });
      }

      // Update settings
      const updatedTenant = await this.tenantService.updateTenantSettings(
        tenantId,
        settings
      );

      return res.status(HttpStatusCode.OK).json(updatedTenant);
    } catch (error: any) {
      console.error('Error updating tenant settings:', error);
      return res.status(ErrorCode.INTERNAL_SERVER_ERROR).json({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: ErrorMessage.INTERNAL_SERVER_ERROR
      });
    }
  };

  /**
   * Updates tenant status with security validation
   * @param req Express request object containing status update
   * @param res Express response object
   * @returns Promise resolving to updated tenant or error response
   */
  public updateTenantStatus = async (req: Request, res: Response): Promise<Response> => {
    try {
      const tenantId = new Types.ObjectId(req.params.id);
      const status: TenantStatus = req.body.status;

      // Validate status update
      if (!Object.values(TenantStatus).includes(status)) {
        return res.status(HttpStatusCode.BAD_REQUEST).json({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid tenant status'
        });
      }

      // Update status
      const updatedTenant = await this.tenantService.updateTenantStatus(
        tenantId,
        status
      );

      return res.status(HttpStatusCode.OK).json(updatedTenant);
    } catch (error: any) {
      console.error('Error updating tenant status:', error);
      return res.status(ErrorCode.INTERNAL_SERVER_ERROR).json({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: ErrorMessage.INTERNAL_SERVER_ERROR
      });
    }
  };

  /**
   * Soft deletes a tenant with cleanup operations
   * @param req Express request object containing tenant ID
   * @param res Express response object
   * @returns Promise resolving to deletion confirmation or error response
   */
  public deleteTenant = async (req: Request, res: Response): Promise<Response> => {
    try {
      const tenantId = new Types.ObjectId(req.params.id);

      // Perform soft delete
      const deletedTenant = await this.tenantService.deleteTenant(tenantId);

      return res.status(HttpStatusCode.OK).json({
        message: 'Tenant deleted successfully',
        tenantId: deletedTenant.id
      });
    } catch (error: any) {
      console.error('Error deleting tenant:', error);
      return res.status(ErrorCode.INTERNAL_SERVER_ERROR).json({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: ErrorMessage.INTERNAL_SERVER_ERROR
      });
    }
  };
}

// Export singleton instance
export default new TenantController(TenantService);