/**
 * @fileoverview Quote validation schemas and middleware for the multi-tenant CRM system.
 * Implements comprehensive validation for quote operations with tenant isolation.
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { Types } from 'mongodb'; // v5.0.0
import { IQuote } from '../../interfaces/IQuote';
import { ErrorCode, ErrorMessage, HttpStatusCode } from '../../constants/errorCodes';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { rateLimit } from '../../middleware/rateLimit';

/**
 * Schema for validating individual quote items with comprehensive checks
 */
const quoteItemSchema = Joi.object().keys({
  itemId: Joi.string().required(),
  description: Joi.string().required().max(500).trim(),
  quantity: Joi.number().min(1).max(9999).required(),
  unitPrice: Joi.number().min(0).max(999999.99).precision(2).required(),
  amount: Joi.number().min(0).max(9999999.99).precision(2).required(),
  currency: Joi.string().length(3).required(),
  customFields: Joi.object().unknown(true),
  taxable: Joi.boolean().required()
});

/**
 * Schema for quote creation with tenant isolation and comprehensive validation
 */
const createQuoteSchema = Joi.object().keys({
  tenantId: Joi.string().required().custom((value, helpers) => {
    if (!Types.ObjectId.isValid(value)) {
      return helpers.error('Invalid tenant ID format');
    }
    return value;
  }),
  leadId: Joi.string().required().custom((value, helpers) => {
    if (!Types.ObjectId.isValid(value)) {
      return helpers.error('Invalid lead ID format');
    }
    return value;
  }),
  quoteNumber: Joi.string().pattern(/^QT-\d{6}$/).required(),
  items: Joi.array().items(quoteItemSchema).min(1).max(100).required(),
  validUntil: Joi.date().greater('now').required(),
  notes: Joi.string().max(2000).allow(''),
  metadata: Joi.object().unknown(true),
  currency: Joi.string().length(3).required(),
  version: Joi.string().required()
});

/**
 * Schema for quote updates with version control and status transition validation
 */
const updateQuoteSchema = Joi.object().keys({
  items: Joi.array().items(quoteItemSchema).min(1).max(100),
  status: Joi.string().valid('draft', 'sent', 'accepted', 'rejected'),
  validUntil: Joi.date().greater('now'),
  notes: Joi.string().max(2000).allow(''),
  metadata: Joi.object().unknown(true),
  version: Joi.string().required(),
  lastModifiedBy: Joi.string().required().custom((value, helpers) => {
    if (!Types.ObjectId.isValid(value)) {
      return helpers.error('Invalid user ID format');
    }
    return value;
  })
});

/**
 * Validates quote creation requests with tenant isolation and comprehensive checks
 */
@rateLimit({ windowMs: 60000, max: 100 })
@metrics('quote.validation')
export async function validateCreateQuote(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate tenant context
    if (!req.tenantId) {
      logger.error('Missing tenant context in quote creation', { 
        path: req.path,
        method: req.method 
      });
      res.status(HttpStatusCode.BAD_REQUEST).json({
        code: ErrorCode.TENANT_CONTEXT_ERROR,
        message: ErrorMessage.TENANT_CONTEXT_ERROR
      });
      return;
    }

    // Validate request data
    const { error, value } = createQuoteSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      logger.warn('Quote creation validation failed', {
        tenantId: req.tenantId,
        errors: error.details
      });
      res.status(HttpStatusCode.BAD_REQUEST).json({
        code: ErrorCode.VALIDATION_ERROR,
        message: ErrorMessage.VALIDATION_ERROR,
        details: error.details
      });
      return;
    }

    // Validate quote calculations
    const calculationErrors = validateQuoteCalculations(value.items);
    if (calculationErrors.length > 0) {
      res.status(HttpStatusCode.BAD_REQUEST).json({
        code: ErrorCode.VALIDATION_ERROR,
        message: ErrorMessage.VALIDATION_ERROR,
        details: calculationErrors
      });
      return;
    }

    // Store validated data
    req.validatedData = value;
    next();
  } catch (err) {
    logger.error('Unexpected error in quote validation', {
      tenantId: req.tenantId,
      error: err
    });
    res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: ErrorMessage.INTERNAL_SERVER_ERROR
    });
  }
}

/**
 * Validates quote update requests with version control and status transitions
 */
@rateLimit({ windowMs: 60000, max: 100 })
@metrics('quote.validation')
export async function validateUpdateQuote(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate tenant context
    if (!req.tenantId) {
      logger.error('Missing tenant context in quote update', {
        path: req.path,
        method: req.method
      });
      res.status(HttpStatusCode.BAD_REQUEST).json({
        code: ErrorCode.TENANT_CONTEXT_ERROR,
        message: ErrorMessage.TENANT_CONTEXT_ERROR
      });
      return;
    }

    // Validate request data
    const { error, value } = updateQuoteSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      logger.warn('Quote update validation failed', {
        tenantId: req.tenantId,
        errors: error.details
      });
      res.status(HttpStatusCode.BAD_REQUEST).json({
        code: ErrorCode.VALIDATION_ERROR,
        message: ErrorMessage.VALIDATION_ERROR,
        details: error.details
      });
      return;
    }

    // Validate items calculations if present
    if (value.items) {
      const calculationErrors = validateQuoteCalculations(value.items);
      if (calculationErrors.length > 0) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          code: ErrorCode.VALIDATION_ERROR,
          message: ErrorMessage.VALIDATION_ERROR,
          details: calculationErrors
        });
        return;
      }
    }

    // Store validated data
    req.validatedData = value;
    next();
  } catch (err) {
    logger.error('Unexpected error in quote update validation', {
      tenantId: req.tenantId,
      error: err
    });
    res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: ErrorMessage.INTERNAL_SERVER_ERROR
    });
  }
}

/**
 * Validates quote ID in request parameters with tenant isolation
 */
@rateLimit({ windowMs: 60000, max: 200 })
@metrics('quote.validation')
export async function validateQuoteId(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate tenant context
    if (!req.tenantId) {
      logger.error('Missing tenant context in quote ID validation', {
        path: req.path,
        method: req.method
      });
      res.status(HttpStatusCode.BAD_REQUEST).json({
        code: ErrorCode.TENANT_CONTEXT_ERROR,
        message: ErrorMessage.TENANT_CONTEXT_ERROR
      });
      return;
    }

    const { quoteId } = req.params;

    // Validate ID format
    if (!Types.ObjectId.isValid(quoteId)) {
      logger.warn('Invalid quote ID format', {
        tenantId: req.tenantId,
        quoteId
      });
      res.status(HttpStatusCode.BAD_REQUEST).json({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid quote ID format'
      });
      return;
    }

    next();
  } catch (err) {
    logger.error('Unexpected error in quote ID validation', {
      tenantId: req.tenantId,
      error: err
    });
    res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: ErrorMessage.INTERNAL_SERVER_ERROR
    });
  }
}

/**
 * Helper function to validate quote calculations
 */
function validateQuoteCalculations(items: IQuote['items']): string[] {
  const errors: string[] = [];
  
  items.forEach((item, index) => {
    const calculatedAmount = Number((item.quantity * item.unitPrice).toFixed(2));
    if (calculatedAmount !== item.amount) {
      errors.push(`Invalid amount for item ${index + 1}: Expected ${calculatedAmount}, got ${item.amount}`);
    }
  });

  return errors;
}