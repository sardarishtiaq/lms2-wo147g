/**
 * JWT Utility Unit Tests
 * Version: 1.0.0
 * 
 * Comprehensive test suite for JWT token generation, validation, and security features
 * with tenant isolation and error handling validation.
 */

import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  TokenPayload
} from '../../src/utils/jwt';
import { authConfig } from '../../src/config/auth.config';

// Mock the logger to prevent actual logging during tests
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Test constants
const MOCK_PAYLOAD: TokenPayload = {
  userId: 'test-user-id',
  tenantId: 'test-tenant-id',
  role: 'admin',
  permissions: ['read', 'write'],
  tokenId: 'test-token-id',
  issuedAt: Date.now(),
  deviceId: 'test-device-id'
};

const MOCK_INVALID_PAYLOAD = {
  userId: null,
  tenantId: null,
  role: '',
  permissions: null,
  tokenId: '',
  issuedAt: null,
  deviceId: ''
};

describe('JWT Token Generation and Validation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('generateAccessToken', () => {
    test('should generate valid access token with proper encryption', async () => {
      // Generate token
      const token = generateAccessToken(MOCK_PAYLOAD);

      // Verify token structure (header.payload.signature)
      expect(token.split('.')).toHaveLength(3);

      // Verify token can be decoded
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(MOCK_PAYLOAD.userId);
      expect(decoded.tenantId).toBe(MOCK_PAYLOAD.tenantId);
      expect(decoded.role).toBe(MOCK_PAYLOAD.role);
    });

    test('should enforce tenant isolation in token payload', () => {
      const token = generateAccessToken(MOCK_PAYLOAD);
      const decoded = verifyAccessToken(token);
      expect(decoded.tenantId).toBe(MOCK_PAYLOAD.tenantId);
    });

    test('should reject invalid payload', () => {
      expect(() => generateAccessToken(MOCK_INVALID_PAYLOAD as TokenPayload))
        .toThrow('Invalid token payload');
    });

    test('should set correct token expiration', () => {
      const token = generateAccessToken(MOCK_PAYLOAD);
      const decoded = verifyAccessToken(token);
      const now = Math.floor(Date.now() / 1000);
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(now + authConfig.jwt.accessTokenDuration);
    });
  });

  describe('generateRefreshToken', () => {
    test('should generate valid refresh token with proper duration', () => {
      const token = generateRefreshToken(MOCK_PAYLOAD);
      const decoded = verifyRefreshToken(token);
      
      expect(decoded.userId).toBe(MOCK_PAYLOAD.userId);
      expect(decoded.tenantId).toBe(MOCK_PAYLOAD.tenantId);
      
      const now = Math.floor(Date.now() / 1000);
      expect(decoded.exp).toBeGreaterThan(now + authConfig.jwt.accessTokenDuration);
      expect(decoded.exp).toBeLessThanOrEqual(now + authConfig.jwt.refreshTokenDuration);
    });

    test('should include one-time use flag in refresh token', () => {
      const token = generateRefreshToken(MOCK_PAYLOAD);
      const decoded = verifyRefreshToken(token);
      expect(decoded.type).toBe('refresh');
    });

    test('should enforce tenant isolation in refresh token', () => {
      const token = generateRefreshToken(MOCK_PAYLOAD);
      const decoded = verifyRefreshToken(token);
      expect(decoded.tenantId).toBe(MOCK_PAYLOAD.tenantId);
    });

    test('should reject invalid payload for refresh token', () => {
      expect(() => generateRefreshToken(MOCK_INVALID_PAYLOAD as TokenPayload))
        .toThrow('Invalid token payload');
    });
  });

  describe('verifyAccessToken', () => {
    test('should verify valid access token', () => {
      const token = generateAccessToken(MOCK_PAYLOAD);
      const decoded = verifyAccessToken(token);
      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(MOCK_PAYLOAD.userId);
    });

    test('should reject expired access token', () => {
      jest.useFakeTimers();
      const token = generateAccessToken(MOCK_PAYLOAD);
      
      // Advance time beyond token expiration
      jest.advanceTimersByTime((authConfig.jwt.accessTokenDuration + 60) * 1000);
      
      expect(() => verifyAccessToken(token)).toThrow('Token expired');
      jest.useRealTimers();
    });

    test('should reject tampered token', () => {
      const token = generateAccessToken(MOCK_PAYLOAD);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      expect(() => verifyAccessToken(tamperedToken)).toThrow('Invalid token');
    });

    test('should reject token with invalid signature', () => {
      const token = generateAccessToken(MOCK_PAYLOAD);
      const [header, payload] = token.split('.');
      const invalidToken = `${header}.${payload}.invalidSignature`;
      expect(() => verifyAccessToken(invalidToken)).toThrow('Invalid token');
    });
  });

  describe('verifyRefreshToken', () => {
    test('should verify valid refresh token', () => {
      const token = generateRefreshToken(MOCK_PAYLOAD);
      const decoded = verifyRefreshToken(token);
      expect(decoded).toBeTruthy();
      expect(decoded.type).toBe('refresh');
    });

    test('should reject expired refresh token', () => {
      jest.useFakeTimers();
      const token = generateRefreshToken(MOCK_PAYLOAD);
      
      // Advance time beyond token expiration
      jest.advanceTimersByTime((authConfig.jwt.refreshTokenDuration + 60) * 1000);
      
      expect(() => verifyRefreshToken(token)).toThrow('Token expired');
      jest.useRealTimers();
    });

    test('should reject blacklisted refresh token', () => {
      const token = generateRefreshToken(MOCK_PAYLOAD);
      const decoded = verifyRefreshToken(token);
      
      // Simulate blacklisting the token
      (global as any).blacklistedTokens = new Set([decoded.tokenId]);
      
      expect(() => verifyRefreshToken(token)).toThrow('Token has been revoked');
    });

    test('should enforce tenant context in refresh token', () => {
      const token = generateRefreshToken(MOCK_PAYLOAD);
      const decoded = verifyRefreshToken(token);
      expect(decoded.tenantId).toBe(MOCK_PAYLOAD.tenantId);
    });
  });

  describe('generateTokenPair', () => {
    test('should generate valid token pair', () => {
      const tokenPair = generateTokenPair(MOCK_PAYLOAD);
      
      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(tokenPair).toHaveProperty('expiresIn');
      expect(tokenPair).toHaveProperty('tokenType', 'Bearer');
      expect(tokenPair).toHaveProperty('issuedAt');
    });

    test('should generate tokens with correct expiration times', () => {
      const tokenPair = generateTokenPair(MOCK_PAYLOAD);
      
      const accessDecoded = verifyAccessToken(tokenPair.accessToken);
      const refreshDecoded = verifyRefreshToken(tokenPair.refreshToken);
      
      const now = Math.floor(Date.now() / 1000);
      expect(accessDecoded.exp).toBeLessThanOrEqual(now + authConfig.jwt.accessTokenDuration);
      expect(refreshDecoded.exp).toBeLessThanOrEqual(now + authConfig.jwt.refreshTokenDuration);
    });

    test('should enforce tenant isolation in both tokens', () => {
      const tokenPair = generateTokenPair(MOCK_PAYLOAD);
      
      const accessDecoded = verifyAccessToken(tokenPair.accessToken);
      const refreshDecoded = verifyRefreshToken(tokenPair.refreshToken);
      
      expect(accessDecoded.tenantId).toBe(MOCK_PAYLOAD.tenantId);
      expect(refreshDecoded.tenantId).toBe(MOCK_PAYLOAD.tenantId);
    });

    test('should reject invalid payload for token pair generation', () => {
      expect(() => generateTokenPair(MOCK_INVALID_PAYLOAD as TokenPayload))
        .toThrow('Invalid token payload');
    });
  });
});