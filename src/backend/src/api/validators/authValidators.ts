/**
 * @fileoverview Authentication validation schemas and functions for the multi-tenant CRM system
 * Implements comprehensive validation for authentication-related requests with enhanced security
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { IUser } from '../../interfaces/IUser';
import { validateUser } from '../../utils/validation';
import { ROLES } from '../../constants/roles';
import { ErrorCode } from '../../constants/errorCodes';

/**
 * Custom validation error class for authentication-specific errors
 */
class AuthValidationError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = ErrorCode.AUTHENTICATION_ERROR,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthValidationError';
  }
}

/**
 * Enhanced password validation pattern requiring strong passwords
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

/**
 * Login request validation schema
 * Enforces email format, password strength, and tenant context
 */
export const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    }),
  tenantId: Joi.string()
    .required()
    .messages({
      'any.required': 'Tenant ID is required'
    })
}).required();

/**
 * Registration request validation schema
 * Implements comprehensive validation for new user registration
 */
export const registerSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .pattern(PASSWORD_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'Password must be at least 12 characters long and contain uppercase, lowercase, numbers, and special characters',
      'any.required': 'Password is required'
    }),
  firstName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'First name must be at least 2 characters',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),
  lastName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Last name must be at least 2 characters',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    }),
  tenantId: Joi.string()
    .required()
    .messages({
      'any.required': 'Tenant ID is required'
    }),
  role: Joi.string()
    .valid(...Object.values(ROLES))
    .required()
    .messages({
      'any.only': 'Invalid user role',
      'any.required': 'User role is required'
    })
}).required();

/**
 * Forgot password request validation schema
 */
export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required'
    }),
  tenantId: Joi.string()
    .required()
    .messages({
      'any.required': 'Tenant ID is required'
    })
}).required();

/**
 * Reset password request validation schema
 */
export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Reset token is required'
    }),
  password: Joi.string()
    .pattern(PASSWORD_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'Password must be at least 12 characters long and contain uppercase, lowercase, numbers, and special characters',
      'any.required': 'Password is required'
    }),
  tenantId: Joi.string()
    .required()
    .messages({
      'any.required': 'Tenant ID is required'
    })
}).required();

/**
 * Validates login request data with enhanced security measures
 * @param loginData Login request data
 * @returns Promise<boolean> indicating validation success
 * @throws AuthValidationError with detailed message if validation fails
 */
export async function validateLoginRequest(
  loginData: { email: string; password: string; tenantId: string }
): Promise<boolean> {
  try {
    await loginSchema.validateAsync(loginData, { abortEarly: false });

    // Additional security checks can be implemented here
    // For example: rate limiting, IP validation, etc.

    return true;
  } catch (error) {
    if (error instanceof Joi.ValidationError) {
      throw new AuthValidationError(
        'Login validation failed',
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
 * Validates registration request data with tenant isolation
 * @param registrationData Registration request data
 * @returns Promise<boolean> indicating validation success
 * @throws AuthValidationError with detailed message if validation fails
 */
export async function validateRegistrationRequest(
  registrationData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantId: string;
    role: ROLES;
  }
): Promise<boolean> {
  try {
    await registerSchema.validateAsync(registrationData, { abortEarly: false });

    // Additional validation using core validation utility
    await validateUser({
      email: registrationData.email,
      tenantId: registrationData.tenantId,
      role: registrationData.role
    } as IUser);

    return true;
  } catch (error) {
    if (error instanceof Joi.ValidationError) {
      throw new AuthValidationError(
        'Registration validation failed',
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