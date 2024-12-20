/**
 * @fileoverview Implements the Tenant model class for MongoDB using Mongoose
 * Provides tenant data management and operations for the multi-tenant CRM system
 * with enhanced type safety and validation
 * @version 1.0.0
 */

import { model, Document, Model } from 'mongoose'; // v7.x
import { ITenant, ITenantSettings, TenantStatus } from '../../interfaces/ITenant';
import tenantSchema from '../schemas/tenantSchema';

/**
 * Error messages for tenant operations
 */
const ERROR_MESSAGES = {
  INVALID_NAME: 'Invalid tenant name provided',
  NAME_REQUIRED: 'Tenant name is required',
  SETTINGS_INVALID: 'Invalid tenant settings provided',
  UPDATE_FAILED: 'Failed to update tenant settings',
  NOT_FOUND: 'Tenant not found',
} as const;

/**
 * TenantModel class providing type-safe tenant operations
 * Implements multi-tenant data management with strict validation
 */
export class TenantModel {
  private model: Model<ITenant & Document>;

  /**
   * Initializes the Tenant model with schema and validation
   */
  constructor() {
    this.model = model<ITenant>('Tenant', tenantSchema);
  }

  /**
   * Finds a tenant by name with case-insensitive matching
   * @param name - The tenant name to search for
   * @returns Promise resolving to found tenant or null
   * @throws Error if name parameter is invalid
   */
  public async findByName(name: string): Promise<ITenant | null> {
    try {
      // Validate input
      if (!name || typeof name !== 'string') {
        throw new Error(ERROR_MESSAGES.INVALID_NAME);
      }

      // Perform case-insensitive search excluding suspended tenants
      const tenant = await this.model.findOne({
        name: new RegExp(`^${name}$`, 'i'),
        status: { $ne: TenantStatus.SUSPENDED }
      });

      return tenant;
    } catch (error) {
      // Log error and rethrow with appropriate message
      console.error('Error in findByName:', error);
      throw error;
    }
  }

  /**
   * Updates tenant settings with comprehensive validation
   * @param tenantId - The ID of the tenant to update
   * @param settings - New settings to apply
   * @returns Promise resolving to updated tenant
   * @throws Error if validation fails or tenant not found
   */
  public async updateSettings(
    tenantId: string,
    settings: Partial<ITenantSettings>
  ): Promise<ITenant> {
    try {
      // Find tenant and ensure it exists
      const tenant = await this.model.findById(tenantId);
      if (!tenant) {
        throw new Error(ERROR_MESSAGES.NOT_FOUND);
      }

      // Merge existing settings with updates
      const updatedSettings = {
        ...tenant.settings,
        ...settings
      };

      // Update tenant with optimistic locking
      const updatedTenant = await this.model.findOneAndUpdate(
        {
          _id: tenantId,
          version: tenant.version // Ensure version matches for optimistic locking
        },
        {
          $set: { settings: updatedSettings },
          $inc: { version: 1 }
        },
        {
          new: true, // Return updated document
          runValidators: true // Run schema validators
        }
      );

      if (!updatedTenant) {
        throw new Error(ERROR_MESSAGES.UPDATE_FAILED);
      }

      return updatedTenant;
    } catch (error) {
      console.error('Error in updateSettings:', error);
      throw error;
    }
  }

  /**
   * Creates a new tenant with validated settings
   * @param name - Tenant name
   * @param settings - Initial tenant settings
   * @returns Promise resolving to created tenant
   * @throws Error if validation fails
   */
  public async createTenant(
    name: string,
    settings: ITenantSettings
  ): Promise<ITenant> {
    try {
      if (!name) {
        throw new Error(ERROR_MESSAGES.NAME_REQUIRED);
      }

      const tenant = new this.model({
        name,
        settings,
        status: TenantStatus.ACTIVE,
        version: 1
      });

      // Validate and save tenant
      await tenant.validate();
      return await tenant.save();
    } catch (error) {
      console.error('Error in createTenant:', error);
      throw error;
    }
  }

  /**
   * Updates tenant status with validation
   * @param tenantId - The ID of the tenant
   * @param status - New status to set
   * @returns Promise resolving to updated tenant
   * @throws Error if validation fails or tenant not found
   */
  public async updateStatus(
    tenantId: string,
    status: TenantStatus
  ): Promise<ITenant> {
    try {
      const updatedTenant = await this.model.findByIdAndUpdate(
        tenantId,
        {
          $set: { status },
          $inc: { version: 1 }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!updatedTenant) {
        throw new Error(ERROR_MESSAGES.NOT_FOUND);
      }

      return updatedTenant;
    } catch (error) {
      console.error('Error in updateStatus:', error);
      throw error;
    }
  }

  /**
   * Gets the underlying Mongoose model
   * @returns The Mongoose model for Tenant
   */
  public getModel(): Model<ITenant & Document> {
    return this.model;
  }
}

// Export singleton instance
export default new TenantModel();