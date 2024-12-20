/**
 * @fileoverview Permission constants for the multi-tenant CRM system
 * Defines granular access control permissions and permission groups
 * for different system functionalities across tenants
 * @version 1.0.0
 */

/**
 * Enum defining all available permissions in the system
 * Format: resource:action
 * Used for granular access control across the application
 */
export enum PERMISSIONS {
  // Lead Management Permissions
  LEAD_VIEW = 'lead:view',
  LEAD_CREATE = 'lead:create',
  LEAD_UPDATE = 'lead:update',
  LEAD_DELETE = 'lead:delete',
  LEAD_ASSIGN = 'lead:assign',

  // Quote Management Permissions
  QUOTE_VIEW = 'quote:view',
  QUOTE_CREATE = 'quote:create',
  QUOTE_UPDATE = 'quote:update',
  QUOTE_DELETE = 'quote:delete',

  // User Management Permissions
  USER_VIEW = 'user:view',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // System Configuration Permissions
  SYSTEM_CONFIG_VIEW = 'system:config:view',
  SYSTEM_CONFIG_UPDATE = 'system:config:update',

  // Tenant Settings Permissions
  TENANT_SETTINGS_VIEW = 'tenant:settings:view',
  TENANT_SETTINGS_UPDATE = 'tenant:settings:update',

  // Reporting Permissions
  REPORTS_VIEW = 'reports:view',
  REPORTS_CREATE = 'reports:create'
}

/**
 * Groups related permissions for easier role assignment
 * Used to assign multiple related permissions to roles efficiently
 */
export const PERMISSION_GROUPS = {
  // All lead management related permissions
  LEAD_MANAGEMENT: [
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.LEAD_DELETE,
    PERMISSIONS.LEAD_ASSIGN
  ],

  // All quote management related permissions
  QUOTE_MANAGEMENT: [
    PERMISSIONS.QUOTE_VIEW,
    PERMISSIONS.QUOTE_CREATE,
    PERMISSIONS.QUOTE_UPDATE,
    PERMISSIONS.QUOTE_DELETE
  ],

  // All user management related permissions
  USER_MANAGEMENT: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE
  ],

  // All system configuration related permissions
  SYSTEM_MANAGEMENT: [
    PERMISSIONS.SYSTEM_CONFIG_VIEW,
    PERMISSIONS.SYSTEM_CONFIG_UPDATE
  ],

  // All tenant settings related permissions
  TENANT_MANAGEMENT: [
    PERMISSIONS.TENANT_SETTINGS_VIEW,
    PERMISSIONS.TENANT_SETTINGS_UPDATE
  ],

  // All reporting related permissions
  REPORTING: [
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_CREATE
  ]
} as const;

// Type to ensure permission groups only contain valid permissions
type PermissionGroupType = {
  [K in keyof typeof PERMISSION_GROUPS]: readonly PERMISSIONS[];
};

// Validate that PERMISSION_GROUPS matches the expected type
export const validatePermissionGroups: PermissionGroupType = PERMISSION_GROUPS;