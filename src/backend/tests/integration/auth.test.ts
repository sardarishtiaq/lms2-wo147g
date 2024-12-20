/**
 * Integration Tests for Authentication System
 * Version: 1.0.0
 * 
 * Tests authentication flows, token management, and security features
 * for the multi-tenant CRM system with comprehensive coverage of
 * security scenarios and tenant isolation.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'; // ^29.5.0
import request from 'supertest'; // ^6.3.3
import Redis from 'redis-mock'; // ^0.56.3
import { AuthService } from '../../src/services/AuthService';
import { User } from '../../src/db/models/User';
import logger from '../../src/utils/logger';
import { authConfig } from '../../config/auth.config';
import { ErrorCode, HttpStatusCode } from '../../src/constants/errorCodes';
import { hashPassword } from '../../src/utils/encryption';
import { ROLES } from '../../src/constants/roles';
import { UserStatus } from '../../src/interfaces/IUser';

// Mock Redis client
const redisClient = new Redis.createClient();

// Test data constants
const TEST_TENANT_ID = 'test-tenant-123';
const TEST_USER = {
  email: 'test@example.com',
  password: 'SecurePass123!',
  firstName: 'Test',
  lastName: 'User',
  role: ROLES.AGENT,
  tenantId: TEST_TENANT_ID,
  status: UserStatus.ACTIVE
};

const TEST_ADMIN = {
  email: 'admin@example.com',
  password: 'AdminPass456!',
  firstName: 'Admin',
  lastName: 'User',
  role: ROLES.ADMIN,
  tenantId: TEST_TENANT_ID,
  status: UserStatus.ACTIVE
};

describe('Authentication Integration Tests', () => {
  let app: any;
  let authService: AuthService;
  let testUserDoc: any;
  let testAdminDoc: any;

  beforeAll(async () => {
    // Initialize auth service with mocked Redis
    authService = new AuthService(redisClient, logger);

    // Create test users
    const hashedPassword = await hashPassword(TEST_USER.password);
    testUserDoc = await User.create({
      ...TEST_USER,
      passwordHash: hashedPassword
    });

    const hashedAdminPassword = await hashPassword(TEST_ADMIN.password);
    testAdminDoc = await User.create({
      ...TEST_ADMIN,
      passwordHash: hashedAdminPassword
    });

    // Mock logger to track audit logs
    jest.spyOn(logger, 'audit');
    jest.spyOn(logger, 'error');
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ tenantId: TEST_TENANT_ID });
    await redisClient.flushall();
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    // Clear Redis cache and rate limit data
    await redisClient.flushall();
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    test('should successfully authenticate user with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password,
          tenantId: TEST_TENANT_ID
        });

      expect(response.status).toBe(HttpStatusCode.OK);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(TEST_USER.email);
      expect(response.body.user.tenantId).toBe(TEST_TENANT_ID);

      // Verify audit log
      expect(logger.audit).toHaveBeenCalledWith(
        'User login successful',
        expect.objectContaining({
          userId: testUserDoc.id,
          tenantId: TEST_TENANT_ID
        })
      );
    });

    test('should return 401 for invalid password with audit log', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_USER.email,
          password: 'wrongpassword',
          tenantId: TEST_TENANT_ID
        });

      expect(response.status).toBe(HttpStatusCode.UNAUTHORIZED);
      expect(response.body.code).toBe(ErrorCode.AUTHENTICATION_ERROR);

      // Verify failed login attempt tracking
      const user = await User.findById(testUserDoc.id);
      expect(user?.failedLoginAttempts).toBe(1);

      // Verify audit log
      expect(logger.error).toHaveBeenCalledWith(
        'Login failed',
        expect.objectContaining({
          email: TEST_USER.email,
          tenantId: TEST_TENANT_ID
        })
      );
    });

    test('should enforce rate limiting after max attempts', async () => {
      const attempts = Array(authConfig.security.maxLoginAttempts + 1).fill(null);
      
      for (const _ of attempts) {
        await request(app)
          .post('/auth/login')
          .send({
            email: TEST_USER.email,
            password: 'wrongpassword',
            tenantId: TEST_TENANT_ID
          });
      }

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password,
          tenantId: TEST_TENANT_ID
        });

      expect(response.status).toBe(HttpStatusCode.TOO_MANY_REQUESTS);
      expect(response.body.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    });

    test('should validate tenant context in token payload', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password,
          tenantId: 'wrong-tenant-id'
        });

      expect(response.status).toBe(HttpStatusCode.UNAUTHORIZED);
      expect(response.body.code).toBe(ErrorCode.TENANT_CONTEXT_ERROR);
    });
  });

  describe('POST /auth/logout', () => {
    let validAccessToken: string;
    let validRefreshToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password,
          tenantId: TEST_TENANT_ID
        });

      validAccessToken = loginResponse.body.accessToken;
      validRefreshToken = loginResponse.body.refreshToken;
    });

    test('should successfully logout and blacklist tokens', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ refreshToken: validRefreshToken });

      expect(response.status).toBe(HttpStatusCode.OK);

      // Verify tokens are blacklisted
      const isAccessTokenValid = await authService.validateToken(validAccessToken);
      expect(isAccessTokenValid).toBe(false);

      // Verify audit log
      expect(logger.audit).toHaveBeenCalledWith(
        'User logged out',
        expect.objectContaining({
          userId: testUserDoc.id,
          tenantId: TEST_TENANT_ID
        })
      );
    });

    test('should handle missing token gracefully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .send({ refreshToken: validRefreshToken });

      expect(response.status).toBe(HttpStatusCode.UNAUTHORIZED);
      expect(response.body.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
    });
  });

  describe('POST /auth/refresh', () => {
    let validRefreshToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password,
          tenantId: TEST_TENANT_ID
        });

      validRefreshToken = loginResponse.body.refreshToken;
    });

    test('should return new token pair for valid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(response.status).toBe(HttpStatusCode.OK);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.refreshToken).not.toBe(validRefreshToken);

      // Verify audit log
      expect(logger.audit).toHaveBeenCalledWith(
        'Token refreshed',
        expect.objectContaining({
          userId: testUserDoc.id,
          tenantId: TEST_TENANT_ID
        })
      );
    });

    test('should return 401 for blacklisted refresh token', async () => {
      // Logout to blacklist the refresh token
      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${validRefreshToken}`)
        .send({ refreshToken: validRefreshToken });

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(response.status).toBe(HttpStatusCode.UNAUTHORIZED);
      expect(response.body.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
    });

    test('should maintain tenant context in new tokens', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(response.status).toBe(HttpStatusCode.OK);

      // Verify tenant context in new token
      const newAccessToken = response.body.accessToken;
      const tokenValidation = await authService.validateToken(newAccessToken);
      expect(tokenValidation).toBe(true);

      // Use new token to access tenant-specific endpoint
      const protectedResponse = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(protectedResponse.status).toBe(HttpStatusCode.OK);
    });
  });
});