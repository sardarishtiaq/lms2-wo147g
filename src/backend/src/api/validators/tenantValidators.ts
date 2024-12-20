/**
 * @fileoverview Validation schemas and functions for tenant-related operations
 * Implements comprehensive validation rules for tenant creation, updates, and settings
 * with enhanced security measures for the multi-tenant CRM system
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { ITenant, ITenantSettings, TenantStatus } from '../../interfaces/ITenant';
import { ErrorCode } from '../../constants/errorCodes';

/**
 * Custom validation error class for tenant-related validation failures
 */
class TenantValidationError extends Error {
  constructor(message: string, public code: ErrorCode, public details?: any) {
    super(message);
    this.name = 'TenantValidationError';
  }
}

/**
 * Validation schema for tenant feature flags
 */
const tenantFeaturesSchema = Joi.object({
  quoteManagement: Joi.boolean().required(),
  advancedReporting: Joi.boolean().required(),
  apiAccess: Joi.boolean().required(),
  customFields: Joi.boolean().required()
}).required();

/**
 * Validation schema for tenant settings
 */
const tenantSettingsSchema = Joi.object({
  leadCategories: Joi.array()
    .items(Joi.string().trim().min(2).max(50))
    .min(1)
    .required(),
  maxUsers: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .required(),
  maxLeads: Joi.number()
    .integer()
    .min(100)
    .max(1000000)
    .required(),
  allowedDomains: Joi.array()
    .items(Joi.string().domain({ tlds: { allow: true } }))
    .min(1)
    .required(),
  features: tenantFeaturesSchema
}).required();

/**
 * Validation schema for tenant creation
 */
const tenantCreationSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Tenant name must contain only alphanumeric characters and hyphens',
      'string.min': 'Tenant name must be at least 3 characters long',
      'string.max': 'Tenant name cannot exceed 50 characters'
    }),
  settings: tenantSettingsSchema,
  status: Joi.string()
    .valid(...Object.values(TenantStatus))
    .default(TenantStatus.ACTIVE)
}).required();

/**
 * Validation schema for tenant updates
 */
const tenantUpdateSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9-]+$/),
  settings: tenantSettingsSchema,
  status: Joi.string()
    .valid(...Object.values(TenantStatus))
}).min(1);

/**
 * Validates data for tenant creation with enhanced security checks
 * @param tenantData - Partial tenant data to validate
 * @returns Promise resolving to true if validation passes
 * @throws TenantValidationError if validation fails
 */
export async function validateTenantCreation(tenantData: Partial<ITenant>): Promise<boolean> {
  try {
    // Sanitize input data
    const sanitizedData = {
      name: tenantData.name?.trim(),
      settings: tenantData.settings,
      status: tenantData.status
    };

    // Validate against schema
    const { error, value } = tenantCreationSchema.validate(sanitizedData, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      throw new TenantValidationError(
        'Tenant creation validation failed',
        ErrorCode.VALIDATION_ERROR,
        error.details
      );
    }

    // Additional security checks
    if (value.settings.maxUsers > 1000) {
      throw new TenantValidationError(
        'Maximum users limit exceeded',
        ErrorCode.VALIDATION_ERROR
      );
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    const invalidDomains = value.settings.allowedDomains.filter(
      domain => !domainRegex.test(domain)
    );

    if (invalidDomains.length > 0) {
      throw new TenantValidationError(
        'Invalid domain format detected',
        ErrorCode.VALIDATION_ERROR,
        { invalidDomains }
      );
    }

    return true;
  } catch (error) {
    if (error instanceof TenantValidationError) {
      throw error;
    }
    throw new TenantValidationError(
      'Tenant validation failed',
      ErrorCode.VALIDATION_ERROR,
      error
    );
  }
}

/**
 * Validates data for tenant updates with partial update support
 * @param updateData - Partial tenant data to validate
 * @returns Promise resolving to true if validation passes
 * @throws TenantValidationError if validation fails
 */
export async function validateTenantUpdate(updateData: Partial<ITenant>): Promise<boolean> {
  try {
    // Validate against schema
    const { error, value } = tenantUpdateSchema.validate(updateData, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      throw new TenantValidationError(
        'Tenant update validation failed',
        ErrorCode.VALIDATION_ERROR,
        error.details
      );
    }

    // Validate status transitions
    if (value.status) {
      const validTransitions: Record<TenantStatus, TenantStatus[]> = {
        [TenantStatus.ACTIVE]: [TenantStatus.INACTIVE, TenantStatus.SUSPENDED],
        [TenantStatus.INACTIVE]: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED],
        [TenantStatus.SUSPENDED]: [TenantStatus.INACTIVE]
      };

      if (!validTransitions[value.status].includes(value.status)) {
        throw new TenantValidationError(
          'Invalid status transition',
          ErrorCode.VALIDATION_ERROR
        );
      }
    }

    return true;
  } catch (error) {
    if (error instanceof TenantValidationError) {
      throw error;
    }
    throw new TenantValidationError(
      'Tenant update validation failed',
      ErrorCode.VALIDATION_ERROR,
      error
    );
  }
}

/**
 * Validates tenant settings configuration with enhanced security
 * @param settingsData - Tenant settings to validate
 * @returns Promise resolving to true if validation passes
 * @throws TenantValidationError if validation fails
 */
export async function validateTenantSettings(settingsData: ITenantSettings): Promise<boolean> {
  try {
    // Validate against schema
    const { error, value } = tenantSettingsSchema.validate(settingsData, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      throw new TenantValidationError(
        'Tenant settings validation failed',
        ErrorCode.VALIDATION_ERROR,
        error.details
      );
    }

    // Validate lead category uniqueness
    const uniqueCategories = new Set(value.leadCategories);
    if (uniqueCategories.size !== value.leadCategories.length) {
      throw new TenantValidationError(
        'Duplicate lead categories detected',
        ErrorCode.VALIDATION_ERROR
      );
    }

    // Validate feature flag dependencies
    if (value.features.advancedReporting && !value.features.apiAccess) {
      throw new TenantValidationError(
        'Advanced reporting requires API access',
        ErrorCode.VALIDATION_ERROR
      );
    }

    return true;
  } catch (error) {
    if (error instanceof TenantValidationError) {
      throw error;
    }
    throw new TenantValidationError(
      'Tenant settings validation failed',
      ErrorCode.VALIDATION_ERROR,
      error
    );
  }
}