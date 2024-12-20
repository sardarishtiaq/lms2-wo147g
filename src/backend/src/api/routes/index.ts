/**
 * @fileoverview Main router configuration for the multi-tenant CRM system.
 * Implements centralized routing with comprehensive security, monitoring,
 * and tenant isolation.
 * @version 1.0.0
 */

import express, { Router } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import cors from 'cors'; // ^2.8.5
import { authRouter } from './authRoutes';
import { leadRouter } from './leadRoutes';
import { quoteRouter } from './quoteRoutes';
import { activityRouter } from './activityRoutes';
import { errorMiddleware } from '../middlewares/errorMiddleware';
import { rateLimitMiddleware } from '../middlewares/rateLimitMiddleware';
import logger from '../../utils/logger';

/**
 * Configures and combines all API routes with enhanced security measures
 * and tenant isolation.
 */
export const configureRoutes = (): Router => {
  const router = express.Router();

  // Initialize logging for router operations
  logger.info('Initializing API routes');

  // Apply security middleware with strict CSP
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
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

  // Configure CORS with whitelist
  const whitelist = process.env.CORS_WHITELIST?.split(',') || [];
  router.use(cors({
    origin: (origin, callback) => {
      if (!origin || whitelist.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining']
  }));

  // Apply tenant-aware rate limiting
  router.use(rateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipFailedRequests: false
  }));

  // Mount API routes with version prefix
  router.use('/api/v1/auth', authRouter);
  router.use('/api/v1/leads', leadRouter);
  router.use('/api/v1/quotes', quoteRouter);
  router.use('/api/v1/activities', activityRouter);

  // Apply error handling middleware
  router.use(errorMiddleware);

  // Log successful route configuration
  logger.info('API routes configured successfully');

  return router;
};

// Create and export the configured router
const router = configureRoutes();
export default router;

// Export individual routers for testing and direct access
export {
  authRouter,
  leadRouter,
  quoteRouter,
  activityRouter
};