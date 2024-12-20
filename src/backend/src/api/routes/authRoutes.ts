/**
 * Authentication Routes Implementation
 * Version: 1.0.0
 * 
 * Implements secure authentication endpoints with JWT token management,
 * tenant isolation, and comprehensive security measures.
 */

import express, { Router } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import csrf from 'csurf'; // ^1.11.0
import { AuthController } from '../controllers/AuthController';
import { validateRequest } from '../middlewares/validationMiddleware';
import { authenticate } from '../middlewares/authMiddleware';
import { rateLimitMiddleware } from '../middlewares/rateLimitMiddleware';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/authValidators';

/**
 * Initializes authentication routes with security measures
 * @param authController - Instance of AuthController
 * @returns Configured Express router
 */
const initializeAuthRoutes = (authController: AuthController): Router => {
  const router = express.Router();

  // Apply security middlewares
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    xssFilter: true,
    noSniff: true,
    hidePoweredBy: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'same-origin' }
  }));

  // Apply CSRF protection
  router.use(csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    }
  }));

  // Login endpoint with rate limiting and validation
  router.post('/login',
    rateLimitMiddleware({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      skipFailedRequests: false
    }),
    validateRequest(loginSchema, {
      requireTenantContext: true,
      maxErrors: 3
    }),
    authController.login
  );

  // Logout endpoint with authentication check
  router.post('/logout',
    authenticate,
    authController.logout
  );

  // Token refresh endpoint with rate limiting
  router.post('/refresh-token',
    rateLimitMiddleware({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10,
      skipFailedRequests: false
    }),
    authController.refreshToken
  );

  // Forgot password endpoint with rate limiting
  router.post('/forgot-password',
    rateLimitMiddleware({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      skipFailedRequests: false
    }),
    validateRequest(forgotPasswordSchema, {
      requireTenantContext: true,
      maxErrors: 3
    }),
    authController.forgotPassword
  );

  // Reset password endpoint with rate limiting
  router.post('/reset-password',
    rateLimitMiddleware({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      skipFailedRequests: false
    }),
    validateRequest(resetPasswordSchema, {
      requireTenantContext: true,
      maxErrors: 3
    }),
    authController.resetPassword
  );

  // Error handling middleware
  router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.code === 'EBADCSRFTOKEN') {
      res.status(403).json({
        code: 'CSRF_ERROR',
        message: 'Invalid CSRF token'
      });
      return;
    }
    next(err);
  });

  return router;
};

export default initializeAuthRoutes;