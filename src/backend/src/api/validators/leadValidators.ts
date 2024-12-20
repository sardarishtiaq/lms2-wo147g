/**
 * @fileoverview Lead validation schemas and functions for the CRM system.
 * Implements comprehensive validation for lead operations across the 12-stage pipeline
 * with robust security measures and tenant isolation.
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { ObjectId } from 'mongodb'; // v5.0.0
import { ILead } from '../../interfaces/ILead';
import { LeadCategory } from '../../constants/leadCategories';
import { ErrorCode } from '../../constants/errorCodes';
import { validateTenantContext } from '../../utils/validation';

/**
 * RFC 5322 compliant email validation pattern
 */
const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * E.164 compliant phone number validation pattern
 */
const PHONE_PATTERN = /^\+[1-9]\d{1,14}$/;

/**
 * Custom validation error class for lead-specific validation errors
 */
class LeadValidationError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = ErrorCode.VALIDATION_ERROR,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'LeadValidationError';
  }
}

/**
 * Custom validator for MongoDB ObjectId
 */
const validateObjectId = (value: string, helpers: Joi.CustomHelpers): string => {
  if (!ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

/**
 * Comprehensive schema for lead creation validation
 */
export const createLeadSchema = Joi.object({
  tenantId: Joi.string().custom(validateObjectId).required()
    .messages({
      'any.invalid': 'Invalid tenant ID format',
      'any.required': 'Tenant ID is required'
    }),
  company: Joi.string().trim().min(1).max(200).required()
    .messages({
      'string.empty': 'Company name cannot be empty',
      'string.max': 'Company name cannot exceed 200 characters'
    }),
  contactName: Joi.string().trim().min(1).max(100).required()
    .messages({
      'string.empty': 'Contact name cannot be empty',
      'string.max': 'Contact name cannot exceed 100 characters'
    }),
  email: Joi.string().pattern(EMAIL_PATTERN).required()
    .messages({
      'string.pattern.base': 'Invalid email format',
      'any.required': 'Email is required'
    }),
  phone: Joi.string().pattern(PHONE_PATTERN).allow(null)
    .messages({
      'string.pattern.base': 'Phone number must be in E.164 format'
    }),
  category: Joi.string().valid(...Object.values(LeadCategory)).required()
    .messages({
      'any.only': 'Invalid lead category',
      'any.required': 'Lead category is required'
    }),
  priority: Joi.number().min(1).max(5).default(3)
    .messages({
      'number.min': 'Priority must be between 1 and 5',
      'number.max': 'Priority must be between 1 and 5'
    }),
  source: Joi.string().trim().max(100)
    .messages({
      'string.max': 'Source cannot exceed 100 characters'
    }),
  metadata: Joi.object().default({}),
  tags: Joi.array().items(Joi.string().trim().max(50)).default([])
    .messages({
      'string.max': 'Tag length cannot exceed 50 characters'
    })
});

/**
 * Schema for lead update validation
 */
export const updateLeadSchema = Joi.object({
  company: Joi.string().trim().min(1).max(200)
    .messages({
      'string.empty': 'Company name cannot be empty',
      'string.max': 'Company name cannot exceed 200 characters'
    }),
  contactName: Joi.string().trim().min(1).max(100)
    .messages({
      'string.empty': 'Contact name cannot be empty',
      'string.max': 'Contact name cannot exceed 100 characters'
    }),
  email: Joi.string().pattern(EMAIL_PATTERN)
    .messages({
      'string.pattern.base': 'Invalid email format'
    }),
  phone: Joi.string().pattern(PHONE_PATTERN).allow(null)
    .messages({
      'string.pattern.base': 'Phone number must be in E.164 format'
    }),
  category: Joi.string().valid(...Object.values(LeadCategory))
    .messages({
      'any.only': 'Invalid lead category'
    }),
  priority: Joi.number().min(1).max(5)
    .messages({
      'number.min': 'Priority must be between 1 and 5',
      'number.max': 'Priority must be between 1 and 5'
    }),
  metadata: Joi.object(),
  tags: Joi.array().items(Joi.string().trim().max(50))
    .messages({
      'string.max': 'Tag length cannot exceed 50 characters'
    }),
  isActive: Joi.boolean()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

/**
 * Validates lead data for creation with comprehensive security checks
 * @param leadData - The lead data to validate
 * @param tenantContext - The tenant context for isolation
 * @returns Promise resolving to true if validation passes
 * @throws LeadValidationError with detailed context if validation fails
 */
export async function validateCreateLead(
  leadData: Partial<ILead>,
  tenantContext: { tenantId: string }
): Promise<boolean> {
  try {
    // Validate tenant context first
    await validateTenantContext(tenantContext);

    // Ensure tenant IDs match
    if (leadData.tenantId?.toString() !== tenantContext.tenantId) {
      throw new LeadValidationError(
        'Tenant ID mismatch',
        ErrorCode.TENANT_VALIDATION_ERROR,
        { tenantId: 'Lead tenant ID does not match context tenant ID' }
      );
    }

    // Validate lead data
    const { error, value } = createLeadSchema.validate(leadData, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      throw new LeadValidationError(
        'Lead validation failed',
        ErrorCode.VALIDATION_ERROR,
        error.details.reduce((acc, detail) => ({
          ...acc,
          [detail.path.join('.')]: detail.message
        }), {})
      );
    }

    return true;
  } catch (error) {
    if (error instanceof LeadValidationError) {
      throw error;
    }
    throw new LeadValidationError(
      'Lead validation failed',
      ErrorCode.VALIDATION_ERROR,
      { message: error.message }
    );
  }
}

/**
 * Validates lead data for updates with security measures
 * @param leadData - The lead update data to validate
 * @param tenantContext - The tenant context for isolation
 * @returns Promise resolving to true if validation passes
 * @throws LeadValidationError with detailed context if validation fails
 */
export async function validateUpdateLead(
  leadData: Partial<ILead>,
  tenantContext: { tenantId: string }
): Promise<boolean> {
  try {
    // Validate tenant context first
    await validateTenantContext(tenantContext);

    // Validate lead data
    const { error, value } = updateLeadSchema.validate(leadData, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      throw new LeadValidationError(
        'Lead update validation failed',
        ErrorCode.VALIDATION_ERROR,
        error.details.reduce((acc, detail) => ({
          ...acc,
          [detail.path.join('.')]: detail.message
        }), {})
      );
    }

    // Validate category transition if category is being updated
    if (leadData.category) {
      const currentCategory = LeadCategory[leadData.category as keyof typeof LeadCategory];
      if (!currentCategory) {
        throw new LeadValidationError(
          'Invalid category transition',
          ErrorCode.VALIDATION_ERROR,
          { category: 'Invalid category value' }
        );
      }
    }

    return true;
  } catch (error) {
    if (error instanceof LeadValidationError) {
      throw error;
    }
    throw new LeadValidationError(
      'Lead update validation failed',
      ErrorCode.VALIDATION_ERROR,
      { message: error.message }
    );
  }
}