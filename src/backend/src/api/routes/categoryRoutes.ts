/**
 * @fileoverview Express router configuration for lead category management endpoints.
 * Implements comprehensive route handlers for the 12-stage pipeline process with
 * strict tenant isolation, authentication, and authorization.
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.x
import { CategoryController } from '../controllers/CategoryController';
import { authenticate, authorize } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { validateCreateCategory, validateUpdateCategory } from '../validators/categoryValidators';
import { rateLimitMiddleware } from '../middlewares/rateLimitMiddleware';
import { PERMISSIONS } from '../../constants/permissions';

// Initialize router with strict routing enabled
const router = Router({ strict: true });

/**
 * Rate limit configuration for category endpoints
 * More restrictive limits for write operations
 */
const readRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  skipFailedRequests: true
});

const writeRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50,
  skipFailedRequests: false
});

/**
 * GET /categories
 * Retrieves all categories for the tenant with pagination and filtering
 * @security JWT, RBAC
 */
router.get('/categories',
  authenticate,
  authorize([PERMISSIONS.LEAD_VIEW]),
  readRateLimit,
  async (req, res, next) => {
    try {
      await CategoryController.getCategories(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /categories/active
 * Retrieves only active categories for the tenant
 * @security JWT, RBAC
 */
router.get('/categories/active',
  authenticate,
  authorize([PERMISSIONS.LEAD_VIEW]),
  readRateLimit,
  async (req, res, next) => {
    try {
      await CategoryController.getActiveCategories(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /categories/:type
 * Retrieves a specific category by type with tenant isolation
 * @security JWT, RBAC
 */
router.get('/categories/:type',
  authenticate,
  authorize([PERMISSIONS.LEAD_VIEW]),
  readRateLimit,
  async (req, res, next) => {
    try {
      await CategoryController.getCategoryByType(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /categories
 * Creates a new category with comprehensive validation
 * @security JWT, RBAC
 */
router.post('/categories',
  authenticate,
  authorize([PERMISSIONS.SYSTEM_CONFIG_UPDATE]),
  writeRateLimit,
  validateRequest(validateCreateCategory),
  async (req, res, next) => {
    try {
      await CategoryController.createCategory(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /categories/:id
 * Updates an existing category with validation and tenant isolation
 * @security JWT, RBAC
 */
router.put('/categories/:id',
  authenticate,
  authorize([PERMISSIONS.SYSTEM_CONFIG_UPDATE]),
  writeRateLimit,
  validateRequest(validateUpdateCategory),
  async (req, res, next) => {
    try {
      await CategoryController.updateCategory(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Middleware to handle category-specific errors
 */
router.use((error: any, req: any, res: any, next: any) => {
  if (error.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      details: error.details
    });
    return;
  }
  next(error);
});

export default router;