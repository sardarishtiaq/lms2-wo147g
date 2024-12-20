/**
 * Authentication Controller Implementation
 * Version: 1.0.0
 * 
 * Handles authentication-related HTTP requests with comprehensive security,
 * multi-tenant support, and audit logging for the CRM system.
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { RateLimiter } from 'rate-limiter-flexible'; // ^2.4.1
import Logger from '../../utils/logger'; // Custom logger
import { AuthService } from '../../services/AuthService';
import { validateLoginRequest, validateRefreshToken } from '../validators/authValidators';
import { ErrorCode, ErrorMessage } from '../../constants/errorCodes';
import { authConfig } from '../../config';

/**
 * Controller handling authentication endpoints with security measures and audit logging
 */
export class AuthController {
  private authService: AuthService;
  private logger: Logger;
  private rateLimiter: RateLimiter;

  constructor(authService: AuthService, logger: Logger, rateLimiter: RateLimiter) {
    this.authService = authService;
    this.logger = logger;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Handles user login with rate limiting and security checks
   */
  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Rate limiting check
      const clientIp = req.ip;
      await this.rateLimiter.consume(clientIp);

      // Validate request data
      await validateLoginRequest({
        email: req.body.email,
        password: req.body.password,
        tenantId: req.body.tenantId
      });

      // Attempt login
      const authResponse = await this.authService.login({
        email: req.body.email,
        password: req.body.password,
        tenantId: req.body.tenantId
      });

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', authResponse.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: authConfig.jwt.refreshTokenDuration * 1000,
        path: '/',
        domain: authConfig.session.domain
      });

      // Set security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });

      // Log successful login
      this.logger.audit('User login successful', {
        userId: authResponse.user.id,
        tenantId: authResponse.user.tenantId,
        source: 'AuthController.login'
      });

      // Return access token and user data
      res.status(200).json({
        accessToken: authResponse.accessToken,
        expiresIn: authConfig.jwt.accessTokenDuration,
        user: {
          id: authResponse.user.id,
          email: authResponse.user.email,
          firstName: authResponse.user.firstName,
          lastName: authResponse.user.lastName,
          role: authResponse.user.role
        }
      });

    } catch (error) {
      // Handle rate limit errors
      if (error.name === 'RateLimitError') {
        this.logger.warn('Rate limit exceeded for login', {
          ip: req.ip,
          source: 'AuthController.login'
        });
        return next({
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: ErrorMessage.RATE_LIMIT_EXCEEDED
        });
      }

      // Log authentication failures
      this.logger.error('Login failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'AuthController.login',
        email: req.body.email,
        tenantId: req.body.tenantId
      });

      next(error);
    }
  };

  /**
   * Handles user logout with token invalidation
   */
  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];
      const refreshToken = req.cookies.refreshToken;

      if (!accessToken || !refreshToken) {
        throw new Error('Missing tokens');
      }

      // Invalidate tokens
      await this.authService.logout(accessToken, refreshToken);

      // Clear auth cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        domain: authConfig.session.domain
      });

      // Log logout
      this.logger.audit('User logged out', {
        source: 'AuthController.logout',
        tokenId: accessToken
      });

      res.status(200).json({ message: 'Logout successful' });

    } catch (error) {
      this.logger.error('Logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'AuthController.logout'
      });
      next(error);
    }
  };

  /**
   * Handles token refresh with security validations
   */
  public refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        throw new Error('Refresh token not found');
      }

      // Validate refresh token format
      await validateRefreshToken(refreshToken);

      // Get new token pair
      const authResponse = await this.authService.refreshToken(refreshToken);

      // Set new refresh token cookie
      res.cookie('refreshToken', authResponse.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: authConfig.jwt.refreshTokenDuration * 1000,
        path: '/',
        domain: authConfig.session.domain
      });

      // Set security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });

      // Log token refresh
      this.logger.audit('Token refreshed', {
        userId: authResponse.user.id,
        tenantId: authResponse.user.tenantId,
        source: 'AuthController.refreshToken'
      });

      // Return new access token
      res.status(200).json({
        accessToken: authResponse.accessToken,
        expiresIn: authConfig.jwt.accessTokenDuration
      });

    } catch (error) {
      this.logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'AuthController.refreshToken'
      });
      next(error);
    }
  };
}