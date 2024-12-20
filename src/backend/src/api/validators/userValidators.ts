/**
 * @fileoverview User validation schemas and functions for the multi-tenant CRM system
 * Implements comprehensive validation for user operations with role-based access control
 * and tenant isolation.
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { ROLES } from '../../../constants/roles';
import { UserStatus } from '../../../interfaces/IUser';
import { ValidationError } from '../../../utils/validation';
import { ErrorCode } from '../../../constants/errorCodes';

/**
 * Regular expression for strong password validation
 * Requires minimum 12 characters, uppercase, lowercase, number, and special character
 */
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

/**
 * Regular expression for name validation
 * Allows letters, spaces, hyphens, and apostrophes
 */
const NAME_PATTERN = /^[a-zA-Z\s-']+$/;

/**
 * Validation schema for user creation
 * Implements comprehensive validation rules for new user accounts
 */
export const createUserSchema = Joi.object({
  email: Joi.string()
    .email({ 
      minDomainSegments: 2, 
      tlds: { allow: ['com', 'net', 'org', 'edu', 'gov'] } 
    })
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),

  firstName: Joi.string()
    .min(2)
    .max(50)
    .pattern(NAME_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'First name must be at least 2 characters',
      'string.max': 'First name cannot exceed 50 characters'
    }),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .pattern(NAME_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'Last name must be at least 2 characters',
      'string.max': 'Last name cannot exceed 50 characters'
    }),

  role: Joi.string()
    .valid(...Object.values(ROLES))
    .required()
    .messages({
      'any.only': 'Invalid user role',
      'any.required': 'Role is required'
    }),

  tenantId: Joi.string()
    .required()
    .messages({
      'any.required': 'Tenant ID is required'
    }),

  password: Joi.string()
    .pattern(PASSWORD_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'Password must be at least 12 characters long and contain uppercase, lowercase, numbers, and special characters',
      'any.required': 'Password is required'
    }),

  preferences: Joi.object({
    theme: Joi.string()
      .valid('light', 'dark')
      .default('light'),
    
    language: Joi.string()
      .valid('en', 'es', 'fr')
      .default('en'),
    
    notifications: Joi.object({
      email: Joi.boolean().default(true),
      inApp: Joi.boolean().default(true),
      desktop: Joi.boolean().default(true),
      leadUpdates: Joi.boolean().default(true),
      quoteUpdates: Joi.boolean().default(true),
      systemAlerts: Joi.boolean().default(true)
    }).default(),
    
    dashboardLayout: Joi.object({
      widgets: Joi.array().items(Joi.string()).default([]),
      layout: Joi.string().valid('grid', 'list').default('grid'),
      defaultView: Joi.string().valid('leads', 'quotes', 'reports').default('leads')
    }).default(),
    
    timezone: Joi.string().default('UTC'),
    dateFormat: Joi.string().default('YYYY-MM-DD')
  }).default()
});

/**
 * Validation schema for user updates
 * Implements partial update validation with role transition checks
 */
export const updateUserSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .pattern(NAME_PATTERN)
    .messages({
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes'
    }),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .pattern(NAME_PATTERN)
    .messages({
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes'
    }),

  role: Joi.string()
    .valid(...Object.values(ROLES))
    .messages({
      'any.only': 'Invalid user role'
    }),

  status: Joi.string()
    .valid(...Object.values(UserStatus))
    .messages({
      'any.only': 'Invalid user status'
    }),

  preferences: Joi.object({
    theme: Joi.string().valid('light', 'dark'),
    language: Joi.string().valid('en', 'es', 'fr'),
    notifications: Joi.object({
      email: Joi.boolean(),
      inApp: Joi.boolean(),
      desktop: Joi.boolean(),
      leadUpdates: Joi.boolean(),
      quoteUpdates: Joi.boolean(),
      systemAlerts: Joi.boolean()
    }),
    dashboardLayout: Joi.object({
      widgets: Joi.array().items(Joi.string()),
      layout: Joi.string().valid('grid', 'list'),
      defaultView: Joi.string().valid('leads', 'quotes', 'reports')
    }),
    timezone: Joi.string(),
    dateFormat: Joi.string()
  })
});

/**
 * Validates user creation data with enhanced security checks
 * @param userData - The user data to validate
 * @returns Promise<boolean> - Returns true if validation passes
 * @throws ValidationError with detailed messages if validation fails
 */
export async function validateCreateUser(userData: Record<string, any>): Promise<boolean> {
  try {
    await createUserSchema.validateAsync(userData, { abortEarly: false });
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
 * Validates user update data with role transition checks
 * @param userData - The user update data to validate
 * @returns Promise<boolean> - Returns true if validation passes
 * @throws ValidationError with detailed messages if validation fails
 */
export async function validateUpdateUser(userData: Record<string, any>): Promise<boolean> {
  try {
    await updateUserSchema.validateAsync(userData, { abortEarly: false });
    
    // Additional validation for role transitions
    if (userData.role === ROLES.ADMIN && userData.status === UserStatus.INACTIVE) {
      throw new ValidationError(
        'User validation failed',
        ErrorCode.VALIDATION_ERROR,
        { role: 'Admin users cannot be set to inactive status' }
      );
    }

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