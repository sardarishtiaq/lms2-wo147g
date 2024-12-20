/**
 * @fileoverview User model implementation for multi-tenant CRM system
 * Implements comprehensive user management with enhanced security features,
 * strict tenant isolation, and detailed activity tracking
 * @version 1.0.0
 */

import { model, Document, Model } from 'mongoose'; // v7.x
import { IUser, UserStatus } from '../../interfaces/IUser';
import { userSchema } from '../schemas/userSchema';
import { hashPassword, comparePassword } from '../../utils/encryption';
import logger from '../../utils/logger';
import { authConfig } from '../../config';

/**
 * Interface for enhanced user model with security methods
 */
interface IUserModel extends Model<IUser> {
  findByTenantId(tenantId: string): Promise<IUser[]>;
  findByEmail(email: string, tenantId: string): Promise<IUser | null>;
  findActiveByTenant(tenantId: string, role?: string): Promise<IUser[]>;
}

/**
 * Enhanced User model class with comprehensive security features
 */
class UserModel {
  /**
   * Finds users by tenant ID with strict isolation and security checks
   * @param tenantId - Tenant identifier
   * @returns Promise<IUser[]> Array of tenant-specific users
   */
  static async findByTenantId(tenantId: string): Promise<IUser[]> {
    try {
      logger.debug('Finding users by tenant ID', { tenantId });

      const users = await User.find({
        tenantId,
        status: { $ne: UserStatus.INACTIVE }
      }).select('-passwordHash -failedLoginAttempts');

      logger.audit('Users retrieved by tenant', {
        tenantId,
        count: users.length
      });

      return users;
    } catch (error) {
      logger.error('Error finding users by tenant', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Finds user by email within tenant context with security validation
   * @param email - User email address
   * @param tenantId - Tenant identifier
   * @returns Promise<IUser | null> User document if found
   */
  static async findByEmail(email: string, tenantId: string): Promise<IUser | null> {
    try {
      logger.debug('Finding user by email', { email, tenantId });

      const user = await User.findOne({
        email: email.toLowerCase(),
        tenantId,
        status: { $ne: UserStatus.INACTIVE }
      }).select('-passwordHash');

      if (user) {
        logger.audit('User found by email', {
          userId: user.id,
          tenantId
        });
      }

      return user;
    } catch (error) {
      logger.error('Error finding user by email', {
        email,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validates user password with security checks and attempt tracking
   * @param password - Password to validate
   * @returns Promise<boolean> Validation result
   */
  async validatePassword(this: IUser, password: string): Promise<boolean> {
    try {
      // Check if account is locked
      if (this.isLocked()) {
        logger.warn('Password validation attempted on locked account', {
          userId: this.id,
          tenantId: this.tenantId
        });
        return false;
      }

      // Validate password
      const isValid = await comparePassword(password, this.passwordHash);

      // Update login attempts
      if (!isValid) {
        this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
        await this.save();

        logger.warn('Failed password validation attempt', {
          userId: this.id,
          tenantId: this.tenantId,
          attempts: this.failedLoginAttempts
        });
      } else {
        // Reset failed attempts on successful validation
        if (this.failedLoginAttempts > 0) {
          this.failedLoginAttempts = 0;
          await this.save();
        }

        logger.audit('Successful password validation', {
          userId: this.id,
          tenantId: this.tenantId
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Error validating password', {
        userId: this.id,
        tenantId: this.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Sets new password with security validation and history tracking
   * @param password - New password
   * @returns Promise<void>
   */
  async setPassword(this: IUser, password: string): Promise<void> {
    try {
      // Validate password complexity
      if (password.length < authConfig.passwordPolicy.minLength) {
        throw new Error('Password does not meet minimum length requirement');
      }

      // Generate password hash
      const hash = await hashPassword(password);
      this.passwordHash = hash;
      this.passwordLastChangedAt = new Date();
      this.failedLoginAttempts = 0;

      await this.save();

      logger.audit('Password updated', {
        userId: this.id,
        tenantId: this.tenantId
      });
    } catch (error) {
      logger.error('Error setting password', {
        userId: this.id,
        tenantId: this.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

// Apply methods to schema
userSchema.methods.validatePassword = UserModel.prototype.validatePassword;
userSchema.methods.setPassword = UserModel.prototype.setPassword;

// Apply static methods
userSchema.statics.findByTenantId = UserModel.findByTenantId;
userSchema.statics.findByEmail = UserModel.findByEmail;

// Create and export the User model
const User = model<IUser, IUserModel>('User', userSchema);
export default User;

// Named exports for specific functionality
export {
  User,
  type IUserModel,
  UserModel
};