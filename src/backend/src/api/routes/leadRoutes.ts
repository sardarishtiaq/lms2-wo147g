/**
 * @fileoverview Express router configuration for lead management endpoints implementing
 * the 12-stage pipeline process with complete tenant isolation, enhanced security,
 * and comprehensive validation.
 * @version 1.0.0
 */

import express, { Router } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import { LeadController } from '../controllers/LeadController';
import { authenticate, authorize } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { tenantContextMiddleware } from '../middlewares/tenantContextMiddleware';
import { rateLimitMiddleware } from '../middlewares/rateLimitMiddleware';
import { errorHandler } from '../middlewares/errorMiddleware';
import { createLeadSchema, updateLeadSchema, assignLeadSchema, updateLeadCategorySchema } from '../validators/leadValidators';
import { PERMISSIONS } from '../../constants/permissions';

/**
 * Configures and returns Express router with secure lead management endpoints
 * @param leadController - Initialized LeadController instance
 * @returns Configured Express router with lead endpoints
 */
export const configureLeadRoutes = (leadController: LeadController): Router => {
  const router = express.Router();

  // Apply security middleware
  router.use(helmet());

  // Apply rate limiting
  router.use(rateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipFailedRequests: true
  }));

  // Apply tenant context middleware globally
  router.use(tenantContextMiddleware);

  /**
   * POST /leads
   * Creates a new lead with tenant isolation and validation
   * @requires authentication
   * @requires permission lead:create
   */
  router.post(
    '/',
    authenticate,
    authorize([PERMISSIONS.LEAD_CREATE]),
    validateRequest(createLeadSchema),
    leadController.createLead
  );

  /**
   * PUT /leads/:id
   * Updates an existing lead with security checks
   * @requires authentication
   * @requires permission lead:update
   */
  router.put(
    '/:id',
    authenticate,
    authorize([PERMISSIONS.LEAD_UPDATE]),
    validateRequest(updateLeadSchema),
    leadController.updateLead
  );

  /**
   * GET /leads/category/:category
   * Gets leads by category with tenant isolation
   * @requires authentication
   * @requires permission lead:view
   */
  router.get(
    '/category/:category',
    authenticate,
    authorize([PERMISSIONS.LEAD_VIEW]),
    leadController.getLeadsByCategory
  );

  /**
   * POST /leads/:id/assign
   * Assigns lead to user with validation
   * @requires authentication
   * @requires permission lead:assign
   */
  router.post(
    '/:id/assign',
    authenticate,
    authorize([PERMISSIONS.LEAD_ASSIGN]),
    validateRequest(assignLeadSchema),
    leadController.assignLead
  );

  /**
   * PATCH /leads/:id/category
   * Updates lead category in pipeline with security
   * @requires authentication
   * @requires permission lead:update
   */
  router.patch(
    '/:id/category',
    authenticate,
    authorize([PERMISSIONS.LEAD_UPDATE]),
    validateRequest(updateLeadCategorySchema),
    leadController.updateLeadCategory
  );

  // Apply error handling middleware
  router.use(errorHandler);

  return router;
};

/**
 * Export configured router for use in main application
 */
export const leadRouter = configureLeadRoutes(new LeadController());

export default leadRouter;