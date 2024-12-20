/**
 * @fileoverview TypeScript type definitions for user-related data structures
 * Implements user management types with role-based access control and multi-tenant isolation
 * @version 1.0.0
 */

import { ROLES } from '../../../backend/src/constants/roles';
import { PERMISSIONS } from '../../../backend/src/constants/permissions';

/**
 * Enum defining possible user account statuses
 * Used for user lifecycle management and access control
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_ACTIVATION = 'pending_activation'
}

/**
 * Interface defining notification preferences structure
 * Controls user notification settings across different channels
 */
interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  desktop: boolean;
  leadUpdates: boolean;
  quoteUpdates: boolean;
  systemAlerts: boolean;
}

/**
 * Interface defining dashboard layout preferences
 * Controls user-specific dashboard customization
 */
interface DashboardLayoutPreferences {
  layout: 'grid' | 'list';
  defaultView: 'leads' | 'quotes' | 'reports';
  widgetPositions: Record<string, { x: number; y: number }>;
  collapsedSections: string[];
}

/**
 * Interface defining lead view preferences
 * Controls how leads are displayed and sorted for the user
 */
interface LeadViewPreferences {
  defaultSort: 'created' | 'updated' | 'priority';
  sortDirection: 'asc' | 'desc';
  columnsOrder: string[];
  hiddenColumns: string[];
  filterPresets: Record<string, unknown>;
}

/**
 * Interface defining comprehensive user preference settings
 * Controls all customizable aspects of the user interface
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: NotificationPreferences;
  dashboardLayout: DashboardLayoutPreferences;
  timezone: string;
  leadViewPreferences: LeadViewPreferences;
}

/**
 * Main user interface for frontend user management
 * Implements complete user profile with tenant isolation support
 */
export interface User {
  /** Unique identifier for the user */
  id: string;

  /** Tenant identifier for multi-tenant isolation */
  tenantId: string;

  /** User's email address used for authentication */
  email: string;

  /** User's first name */
  firstName: string;

  /** User's last name */
  lastName: string;

  /** User's assigned role determining access levels */
  role: ROLES;

  /** Array of specific permissions assigned to the user */
  permissions: PERMISSIONS[];

  /** Current status of the user account */
  status: UserStatus;

  /** User's customized preferences */
  preferences: UserPreferences;

  /** Timestamp of last successful login */
  lastLoginAt: string;

  /** Timestamp of last recorded activity */
  lastActivityAt: string;

  /** Account creation timestamp */
  createdAt: string;

  /** Last account update timestamp */
  updatedAt: string;
}

/**
 * Type guard to check if a value is a valid User
 * @param value - Value to check
 * @returns Boolean indicating if value is a valid User
 */
export function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'tenantId' in value &&
    'email' in value &&
    'role' in value &&
    'permissions' in value &&
    'status' in value
  );
}

/**
 * Type for user creation payload
 * Omits system-generated fields from User interface
 */
export type CreateUserPayload = Omit<
  User,
  'id' | 'lastLoginAt' | 'lastActivityAt' | 'createdAt' | 'updatedAt'
>;

/**
 * Type for user update payload
 * Makes all fields optional except id and tenantId
 */
export type UpdateUserPayload = Partial<Omit<User, 'id' | 'tenantId'>> & {
  id: string;
  tenantId: string;
};