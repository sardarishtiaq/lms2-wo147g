/**
 * JWT Utility Module
 * Version: 1.0.0
 * 
 * Provides secure JWT token generation, verification, and management for the multi-tenant CRM system
 * with comprehensive error handling and security features.
 */

import jwt from 'jsonwebtoken'; // ^9.0.0
import { v4 as uuidv4 } from 'uuid'; // For generating unique token IDs
import { authConfig } from '../config/auth.config';
import { logger } from './logger';
import { ErrorCode } from '../constants/errorCodes';

/**
 * Interface defining the structure of JWT token payload
 */
export interface TokenPayload {
  userId: string;
  tenantId: string;
  role: string;
  permissions: string[];
  tokenId: string;
  issuedAt: number;
  deviceId: string;
}

/**
 * Interface defining the structure of token response
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  issuedAt: number;
}

// Set of blacklisted tokens for additional security
const blacklistedTokens = new Set<string>();

/**
 * Validates the token payload for required fields and data types
 * @param payload - Token payload to validate
 * @throws Error if payload is invalid
 */
const validatePayload = (payload: TokenPayload): void => {
  if (!payload.userId || !payload.tenantId || !payload.role) {
    logger.error('Invalid token payload: Missing required fields');
    throw new Error('Invalid token payload');
  }

  if (!Array.isArray(payload.permissions)) {
    logger.error('Invalid token payload: Permissions must be an array');
    throw new Error('Invalid permissions format');
  }
};

/**
 * Generates a new JWT access token with enhanced security features
 * @param payload - Token payload containing user and tenant information
 * @returns Generated JWT access token
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  try {
    validatePayload(payload);

    const tokenPayload = {
      ...payload,
      tokenId: uuidv4(),
      issuedAt: Date.now(),
      type: 'access'
    };

    const token = jwt.sign(tokenPayload, authConfig.jwt.accessTokenSecret, {
      expiresIn: authConfig.jwt.accessTokenDuration,
      algorithm: authConfig.jwt.algorithm,
      issuer: authConfig.jwt.issuer
    });

    logger.info('Access token generated', {
      userId: payload.userId,
      tenantId: payload.tenantId,
      tokenId: tokenPayload.tokenId
    });

    return token;
  } catch (error) {
    logger.error('Error generating access token', { error });
    throw new Error('Failed to generate access token');
  }
};

/**
 * Generates a new JWT refresh token with blacklist support
 * @param payload - Token payload containing user and tenant information
 * @returns Generated JWT refresh token
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  try {
    validatePayload(payload);

    const tokenPayload = {
      ...payload,
      tokenId: uuidv4(),
      issuedAt: Date.now(),
      type: 'refresh'
    };

    const token = jwt.sign(tokenPayload, authConfig.jwt.refreshTokenSecret, {
      expiresIn: authConfig.jwt.refreshTokenDuration,
      algorithm: authConfig.jwt.algorithm,
      issuer: authConfig.jwt.issuer
    });

    logger.info('Refresh token generated', {
      userId: payload.userId,
      tenantId: payload.tenantId,
      tokenId: tokenPayload.tokenId
    });

    return token;
  } catch (error) {
    logger.error('Error generating refresh token', { error });
    throw new Error('Failed to generate refresh token');
  }
};

/**
 * Verifies and decodes a JWT access token
 * @param token - JWT access token to verify
 * @returns Decoded token payload
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, authConfig.jwt.accessTokenSecret, {
      algorithms: [authConfig.jwt.algorithm],
      issuer: authConfig.jwt.issuer
    }) as TokenPayload;

    if (blacklistedTokens.has(decoded.tokenId)) {
      logger.warn('Blacklisted token used', {
        tokenId: decoded.tokenId,
        userId: decoded.userId,
        tenantId: decoded.tenantId
      });
      throw new Error('Token has been revoked');
    }

    logger.info('Access token verified', {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      tokenId: decoded.tokenId
    });

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Access token expired', { error });
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      logger.error('Invalid access token', { error });
      throw new Error('Invalid token');
    }
    logger.error('Error verifying access token', { error });
    throw new Error('Token verification failed');
  }
};

/**
 * Verifies and decodes a JWT refresh token
 * @param token - JWT refresh token to verify
 * @returns Decoded token payload
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, authConfig.jwt.refreshTokenSecret, {
      algorithms: [authConfig.jwt.algorithm],
      issuer: authConfig.jwt.issuer
    }) as TokenPayload;

    if (blacklistedTokens.has(decoded.tokenId)) {
      logger.warn('Blacklisted refresh token used', {
        tokenId: decoded.tokenId,
        userId: decoded.userId,
        tenantId: decoded.tenantId
      });
      throw new Error('Token has been revoked');
    }

    logger.info('Refresh token verified', {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      tokenId: decoded.tokenId
    });

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Refresh token expired', { error });
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      logger.error('Invalid refresh token', { error });
      throw new Error('Invalid token');
    }
    logger.error('Error verifying refresh token', { error });
    throw new Error('Token verification failed');
  }
};

/**
 * Generates both access and refresh tokens
 * @param payload - Token payload containing user and tenant information
 * @returns Object containing both tokens and expiration information
 */
export const generateTokenPair = (payload: TokenPayload): TokenResponse => {
  try {
    validatePayload(payload);

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const issuedAt = Date.now();

    logger.info('Token pair generated', {
      userId: payload.userId,
      tenantId: payload.tenantId
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: authConfig.jwt.accessTokenDuration,
      tokenType: 'Bearer',
      issuedAt
    };
  } catch (error) {
    logger.error('Error generating token pair', { error });
    throw new Error('Failed to generate token pair');
  }
};

/**
 * Blacklists a token to prevent its further use
 * @param tokenId - ID of the token to blacklist
 */
export const blacklistToken = (tokenId: string): void => {
  blacklistedTokens.add(tokenId);
  logger.info('Token blacklisted', { tokenId });
};

/**
 * Checks if a token is blacklisted
 * @param tokenId - ID of the token to check
 * @returns boolean indicating if token is blacklisted
 */
export const isTokenBlacklisted = (tokenId: string): boolean => {
  return blacklistedTokens.has(tokenId);
};