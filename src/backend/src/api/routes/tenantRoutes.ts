/**
 * @fileoverview Express router configuration for tenant management endpoints
 * Implements secure tenant operations with comprehensive validation and audit logging
 * @version 1.0.0
 */

import express from 'express'; // ^4.18.2
import rateLimit from 'express-rate-limit'; // ^6.0.0

import { TenantController } from '../controllers/TenantController';
import { authenticate, authorize, validateTenantContext } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { tenantValidationSchemas } from '../validators/tenantValidators';

/**
 * Router instance for tenant management endpoints
 */
const router = express.Router();

/**
 * Rate limiting configuration for tenant operations
 * More restrictive limits for sensitive operations
 */
const createTenantLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many tenant creation attempts, please try again later'
});

const updateTenantLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour
  message: 'Too many tenant update attempts, please try again later'
});

const getTenantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many tenant retrieval attempts, please try again later'
});

/**
 * POST /api/tenants
 * Create a new tenant with comprehensive validation
 * @requires ADMIN role
 */
router.post('/',
  createTenantLimiter,
  authenticate,
  authorize(['ADMIN']),
  validateRequest(tenantValidationSchemas.createTenantSchema),
  TenantController.createTenant
);

/**
 * GET /api/tenants/:tenantId
 * Retrieve tenant details with security validation
 * @requires ADMIN or MANAGER role
 */
router.get('/:tenantId',
  getTenantLimiter,
  authenticate,
  authorize(['ADMIN', 'MANAGER']),
  validateTenantContext,
  TenantController.getTenant
);

/**
 * PATCH /api/tenants/:tenantId/settings
 * Update tenant settings with validation
 * @requires ADMIN role
 */
router.patch('/:tenantId/settings',
  updateTenantLimiter,
  authenticate,
  authorize(['ADMIN']),
  validateTenantContext,
  validateRequest(tenantValidationSchemas.updateTenantSettingsSchema),
  TenantController.updateTenantSettings
);

/**
 * PATCH /api/tenants/:tenantId/status
 * Update tenant status with security checks
 * @requires ADMIN role
 */
router.patch('/:tenantId/status',
  updateTenantLimiter,
  authenticate,
  authorize(['ADMIN']),
  validateTenantContext,
  validateRequest(tenantValidationSchemas.updateTenantStatusSchema),
  TenantController.updateTenantStatus
);

/**
 * DELETE /api/tenants/:tenantId
 * Soft delete tenant with security validation
 * @requires ADMIN role
 */
router.delete('/:tenantId',
  createTenantLimiter, // Using stricter rate limit for deletions
  authenticate,
  authorize(['ADMIN']),
  validateTenantContext,
  TenantController.deleteTenant
);

// Export configured router
export default router;