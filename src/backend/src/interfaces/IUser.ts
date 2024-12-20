/**
 * @fileoverview Defines the core user interfaces and types for the multi-tenant CRM system
 * Implements user data structure, preferences, and authentication details with MongoDB integration
 * @version 1.0.0
 */

import { Document } from 'mongoose'; // v7.x
import { ROLES } from '../constants/roles';
import { ITenant } from './ITenant';

/**
 * Enum defining possible user status values
 * Used for user lifecycle and access management
 */
export enum UserStatus {
  /** User account is active and can access the system */
  ACTIVE = 'active',
  
  /** User account is deactivated and cannot access the system */
  INACTIVE = 'inactive',
  
  /** User account is temporarily suspended due to security concerns */
  SUSPENDED = 'suspended',
  
  /** New user account awaiting email verification */
  PENDING_ACTIVATION = 'pending_activation'
}

/**
 * Interface defining user preference settings
 * Controls personalization and display options
 */
export interface IUserPreferences {
  /** UI theme preference (light/dark) */
  theme: 'light' | 'dark';
  
  /** User interface language */
  language: string;
  
  /** Notification preferences configuration */
  notifications: {
    email: boolean;
    inApp: boolean;
    desktop: boolean;
    leadUpdates: boolean;
    quoteUpdates: boolean;
    systemAlerts: boolean;
  };
  
  /** Dashboard layout and widget preferences */
  dashboardLayout: {
    widgets: string[];
    layout: 'grid' | 'list';
    defaultView: 'leads' | 'quotes' | 'reports';
  };
  
  /** User's preferred timezone */
  timezone: string;
  
  /** Preferred date display format */
  dateFormat: string;
}

/**
 * Main user interface extending MongoDB Document
 * Implements comprehensive user management capabilities with tenant isolation
 * @requires PERMISSIONS.USER_VIEW for reading
 * @requires PERMISSIONS.USER_UPDATE for modification
 */
export interface IUser extends Document {
  /** Unique identifier for the user */
  id: string;
  
  /** Reference to the user's tenant */
  tenantId: ITenant['id'];
  
  /** User's email address (unique within tenant) */
  email: string;
  
  /** User's first name */
  firstName: string;
  
  /** User's last name */
  lastName: string;
  
  /** User's assigned role determining permissions */
  role: ROLES;
  
  /** Current status of the user account */
  status: UserStatus;
  
  /** User's personalization preferences */
  preferences: IUserPreferences;
  
  /** Timestamp of last successful login */
  lastLoginAt: Date;
  
  /** Count of consecutive failed login attempts */
  failedLoginAttempts: number;
  
  /** Timestamp of last password change */
  passwordLastChangedAt: Date;
  
  /** Timestamp of user creation */
  createdAt: Date;
  
  /** Timestamp of last user update */
  updatedAt: Date;
  
  /**
   * Virtual property for full name
   * @returns Concatenated first and last name
   */
  fullName?: string;
  
  /**
   * Checks if the user account is locked due to failed attempts
   * @returns boolean indicating if account is locked
   */
  isLocked?: () => boolean;
  
  /**
   * Checks if password change is required based on age
   * @returns boolean indicating if password change is needed
   */
  isPasswordChangeRequired?: () => boolean;
  
  /**
   * Checks if the user has a specific permission
   * @param permission The permission to check
   * @returns boolean indicating if user has permission
   */
  hasPermission?: (permission: string) => boolean;
}

/**
 * Type for creating new users with required fields
 * Omits system-generated fields and MongoDB Document properties
 */
export type CreateUserInput = Omit<
  IUser,
  'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'passwordLastChangedAt' | 'failedLoginAttempts' | keyof Document
>;

/**
 * Type for updating existing users
 * Makes all fields optional except id and tenantId
 */
export type UpdateUserInput = Partial<CreateUserInput> & {
  id: string;
  tenantId: string;
};