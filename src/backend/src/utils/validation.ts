/**
 * @fileoverview Core validation utility module providing comprehensive validation functions
 * for leads, users, quotes, and tenant data with enhanced security measures.
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { ObjectId } from 'mongodb'; // v5.0.0
import { ErrorCode } from '../constants/errorCodes';
import { ILead } from '../interfaces/ILead';
import { LeadCategory } from '../constants/leadCategories';

/**
 * Custom validation error class for detailed error reporting
 */
class ValidationError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = ErrorCode.VALIDATION_ERROR,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ValidationError';
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
 * Enhanced phone number validation pattern following E.164 format
 */
const PHONE_PATTERN = /^\+[1-9]\d{1,14}$/;

/**
 * Enhanced password validation pattern requiring strong passwords
 */
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

/**
 * Joi schema for lead validation with enhanced security rules
 */
const leadSchema = Joi.object({
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
  email: Joi.string().email({ tlds: { allow: false } }).required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),
  phone: Joi.string().pattern(PHONE_PATTERN)
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
  metadata: Joi.object().default({})
});

/**
 * Joi schema for user validation with security focus
 */
const userSchema = Joi.object({
  tenantId: Joi.string().custom(validateObjectId).required()
    .messages({
      'any.invalid': 'Invalid tenant ID format',
      'any.required': 'Tenant ID is required'
    }),
  email: Joi.string().email({ tlds: { allow: false } }).required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),
  password: Joi.string().pattern(PASSWORD_PATTERN).required()
    .messages({
      'string.pattern.base': 'Password must be at least 12 characters long and contain uppercase, lowercase, numbers, and special characters',
      'any.required': 'Password is required'
    }),
  role: Joi.string().valid('admin', 'manager', 'agent', 'viewer').required()
    .messages({
      'any.only': 'Invalid user role',
      'any.required': 'User role is required'
    })
});

/**
 * Joi schema for quote validation with business rules
 */
const quoteSchema = Joi.object({
  tenantId: Joi.string().custom(validateObjectId).required(),
  leadId: Joi.string().custom(validateObjectId).required(),
  items: Joi.array().items(Joi.object({
    description: Joi.string().required(),
    quantity: Joi.number().positive().required(),
    unitPrice: Joi.number().positive().required(),
    total: Joi.number().positive().required()
  })).min(1).required(),
  total: Joi.number().positive().required(),
  status: Joi.string().valid('draft', 'sent', 'accepted', 'rejected').required()
});

/**
 * Joi schema for tenant context validation
 */
const tenantSchema = Joi.object({
  tenantId: Joi.string().custom(validateObjectId).required(),
  name: Joi.string().trim().min(1).max(200).required(),
  settings: Joi.object().default({}),
  status: Joi.string().valid('active', 'inactive').required()
});

/**
 * Validates lead data with enhanced validation rules
 * @param leadData - The lead data to validate
 * @returns Promise resolving to true if validation passes
 * @throws ValidationError with detailed message if validation fails
 */
export async function validateLead(leadData: Partial<ILead>): Promise<boolean> {
  try {
    await leadSchema.validateAsync(leadData, { abortEarly: false });
    return true;
  } catch (error) {
    if (error instanceof Joi.ValidationError) {
      throw new ValidationError(
        'Lead validation failed',
        ErrorCode.VALIDATION_ERROR,
        error.details.reduce((acc, detail) => ({
          ...acc,
          [detail.path.join('.')]: detail.message
        }), {})
      );
    }
    throw error;
  }
}

/**
 * Validates user data with security-focused rules
 * @param userData - The user data to validate
 * @returns Promise resolving to true if validation passes
 * @throws ValidationError with detailed message if validation fails
 */
export async function validateUser(userData: Record<string, any>): Promise<boolean> {
  try {
    await userSchema.validateAsync(userData, { abortEarly: false });
    return true;
  } catch (error) {
    if (error instanceof Joi.ValidationError) {
      throw new ValidationError(
        'User validation failed',
        ErrorCode.VALIDATION_ERROR,
        error.details.reduce((acc, detail) => ({
          ...acc,
          [detail.path.join('.')]: detail.message
        }), {})
      );
    }
    throw error;
  }
}

/**
 * Validates quote data with business rules
 * @param quoteData - The quote data to validate
 * @returns Promise resolving to true if validation passes
 * @throws ValidationError with detailed message if validation fails
 */
export async function validateQuote(quoteData: Record<string, any>): Promise<boolean> {
  try {
    await quoteSchema.validateAsync(quoteData, { abortEarly: false });
    
    // Additional business rule: validate total matches sum of item totals
    const calculatedTotal = quoteData.items.reduce(
      (sum: number, item: any) => sum + (item.total || 0),
      0
    );
    
    if (Math.abs(calculatedTotal - quoteData.total) > 0.01) {
      throw new ValidationError(
        'Quote validation failed',
        ErrorCode.VALIDATION_ERROR,
        { total: 'Total amount does not match sum of item totals' }
      );
    }
    
    return true;
  } catch (error) {
    if (error instanceof Joi.ValidationError) {
      throw new ValidationError(
        'Quote validation failed',
        ErrorCode.VALIDATION_ERROR,
        error.details.reduce((acc, detail) => ({
          ...acc,
          [detail.path.join('.')]: detail.message
        }), {})
      );
    }
    throw error;
  }
}

/**
 * Validates tenant context with isolation checks
 * @param tenantData - The tenant data to validate
 * @returns Promise resolving to true if validation passes
 * @throws ValidationError with detailed message if validation fails
 */
export async function validateTenantContext(tenantData: Record<string, any>): Promise<boolean> {
  try {
    await tenantSchema.validateAsync(tenantData, { abortEarly: false });
    return true;
  } catch (error) {
    if (error instanceof Joi.ValidationError) {
      throw new ValidationError(
        'Tenant validation failed',
        ErrorCode.VALIDATION_ERROR,
        error.details.reduce((acc, detail) => ({
          ...acc,
          [detail.path.join('.')]: detail.message
        }), {})
      );
    }
    throw error;
  }
}