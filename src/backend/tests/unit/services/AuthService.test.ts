/**
 * Unit Tests for AuthService
 * Version: 1.0.0
 * 
 * Comprehensive test suite for authentication, token management,
 * and security monitoring in the multi-tenant CRM system.
 */

import { jest } from '@jest/globals';
import redisMock from 'redis-mock';
import { AuthService } from '../../../src/services/AuthService';
import { User } from '../../../src/db/models/User';
import { UserStatus } from '../../../src/interfaces/IUser';
import { ErrorCode } from '../../../src/constants/errorCodes';
import { authConfig } from '../../../src/config/auth.config';
import Logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/db/models/User');
jest.mock('../../../src/utils/logger');
jest.mock('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
    dec: jest.fn()
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    startTimer: jest.fn().mockReturnValue(jest.fn())
  }))
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockRedisClient: any;
  let mockLogger: any;

  const testTenantId = 'test-tenant-123';
  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
    tenantId: testTenantId,
    status: UserStatus.ACTIVE,
    validatePassword: jest.fn(),
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    // Setup Redis mock
    mockRedisClient = redisMock.createClient();
    mockLogger = new Logger();
    authService = new AuthService(mockRedisClient, mockLogger);

    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup User model mock
    (User.findByEmail as jest.Mock).mockReset();
    (User.findById as jest.Mock).mockReset();
  });

  describe('login', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'validPassword123',
        tenantId: testTenantId
      };

      (User.findByEmail as jest.Mock).mockResolvedValue(testUser);
      testUser.validatePassword.mockResolvedValue(true);

      // Act
      const result = await authService.login(credentials);

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe(testUser.id);
      expect(User.findByEmail).toHaveBeenCalledWith(credentials.email, testTenantId);
    });

    it('should enforce rate limiting per tenant', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'password123',
        tenantId: testTenantId
      };

      // Simulate rate limit exceeded
      mockRedisClient.incr = jest.fn().mockResolvedValue(authConfig.security.rateLimitRequests + 1);

      // Act & Assert
      await expect(authService.login(credentials))
        .rejects
        .toThrow('Too many login attempts');
    });

    it('should handle invalid credentials correctly', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'wrongPassword',
        tenantId: testTenantId
      };

      (User.findByEmail as jest.Mock).mockResolvedValue(testUser);
      testUser.validatePassword.mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(credentials))
        .rejects
        .toThrow('Invalid credentials');
    });

    it('should prevent cross-tenant access attempts', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'password123',
        tenantId: 'different-tenant'
      };

      (User.findByEmail as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(credentials))
        .rejects
        .toThrow('Invalid credentials');
    });
  });

  describe('token management', () => {
    it('should validate and refresh tokens correctly', async () => {
      // Arrange
      const mockTokens = await authService.login({
        email: testUser.email,
        password: 'validPassword123',
        tenantId: testTenantId
      });

      // Act
      const refreshResult = await authService.refreshToken(mockTokens.refreshToken);

      // Assert
      expect(refreshResult).toHaveProperty('accessToken');
      expect(refreshResult).toHaveProperty('refreshToken');
      expect(refreshResult.accessToken).not.toBe(mockTokens.accessToken);
    });

    it('should properly blacklist tokens on logout', async () => {
      // Arrange
      const mockTokens = await authService.login({
        email: testUser.email,
        password: 'validPassword123',
        tenantId: testTenantId
      });

      // Act
      await authService.logout(mockTokens.accessToken, mockTokens.refreshToken);
      const isValid = await authService.validateToken(mockTokens.accessToken);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should handle expired tokens appropriately', async () => {
      // Arrange
      const expiredToken = 'expired.token.signature';

      // Act & Assert
      await expect(authService.validateToken(expiredToken))
        .resolves
        .toBe(false);
    });
  });

  describe('security monitoring', () => {
    it('should track failed login attempts', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'wrongPassword',
        tenantId: testTenantId
      };

      (User.findByEmail as jest.Mock).mockResolvedValue(testUser);
      testUser.validatePassword.mockResolvedValue(false);

      // Act
      try {
        await authService.login(credentials);
      } catch (error) {
        // Expected error
      }

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed password validation attempt'),
        expect.any(Object)
      );
    });

    it('should enforce tenant-specific rate limits', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'password123',
        tenantId: testTenantId
      };

      // Simulate multiple requests
      for (let i = 0; i < authConfig.security.rateLimitRequests; i++) {
        mockRedisClient.incr = jest.fn().mockResolvedValue(i + 1);
        try {
          await authService.login(credentials);
        } catch (error) {
          // Expected for last iteration
        }
      }

      // Act & Assert
      await expect(authService.login(credentials))
        .rejects
        .toThrow('Too many login attempts');
    });

    it('should log security events with proper context', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'validPassword123',
        tenantId: testTenantId
      };

      (User.findByEmail as jest.Mock).mockResolvedValue(testUser);
      testUser.validatePassword.mockResolvedValue(true);

      // Act
      await authService.login(credentials);

      // Assert
      expect(mockLogger.audit).toHaveBeenCalledWith(
        'User login successful',
        expect.objectContaining({
          userId: testUser.id,
          tenantId: testTenantId
        })
      );
    });
  });
});