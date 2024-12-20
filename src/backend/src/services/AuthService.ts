/**
 * Authentication Service Implementation
 * Version: 1.0.0
 * 
 * Implements secure user authentication, token management, and session handling
 * for the multi-tenant CRM system with comprehensive security monitoring.
 */

import jwt from 'jsonwebtoken'; // ^9.0.0
import { RedisClient } from 'redis'; // ^4.6.7
import { Counter, Gauge, Histogram } from 'prom-client'; // ^14.2.0
import { IUser } from '../../interfaces/IUser';
import { User } from '../db/models/User';
import Logger from '../utils/logger';
import { ErrorCodes } from '../constants/errorCodes';
import { authConfig } from '../config';
import { encrypt, decrypt } from '../utils/encryption';

// Interfaces
interface LoginCredentials {
  email: string;
  password: string;
  tenantId: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: IUser;
}

interface TokenMetadata {
  userId: string;
  tenantId: string;
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Enhanced authentication service with security monitoring and tenant isolation
 */
export class AuthService {
  private redisClient: RedisClient;
  private logger: Logger;
  private readonly failedLoginAttempts: Counter;
  private readonly activeTokens: Gauge;
  private readonly authLatency: Histogram;

  constructor(redisClient: RedisClient, logger: Logger) {
    this.redisClient = redisClient;
    this.logger = logger;

    // Initialize Prometheus metrics
    this.failedLoginAttempts = new Counter({
      name: 'auth_failed_login_attempts_total',
      help: 'Total number of failed login attempts',
      labelNames: ['tenantId']
    });

    this.activeTokens = new Gauge({
      name: 'auth_active_tokens_total',
      help: 'Total number of active tokens',
      labelNames: ['tenantId', 'tokenType']
    });

    this.authLatency = new Histogram({
      name: 'auth_request_duration_seconds',
      help: 'Authentication request duration in seconds',
      labelNames: ['operation', 'tenantId']
    });

    // Set up token cleanup job
    this.setupTokenCleanup();
  }

  /**
   * Authenticates user with security monitoring
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const timer = this.authLatency.startTimer();
    try {
      // Validate tenant context
      if (!credentials.tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Check rate limiting
      const rateLimitKey = `ratelimit:login:${credentials.tenantId}:${credentials.email}`;
      const attempts = await this.redisClient.incr(rateLimitKey);
      if (attempts === 1) {
        await this.redisClient.expire(rateLimitKey, authConfig.security.rateLimitWindow);
      }
      if (attempts > authConfig.security.rateLimitRequests) {
        this.logger.warn('Rate limit exceeded for login', {
          email: credentials.email,
          tenantId: credentials.tenantId
        });
        throw new Error('Too many login attempts');
      }

      // Find user
      const user = await User.findByEmail(credentials.email, credentials.tenantId);
      if (!user) {
        this.failedLoginAttempts.inc({ tenantId: credentials.tenantId });
        throw new Error('Invalid credentials');
      }

      // Validate password
      const isValid = await user.validatePassword(credentials.password);
      if (!isValid) {
        this.failedLoginAttempts.inc({ tenantId: credentials.tenantId });
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const tokenPair = await this.generateTokenPair(user);

      // Update metrics
      this.activeTokens.inc({ tenantId: credentials.tenantId, tokenType: 'access' });
      this.activeTokens.inc({ tenantId: credentials.tenantId, tokenType: 'refresh' });

      // Log successful login
      this.logger.audit('User login successful', {
        userId: user.id,
        tenantId: user.tenantId
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: authConfig.jwt.accessTokenDuration,
        user: user
      };

    } catch (error) {
      this.logger.error('Login failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: credentials.email,
        tenantId: credentials.tenantId
      });
      throw error;
    } finally {
      timer({ operation: 'login', tenantId: credentials.tenantId });
    }
  }

  /**
   * Secure token invalidation with audit logging
   */
  async logout(accessToken: string, refreshToken: string): Promise<void> {
    try {
      const accessPayload = jwt.verify(accessToken, authConfig.jwt.accessTokenSecret) as TokenMetadata;
      
      // Add tokens to blacklist
      const multi = this.redisClient.multi();
      multi.setex(
        `blacklist:access:${accessPayload.tokenId}`,
        authConfig.jwt.accessTokenDuration,
        'true'
      );
      multi.setex(
        `blacklist:refresh:${accessPayload.tokenId}`,
        authConfig.jwt.refreshTokenDuration,
        'true'
      );
      await multi.exec();

      // Update metrics
      this.activeTokens.dec({ tenantId: accessPayload.tenantId, tokenType: 'access' });
      this.activeTokens.dec({ tenantId: accessPayload.tenantId, tokenType: 'refresh' });

      this.logger.audit('User logged out', {
        userId: accessPayload.userId,
        tenantId: accessPayload.tenantId
      });

    } catch (error) {
      this.logger.error('Logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Secure token refresh with rotation
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const timer = this.authLatency.startTimer();
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, authConfig.jwt.refreshTokenSecret) as TokenMetadata;

      // Check blacklist
      const isBlacklisted = await this.redisClient.get(`blacklist:refresh:${payload.tokenId}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Get user
      const user = await User.findById(payload.userId);
      if (!user || user.tenantId !== payload.tenantId) {
        throw new Error('Invalid token');
      }

      // Generate new token pair
      const tokenPair = await this.generateTokenPair(user);

      // Blacklist old refresh token
      await this.redisClient.setex(
        `blacklist:refresh:${payload.tokenId}`,
        authConfig.jwt.refreshTokenDuration,
        'true'
      );

      this.logger.audit('Token refreshed', {
        userId: user.id,
        tenantId: user.tenantId
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: authConfig.jwt.accessTokenDuration,
        user: user
      };

    } catch (error) {
      this.logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      timer({ operation: 'refresh', tenantId: 'system' });
    }
  }

  /**
   * Enhanced token validation with security checks
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const payload = jwt.verify(accessToken, authConfig.jwt.accessTokenSecret) as TokenMetadata;

      // Check blacklist
      const isBlacklisted = await this.redisClient.get(`blacklist:access:${payload.tokenId}`);
      if (isBlacklisted) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Generates secure token pair with metadata
   */
  private async generateTokenPair(user: IUser): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const tokenMetadata: TokenMetadata = {
      userId: user.id,
      tenantId: user.tenantId,
      tokenId: tokenId,
      issuedAt: now,
      expiresAt: now + authConfig.jwt.accessTokenDuration
    };

    const accessToken = jwt.sign(tokenMetadata, authConfig.jwt.accessTokenSecret, {
      expiresIn: authConfig.jwt.accessTokenDuration,
      algorithm: authConfig.jwt.algorithm
    });

    const refreshToken = jwt.sign(tokenMetadata, authConfig.jwt.refreshTokenSecret, {
      expiresIn: authConfig.jwt.refreshTokenDuration,
      algorithm: authConfig.jwt.algorithm
    });

    return { accessToken, refreshToken };
  }

  /**
   * Sets up periodic token cleanup job
   */
  private setupTokenCleanup(): void {
    setInterval(async () => {
      try {
        const pattern = 'blacklist:*';
        const keys = await this.redisClient.keys(pattern);
        
        for (const key of keys) {
          const ttl = await this.redisClient.ttl(key);
          if (ttl <= 0) {
            await this.redisClient.del(key);
          }
        }
      } catch (error) {
        this.logger.error('Token cleanup failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, 3600000); // Run every hour
  }
}