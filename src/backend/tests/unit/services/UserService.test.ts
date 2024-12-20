/**
 * @fileoverview Comprehensive unit test suite for UserService class
 * Tests user management operations with multi-tenant isolation, authentication flows,
 * and security features for the multi-tenant CRM system
 * @version 1.0.0
 */

import { UserService } from '../../../src/services/UserService';
import { User } from '../../../src/db/models/User';
import { UserStatus, IUser, IUserPreferences } from '../../../src/interfaces/IUser';
import { ROLES } from '../../../src/constants/roles';
import { encrypt, decrypt, hashPassword } from '../../../src/utils/encryption';
import speakeasy from 'speakeasy'; // ^2.0.0
import { authConfig } from '../../../src/config/auth.config';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/db/models/User');
jest.mock('../../../src/utils/encryption');
jest.mock('../../../src/utils/logger');
jest.mock('speakeasy');

describe('UserService', () => {
  let userService: UserService;
  const mockUser = User as jest.Mocked<typeof User>;

  // Test data
  const tenantId = 'tenant-123';
  const userId = 'user-123';
  const validPassword = 'Test@123456';
  const mockUserData = {
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: ROLES.AGENT,
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: {
        email: true,
        inApp: true,
        desktop: false,
        leadUpdates: true,
        quoteUpdates: true,
        systemAlerts: true
      }
    } as IUserPreferences
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService(mockUser);
  });

  describe('User Creation', () => {
    it('should create a user with proper tenant isolation', async () => {
      // Mock password hashing
      (hashPassword as jest.Mock).mockResolvedValue('hashed_password');

      // Mock user creation
      mockUser.create.mockResolvedValue({
        id: userId,
        ...mockUserData,
        tenantId,
        status: UserStatus.PENDING_ACTIVATION,
        toObject: () => ({ id: userId, ...mockUserData, tenantId })
      } as any);

      const result = await userService.createUser(mockUserData, validPassword, tenantId);

      expect(result).toBeDefined();
      expect(result.tenantId).toBe(tenantId);
      expect(result.status).toBe(UserStatus.PENDING_ACTIVATION);
      expect(mockUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUserData,
          tenantId,
          status: UserStatus.PENDING_ACTIVATION
        })
      );
      expect(logger.audit).toHaveBeenCalledWith('User created', expect.any(Object));
    });

    it('should enforce password policy during user creation', async () => {
      const weakPassword = '123';
      await expect(
        userService.createUser(mockUserData, weakPassword, tenantId)
      ).rejects.toThrow('Password does not meet security requirements');
    });

    it('should prevent duplicate email within same tenant', async () => {
      mockUser.create.mockRejectedValue(new Error('Duplicate email'));
      await expect(
        userService.createUser(mockUserData, validPassword, tenantId)
      ).rejects.toThrow('Duplicate email');
    });
  });

  describe('User Authentication', () => {
    const mockAuthUser = {
      id: userId,
      ...mockUserData,
      tenantId,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
      validatePassword: jest.fn(),
      save: jest.fn(),
      toObject: () => ({ id: userId, ...mockUserData, tenantId })
    } as any;

    beforeEach(() => {
      mockUser.findByEmail.mockResolvedValue(mockAuthUser);
      mockAuthUser.validatePassword.mockResolvedValue(true);
    });

    it('should authenticate user with valid credentials', async () => {
      const result = await userService.authenticateUser(
        mockUserData.email,
        validPassword,
        tenantId
      );

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockAuthUser.save).toHaveBeenCalled();
      expect(logger.audit).toHaveBeenCalledWith('User authenticated', expect.any(Object));
    });

    it('should enforce tenant isolation during authentication', async () => {
      const wrongTenantId = 'wrong-tenant';
      mockUser.findByEmail.mockResolvedValue(null);

      await expect(
        userService.authenticateUser(mockUserData.email, validPassword, wrongTenantId)
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle MFA validation when enabled', async () => {
      const mfaUser = {
        ...mockAuthUser,
        mfaEnabled: true,
        mfaSecret: 'encrypted_secret'
      };
      mockUser.findByEmail.mockResolvedValue(mfaUser);
      (decrypt as jest.Mock).mockResolvedValue('decrypted_secret');
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = await userService.authenticateUser(
        mockUserData.email,
        validPassword,
        tenantId,
        '123456'
      );

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(speakeasy.totp.verify).toHaveBeenCalled();
    });

    it('should block authentication after max failed attempts', async () => {
      mockAuthUser.failedLoginAttempts = authConfig.security.maxLoginAttempts;
      mockAuthUser.validatePassword.mockResolvedValue(false);

      await expect(
        userService.authenticateUser(mockUserData.email, 'wrong_password', tenantId)
      ).rejects.toThrow('Account is locked');
    });
  });

  describe('MFA Management', () => {
    it('should setup MFA for user', async () => {
      const mockMfaUser = {
        id: userId,
        email: mockUserData.email,
        tenantId,
        save: jest.fn()
      };
      mockUser.findOne.mockResolvedValue(mockMfaUser);
      (speakeasy.generateSecret as jest.Mock).mockReturnValue({
        base32: 'secret',
        otpauth_url: 'otpauth://url'
      });
      (encrypt as jest.Mock).mockResolvedValue('encrypted_secret');

      const result = await userService.setupMFA(userId, tenantId);

      expect(result.secret).toBeDefined();
      expect(result.qrCode).toBeDefined();
      expect(result.backupCodes).toHaveLength(10);
      expect(mockMfaUser.save).toHaveBeenCalled();
      expect(logger.audit).toHaveBeenCalledWith('MFA setup completed', expect.any(Object));
    });

    it('should enforce tenant isolation during MFA setup', async () => {
      mockUser.findOne.mockResolvedValue(null);

      await expect(
        userService.setupMFA(userId, 'wrong-tenant')
      ).rejects.toThrow('User not found');
    });
  });

  describe('User Management', () => {
    const mockExistingUser = {
      id: userId,
      ...mockUserData,
      tenantId,
      status: UserStatus.ACTIVE,
      save: jest.fn(),
      toObject: () => ({ id: userId, ...mockUserData, tenantId })
    } as any;

    beforeEach(() => {
      mockUser.findOne.mockResolvedValue(mockExistingUser);
    });

    it('should update user preferences', async () => {
      const newPreferences = {
        theme: 'dark',
        language: 'es'
      };

      await userService.updateUserPreferences(userId, tenantId, newPreferences);

      expect(mockExistingUser.save).toHaveBeenCalled();
      expect(mockExistingUser.preferences).toMatchObject(newPreferences);
      expect(logger.audit).toHaveBeenCalledWith('User preferences updated', expect.any(Object));
    });

    it('should deactivate user with proper cleanup', async () => {
      await userService.deactivateUser(userId, tenantId);

      expect(mockExistingUser.status).toBe(UserStatus.INACTIVE);
      expect(mockExistingUser.save).toHaveBeenCalled();
      expect(logger.audit).toHaveBeenCalledWith('User deactivated', expect.any(Object));
    });

    it('should prevent cross-tenant user management', async () => {
      mockUser.findOne.mockResolvedValue(null);

      await expect(
        userService.updateUserPreferences(userId, 'wrong-tenant', {})
      ).rejects.toThrow('User not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockUser.create.mockRejectedValue(new Error('Database error'));

      await expect(
        userService.createUser(mockUserData, validPassword, tenantId)
      ).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle encryption errors during MFA setup', async () => {
      mockUser.findOne.mockResolvedValue({ id: userId, tenantId });
      (encrypt as jest.Mock).mockRejectedValue(new Error('Encryption failed'));

      await expect(
        userService.setupMFA(userId, tenantId)
      ).rejects.toThrow('Encryption failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});