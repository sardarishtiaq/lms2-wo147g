/**
 * @fileoverview Quote management routes for the multi-tenant CRM system.
 * Implements secure endpoints for quote operations with comprehensive validation,
 * tenant isolation, and rate limiting.
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import { rateLimit } from 'express-rate-limit'; // ^6.7.0
import { QuoteController } from '../controllers/QuoteController';
import { 
  authenticate, 
  authorize, 
  validateTenantContext 
} from '../middlewares/authMiddleware';
import { 
  validateCreateQuote, 
  validateUpdateQuote, 
  validateQuoteId 
} from '../validators/quoteValidators';
import { cacheResponse } from '../middlewares/cacheMiddleware';
import { paginationMiddleware } from '../middlewares/paginationMiddleware';
import { ErrorCode } from '../../constants/errorCodes';
import logger from '../../utils/logger';

// Create router instance with strict routing
const router = Router({ strict: true });

/**
 * Rate limiter configuration for quote endpoints
 */
const quoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each tenant to 100 requests per window
  keyGenerator: (req) => `${req.tenantId}:quotes`,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for quote endpoints', {
      tenantId: req.tenantId,
      path: req.path
    });
    res.status(429).json({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Too many quote requests, please try again later'
    });
  }
});

/**
 * Rate limiter for quote email sending
 */
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each tenant to 50 email sends per hour
  keyGenerator: (req) => `${req.tenantId}:quote-emails`,
  handler: (req, res) => {
    logger.warn('Email rate limit exceeded', {
      tenantId: req.tenantId,
      quoteId: req.params.id
    });
    res.status(429).json({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Email sending limit exceeded, please try again later'
    });
  }
});

/**
 * @route POST /api/quotes
 * @description Create a new quote with tenant isolation and validation
 * @access Private
 */
router.post(
  '/',
  authenticate,
  validateTenantContext,
  authorize(['quote:create']),
  quoteLimiter,
  validateCreateQuote,
  async (req, res, next) => {
    try {
      const quoteController = new QuoteController();
      await quoteController.createQuote(req, res, next);
    } catch (error) {
      logger.error('Error in quote creation route', {
        tenantId: req.tenantId,
        error
      });
      next(error);
    }
  }
);

/**
 * @route PUT /api/quotes/:id
 * @description Update an existing quote with version control
 * @access Private
 */
router.put(
  '/:id',
  authenticate,
  validateTenantContext,
  authorize(['quote:update']),
  validateQuoteId,
  validateUpdateQuote,
  async (req, res, next) => {
    try {
      const quoteController = new QuoteController();
      await quoteController.updateQuote(req, res, next);
    } catch (error) {
      logger.error('Error in quote update route', {
        tenantId: req.tenantId,
        quoteId: req.params.id,
        error
      });
      next(error);
    }
  }
);

/**
 * @route GET /api/quotes/:id
 * @description Get quote by ID with caching
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  validateTenantContext,
  authorize(['quote:view']),
  validateQuoteId,
  cacheResponse({ ttl: 300 }), // Cache for 5 minutes
  async (req, res, next) => {
    try {
      const quoteController = new QuoteController();
      await quoteController.getQuoteById(req, res, next);
    } catch (error) {
      logger.error('Error in quote retrieval route', {
        tenantId: req.tenantId,
        quoteId: req.params.id,
        error
      });
      next(error);
    }
  }
);

/**
 * @route GET /api/quotes/lead/:leadId
 * @description Get all quotes for a lead with pagination
 * @access Private
 */
router.get(
  '/lead/:leadId',
  authenticate,
  validateTenantContext,
  authorize(['quote:view']),
  paginationMiddleware,
  async (req, res, next) => {
    try {
      const quoteController = new QuoteController();
      await quoteController.getQuotesByLead(req, res, next);
    } catch (error) {
      logger.error('Error in lead quotes retrieval route', {
        tenantId: req.tenantId,
        leadId: req.params.leadId,
        error
      });
      next(error);
    }
  }
);

/**
 * @route POST /api/quotes/:id/send
 * @description Send quote via email with rate limiting
 * @access Private
 */
router.post(
  '/:id/send',
  authenticate,
  validateTenantContext,
  authorize(['quote:send']),
  validateQuoteId,
  emailLimiter,
  async (req, res, next) => {
    try {
      const quoteController = new QuoteController();
      await quoteController.sendQuote(req, res, next);
    } catch (error) {
      logger.error('Error in quote email sending route', {
        tenantId: req.tenantId,
        quoteId: req.params.id,
        error
      });
      next(error);
    }
  }
);

// Export configured router
export default router;