/**
 * @fileoverview Activity routes configuration for the multi-tenant CRM system.
 * Implements secure, tenant-isolated routes for activity management with
 * comprehensive validation, caching, and real-time update support.
 * @version 1.0.0
 */

import express, { Router } from 'express'; // ^4.18.x
import rateLimit from 'express-rate-limit'; // ^6.x.x
import compression from 'compression'; // ^1.7.x
import { ActivityController } from '../controllers/ActivityController';
import { authenticate, authorize } from '../middlewares/authMiddleware';
import { validateActivity } from '../validators/activityValidators';
import { PERMISSIONS } from '../../constants/permissions';
import logger from '../../utils/logger';

/**
 * Rate limiting configurations for different activity endpoints
 */
const rateLimiters = {
  create: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Too many activity creation requests' },
    standardHeaders: true,
    legacyHeaders: false
  }),
  read: rateLimit({
    windowMs: 60 * 1000,
    max: 1000, // 1000 requests per minute
    message: { error: 'Too many activity read requests' },
    standardHeaders: true,
    legacyHeaders: false
  }),
  tenant: rateLimit({
    windowMs: 60 * 1000,
    max: 500, // 500 requests per minute
    message: { error: 'Too many tenant activity requests' },
    standardHeaders: true,
    legacyHeaders: false
  })
};

/**
 * Cache control configurations for different endpoints
 */
const cacheControl = {
  leadActivities: 'private, max-age=300', // 5 minutes
  tenantActivities: 'private, max-age=180' // 3 minutes
};

/**
 * Configures and returns the activity router with all routes and middleware
 * @param activityController Instance of ActivityController for handling requests
 * @returns Configured Express router
 */
export const configureActivityRoutes = (
  activityController: ActivityController
): Router => {
  const router = express.Router();

  // Apply common middleware
  router.use(compression());
  router.use(express.json({ limit: '10kb' })); // Limit payload size
  
  // Security headers
  router.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');
    next();
  });

  /**
   * POST /activities
   * Creates a new activity record with tenant isolation
   * @requires authentication
   * @requires create_activity permission
   */
  router.post('/activities',
    authenticate,
    authorize([PERMISSIONS.LEAD_CREATE]),
    rateLimiters.create,
    validateActivity,
    async (req, res, next) => {
      try {
        await activityController.createActivity(req, res);
      } catch (error) {
        logger.error('Error in activity creation route', {
          error,
          tenantId: req.tenantId,
          path: req.path
        });
        next(error);
      }
    }
  );

  /**
   * GET /activities/lead/:leadId
   * Retrieves paginated activities for a specific lead with caching
   * @requires authentication
   * @requires read_activity permission
   */
  router.get('/activities/lead/:leadId',
    authenticate,
    authorize([PERMISSIONS.LEAD_VIEW]),
    rateLimiters.read,
    async (req, res, next) => {
      try {
        res.set('Cache-Control', cacheControl.leadActivities);
        await activityController.getLeadActivities(req, res);
      } catch (error) {
        logger.error('Error in lead activities route', {
          error,
          tenantId: req.tenantId,
          leadId: req.params.leadId
        });
        next(error);
      }
    }
  );

  /**
   * GET /activities/tenant
   * Retrieves paginated activities for entire tenant with filtering
   * @requires authentication
   * @requires read_tenant_activity permission
   */
  router.get('/activities/tenant',
    authenticate,
    authorize([PERMISSIONS.TENANT_SETTINGS_VIEW]),
    rateLimiters.tenant,
    async (req, res, next) => {
      try {
        res.set('Cache-Control', cacheControl.tenantActivities);
        await activityController.getTenantActivities(req, res);
      } catch (error) {
        logger.error('Error in tenant activities route', {
          error,
          tenantId: req.tenantId
        });
        next(error);
      }
    }
  );

  // Error handling middleware
  router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Activity routes error handler', {
      error,
      path: req.path,
      method: req.method
    });

    res.status(error.status || 500).json({
      error: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR'
    });
  });

  return router;
};

// Export configured router
export default configureActivityRoutes;