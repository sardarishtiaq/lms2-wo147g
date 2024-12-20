/**
 * @fileoverview User Service implementation for multi-tenant CRM system
 * Implements comprehensive user management with enhanced security features,
 * strict tenant isolation, and detailed activity tracking
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import jwt from 'jsonwebtoken'; // ^9.0.0
import bcrypt from 'bcryptjs'; // ^2.4.3
import speakeasy from 'speakeasy'; // ^2.0.0
import { User } from '../db/models/User';
import { IUser, UserStatus } from '../interfaces/IUser';
import { ROLES } from '../constants/roles';
import { authConfig } from '../config';
import { encrypt, decrypt, hashPassword } from '../utils/encryption';
import logger from '../utils/logger';

/**
 * Interface for authentication result
 */
interface AuthResult {
  user: IUser;
  accessToken: string;
  refreshToken: string;
  mfaRequired?: boolean;
}

/**
 * Interface for MFA setup result
 */
interface MFASetupResult {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Enhanced UserService class implementing comprehensive user management
 * with security features and tenant isolation
 */
@injectable()
export class UserService {
  private readonly tokenExpiry: number;

  constructor(private readonly userModel: typeof User) {
    this.tokenExpiry = authConfig.jwt.accessTokenDuration;
  }

  /**
   * Creates a new user with enhanced security validation
   * @param userData - User data for creation
   * @param password - User password
   * @param tenantId - Tenant identifier
   * @returns Promise<IUser> Created user document
   */
  async createUser(userData: Partial<IUser>, password: string, tenantId: string): Promise<IUser> {
    try {
      logger.debug('Creating new user', { tenantId });

      // Validate password against policy
      if (!this.validatePasswordPolicy(password)) {
        throw new Error('Password does not meet security requirements');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user with tenant isolation
      const user = await this.userModel.create({
        ...userData,
        tenantId,
        passwordHash,
        status: UserStatus.PENDING_ACTIVATION,
        failedLoginAttempts: 0,
        passwordLastChangedAt: new Date(),
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
        }
      });

      logger.audit('User created', {
        userId: user.id,
        tenantId,
        role: user.role
      });

      // Return sanitized user data
      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Error creating user', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Authenticates user with MFA support
   * @param email - User email
   * @param password - User password
   * @param tenantId - Tenant identifier
   * @param mfaToken - Optional MFA token
   * @returns Promise<AuthResult> Authentication result with tokens
   */
  async authenticateUser(
    email: string,
    password: string,
    tenantId: string,
    mfaToken?: string
  ): Promise<AuthResult> {
    try {
      // Find user with tenant isolation
      const user = await this.userModel.findByEmail(email.toLowerCase(), tenantId);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check account status
      if (user.status !== UserStatus.ACTIVE) {
        throw new Error('Account is not active');
      }

      // Validate password
      const isValid = await user.validatePassword(password);
      if (!isValid) {
        throw new Error('Invalid credentials');
      }

      // Check MFA requirement
      if (user.mfaEnabled) {
        if (!mfaToken) {
          return {
            user: this.sanitizeUser(user),
            accessToken: '',
            refreshToken: '',
            mfaRequired: true
          };
        }

        const isMfaValid = await this.validateMfaToken(user, mfaToken);
        if (!isMfaValid) {
          throw new Error('Invalid MFA token');
        }
      }

      // Generate tokens
      const tokens = await this.generateAuthTokens(user);

      // Update last login
      user.lastLoginAt = new Date();
      user.failedLoginAttempts = 0;
      await user.save();

      logger.audit('User authenticated', {
        userId: user.id,
        tenantId,
        mfaUsed: user.mfaEnabled
      });

      return {
        user: this.sanitizeUser(user),
        ...tokens
      };
    } catch (error) {
      logger.error('Authentication failed', {
        email,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Sets up multi-factor authentication for user
   * @param userId - User identifier
   * @param tenantId - Tenant identifier
   * @returns Promise<MFASetupResult> MFA setup details
   */
  async setupMFA(userId: string, tenantId: string): Promise<MFASetupResult> {
    try {
      // Find user with tenant isolation
      const user = await this.userModel.findOne({ _id: userId, tenantId });
      if (!user) {
        throw new Error('User not found');
      }

      // Generate MFA secret
      const secret = speakeasy.generateSecret({
        name: `CRM:${user.email}`
      });

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () =>
        crypto.randomBytes(4).toString('hex')
      );

      // Encrypt and store MFA data
      const encryptedSecret = await encrypt(secret.base32, tenantId);
      const encryptedBackupCodes = await encrypt(JSON.stringify(backupCodes), tenantId);

      user.mfaSecret = encryptedSecret;
      user.mfaBackupCodes = encryptedBackupCodes;
      user.mfaEnabled = true;
      await user.save();

      logger.audit('MFA setup completed', {
        userId,
        tenantId
      });

      return {
        secret: secret.base32,
        qrCode: secret.otpauth_url || '',
        backupCodes
      };
    } catch (error) {
      logger.error('MFA setup failed', {
        userId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validates password against security policy
   * @param password - Password to validate
   * @returns boolean indicating if password meets requirements
   */
  private validatePasswordPolicy(password: string): boolean {
    const { passwordPolicy } = authConfig;
    
    return (
      password.length >= passwordPolicy.minLength &&
      password.length <= passwordPolicy.maxLength &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }

  /**
   * Generates authentication tokens
   * @param user - User document
   * @returns Promise<{accessToken: string, refreshToken: string}>
   */
  private async generateAuthTokens(user: IUser) {
    const payload = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role
    };

    const accessToken = jwt.sign(payload, authConfig.jwt.accessTokenSecret, {
      expiresIn: this.tokenExpiry,
      algorithm: authConfig.jwt.algorithm
    });

    const refreshToken = jwt.sign(payload, authConfig.jwt.refreshTokenSecret, {
      expiresIn: authConfig.jwt.refreshTokenDuration,
      algorithm: authConfig.jwt.algorithm
    });

    return { accessToken, refreshToken };
  }

  /**
   * Validates MFA token
   * @param user - User document
   * @param token - MFA token to validate
   * @returns Promise<boolean> indicating if token is valid
   */
  private async validateMfaToken(user: IUser, token: string): Promise<boolean> {
    const decryptedSecret = await decrypt(user.mfaSecret, user.tenantId);
    
    return speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 1
    });
  }

  /**
   * Sanitizes user document for safe return
   * @param user - User document to sanitize
   * @returns IUser without sensitive data
   */
  private sanitizeUser(user: IUser): IUser {
    const sanitized = user.toObject();
    delete sanitized.passwordHash;
    delete sanitized.mfaSecret;
    delete sanitized.mfaBackupCodes;
    delete sanitized.failedLoginAttempts;
    return sanitized;
  }
}