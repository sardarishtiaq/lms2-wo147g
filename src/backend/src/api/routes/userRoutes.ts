/**
 * @fileoverview User routes configuration for multi-tenant CRM system
 * Implements secure routes with comprehensive authentication, authorization,
 * validation, and tenant isolation.
 * @version 1.0.0
 */

import express from 'express'; // ^4.18.2
import { UserController } from '../controllers/UserController';
import { authenticate, authorize } from '../middlewares/authMiddleware';
import { rateLimit } from '../middlewares/rateLimitMiddleware';
import { validateRequest } from '../middlewares/validationMiddleware';
import { userValidators } from '../validators/userValidators';

// Initialize router
const router = express.Router();

/**
 * Configures user management routes with comprehensive security measures
 * @param userController - Initialized user controller instance
 */
const initializeRoutes = (userController: UserController): express.Router => {
  // Authentication routes with rate limiting
  router.post(
    '/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      skipFailedRequests: false
    }),
    validateRequest(userValidators.loginSchema),
    userController.authenticateUser
  );

  router.post(
    '/auth/refresh',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
      skipFailedRequests: false
    }),
    userController.refreshToken
  );

  router.post(
    '/auth/mfa/validate',
    rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 3,
      skipFailedRequests: false
    }),
    userController.validateMFA
  );

  // User management routes with authentication and authorization
  router.post(
    '/users',
    authenticate,
    authorize(['user:create']),
    validateRequest(userValidators.createUserSchema),
    userController.createUser
  );

  router.get(
    '/users',
    authenticate,
    authorize(['user:view']),
    userController.getUsersByTenant
  );

  router.put(
    '/users/:userId',
    authenticate,
    authorize(['user:update']),
    validateRequest(userValidators.updateUserSchema),
    userController.updateUser
  );

  router.patch(
    '/users/:userId/preferences',
    authenticate,
    validateRequest(userValidators.preferencesSchema),
    userController.updateUserPreferences
  );

  router.delete(
    '/users/:userId',
    authenticate,
    authorize(['user:delete']),
    userController.deactivateUser
  );

  return router;
};

// Export configured router
export default initializeRoutes;

// Named exports for testing and dependency injection
export {
  router,
  initializeRoutes
};