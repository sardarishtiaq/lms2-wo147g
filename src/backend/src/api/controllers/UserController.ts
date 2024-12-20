/**
 * @fileoverview User Controller implementation for multi-tenant CRM system
 * Handles HTTP requests for user management with enhanced security, tenant isolation,
 * and comprehensive monitoring.
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import helmet from 'helmet';

import { UserService } from '../../services/UserService';
import { validateCreateUser, validateUpdateUser } from '../validators/userValidators';
import { IUser, UserStatus } from '../../interfaces/IUser';
import { ROLES } from '../../constants/roles';
import { ErrorCode, ErrorMessage } from '../../constants/errorCodes';
import logger from '../../utils/logger';

/**
 * Rate limiter configuration for authentication attempts
 */
const authRateLimiter = new RateLimiterMemory({
  points: 5, // 5 attempts
  duration: 300, // per 5 minutes
  blockDuration: 900 // 15 minutes block
});

/**
 * Controller class handling user-related HTTP requests with enhanced security
 * and tenant isolation.
 */
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Creates a new user with tenant isolation and security validation
   * @param req Express request object
   * @param res Express response object
   */
  public createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const userData = req.body;

      // Validate tenant context
      if (!tenantId) {
        res.status(StatusCodes.BAD_REQUEST).json({
          code: ErrorCode.TENANT_CONTEXT_ERROR,
          message: ErrorMessage.TENANT_CONTEXT_ERROR
        });
        return;
      }

      // Validate request data
      await validateCreateUser(userData);

      // Check user creation permissions
      if (!req.user?.hasPermission('user:create')) {
        res.status(StatusCodes.FORBIDDEN).json({
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: ErrorMessage.AUTHORIZATION_ERROR
        });
        return;
      }

      // Create user with tenant isolation
      const user = await this.userService.createUser(
        { ...userData, tenantId },
        userData.password,
        tenantId
      );

      logger.audit('User created', {
        tenantId,
        userId: user.id,
        role: user.role,
        createdBy: req.user?.id
      });

      // Return sanitized user data
      res.status(StatusCodes.CREATED).json(user);
    } catch (error) {
      logger.error('User creation failed', {
        tenantId: req.params.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      const statusCode = error.code ? error.code : StatusCodes.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        code: error.code || ErrorCode.INTERNAL_SERVER_ERROR,
        message: error.message || ErrorMessage.INTERNAL_SERVER_ERROR
      });
    }
  };

  /**
   * Authenticates user with rate limiting and security measures
   * @param req Express request object
   * @param res Express response object
   */
  public authenticateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, tenantId } = req.body;

      // Rate limiting check
      try {
        await authRateLimiter.consume(email);
      } catch (error) {
        res.status(StatusCodes.TOO_MANY_REQUESTS).json({
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: ErrorMessage.RATE_LIMIT_EXCEEDED
        });
        return;
      }

      // Authenticate user
      const authResult = await this.userService.authenticateUser(
        email,
        password,
        tenantId
      );

      logger.audit('User authenticated', {
        tenantId,
        userId: authResult.user.id,
        mfaUsed: authResult.mfaRequired
      });

      // Set secure cookie with refresh token
      res.cookie('refreshToken', authResult.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(StatusCodes.OK).json({
        user: authResult.user,
        accessToken: authResult.accessToken,
        mfaRequired: authResult.mfaRequired
      });
    } catch (error) {
      logger.error('Authentication failed', {
        email: req.body.email,
        tenantId: req.body.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      const statusCode = error.code ? error.code : StatusCodes.UNAUTHORIZED;
      res.status(statusCode).json({
        code: error.code || ErrorCode.AUTHENTICATION_ERROR,
        message: error.message || ErrorMessage.AUTHENTICATION_ERROR
      });
    }
  };

  /**
   * Retrieves users by tenant with proper access control
   * @param req Express request object
   * @param res Express response object
   */
  public getUsersByTenant = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.params;

      // Validate tenant context
      if (!tenantId) {
        res.status(StatusCodes.BAD_REQUEST).json({
          code: ErrorCode.TENANT_CONTEXT_ERROR,
          message: ErrorMessage.TENANT_CONTEXT_ERROR
        });
        return;
      }

      // Check user view permissions
      if (!req.user?.hasPermission('user:view')) {
        res.status(StatusCodes.FORBIDDEN).json({
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: ErrorMessage.AUTHORIZATION_ERROR
        });
        return;
      }

      const users = await this.userService.getUsersByTenant(tenantId);
      res.status(StatusCodes.OK).json(users);
    } catch (error) {
      logger.error('Error retrieving users', {
        tenantId: req.params.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      const statusCode = error.code ? error.code : StatusCodes.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        code: error.code || ErrorCode.INTERNAL_SERVER_ERROR,
        message: error.message || ErrorMessage.INTERNAL_SERVER_ERROR
      });
    }
  };

  /**
   * Updates user information with validation and access control
   * @param req Express request object
   * @param res Express response object
   */
  public updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, userId } = req.params;
      const updateData = req.body;

      // Validate tenant context and update data
      if (!tenantId || !userId) {
        res.status(StatusCodes.BAD_REQUEST).json({
          code: ErrorCode.TENANT_CONTEXT_ERROR,
          message: ErrorMessage.TENANT_CONTEXT_ERROR
        });
        return;
      }

      await validateUpdateUser(updateData);

      // Check update permissions
      if (!req.user?.hasPermission('user:update')) {
        res.status(StatusCodes.FORBIDDEN).json({
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: ErrorMessage.AUTHORIZATION_ERROR
        });
        return;
      }

      const updatedUser = await this.userService.updateUser(
        userId,
        tenantId,
        updateData
      );

      logger.audit('User updated', {
        tenantId,
        userId,
        updatedBy: req.user?.id,
        changes: Object.keys(updateData)
      });

      res.status(StatusCodes.OK).json(updatedUser);
    } catch (error) {
      logger.error('User update failed', {
        tenantId: req.params.tenantId,
        userId: req.params.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      const statusCode = error.code ? error.code : StatusCodes.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        code: error.code || ErrorCode.INTERNAL_SERVER_ERROR,
        message: error.message || ErrorMessage.INTERNAL_SERVER_ERROR
      });
    }
  };

  /**
   * Deactivates a user account with proper authorization
   * @param req Express request object
   * @param res Express response object
   */
  public deactivateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, userId } = req.params;

      // Validate tenant context
      if (!tenantId || !userId) {
        res.status(StatusCodes.BAD_REQUEST).json({
          code: ErrorCode.TENANT_CONTEXT_ERROR,
          message: ErrorMessage.TENANT_CONTEXT_ERROR
        });
        return;
      }

      // Check deactivation permissions
      if (!req.user?.hasPermission('user:update')) {
        res.status(StatusCodes.FORBIDDEN).json({
          code: ErrorCode.AUTHORIZATION_ERROR,
          message: ErrorMessage.AUTHORIZATION_ERROR
        });
        return;
      }

      await this.userService.updateUser(userId, tenantId, {
        status: UserStatus.INACTIVE
      });

      logger.audit('User deactivated', {
        tenantId,
        userId,
        deactivatedBy: req.user?.id
      });

      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      logger.error('User deactivation failed', {
        tenantId: req.params.tenantId,
        userId: req.params.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      const statusCode = error.code ? error.code : StatusCodes.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        code: error.code || ErrorCode.INTERNAL_SERVER_ERROR,
        message: error.message || ErrorMessage.INTERNAL_SERVER_ERROR
      });
    }
  };
}