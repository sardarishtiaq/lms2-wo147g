/**
 * @fileoverview Permission constants for the multi-tenant CRM system
 * Implements granular role-based access control with TypeScript support.
 * Provides immutable permission definitions and groupings that mirror backend permissions.
 * @version 1.0.0
 */

/**
 * Enum containing all available permissions in the system.
 * Each permission is defined as a colon-separated string constant.
 * Format: resource:action
 */
export const PERMISSIONS = {
  // Lead Management Permissions
  LEAD_VIEW: 'lead:view' as const,
  LEAD_CREATE: 'lead:create' as const,
  LEAD_UPDATE: 'lead:update' as const,
  LEAD_DELETE: 'lead:delete' as const,
  LEAD_ASSIGN: 'lead:assign' as const,

  // Quote Management Permissions
  QUOTE_VIEW: 'quote:view' as const,
  QUOTE_CREATE: 'quote:create' as const,
  QUOTE_UPDATE: 'quote:update' as const,
  QUOTE_DELETE: 'quote:delete' as const,

  // User Management Permissions
  USER_VIEW: 'user:view' as const,
  USER_CREATE: 'user:create' as const,
  USER_UPDATE: 'user:update' as const,
  USER_DELETE: 'user:delete' as const,

  // System Configuration Permissions
  SYSTEM_CONFIG_VIEW: 'system:config:view' as const,
  SYSTEM_CONFIG_UPDATE: 'system:config:update' as const,

  // Tenant Settings Permissions
  TENANT_SETTINGS_VIEW: 'tenant:settings:view' as const,
  TENANT_SETTINGS_UPDATE: 'tenant:settings:update' as const,

  // Reporting Permissions
  REPORTS_VIEW: 'reports:view' as const,
  REPORTS_CREATE: 'reports:create' as const,
} as const;

/**
 * Groups related permissions into logical categories for easier access control management.
 * Each group is frozen to prevent modification at runtime.
 */
export const PERMISSION_GROUPS = {
  LEAD_MANAGEMENT: Object.freeze([
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.LEAD_DELETE,
    PERMISSIONS.LEAD_ASSIGN
  ]),

  QUOTE_MANAGEMENT: Object.freeze([
    PERMISSIONS.QUOTE_VIEW,
    PERMISSIONS.QUOTE_CREATE,
    PERMISSIONS.QUOTE_UPDATE,
    PERMISSIONS.QUOTE_DELETE
  ]),

  USER_MANAGEMENT: Object.freeze([
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE
  ]),

  SYSTEM_MANAGEMENT: Object.freeze([
    PERMISSIONS.SYSTEM_CONFIG_VIEW,
    PERMISSIONS.SYSTEM_CONFIG_UPDATE
  ]),

  TENANT_MANAGEMENT: Object.freeze([
    PERMISSIONS.TENANT_SETTINGS_VIEW,
    PERMISSIONS.TENANT_SETTINGS_UPDATE
  ]),

  REPORTING: Object.freeze([
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_CREATE
  ])
} as const;

/**
 * TypeScript type definition for permission string literals.
 * Ensures type safety when working with individual permissions.
 */
export type PermissionType = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * TypeScript type definition for permission group arrays.
 * Ensures type safety when working with permission groups.
 */
export type PermissionGroupType = typeof PERMISSION_GROUPS[keyof typeof PERMISSION_GROUPS];

/**
 * Type guard to check if a string is a valid permission.
 * @param permission - String to check
 * @returns True if the string is a valid permission
 */
export const isValidPermission = (permission: string): permission is PermissionType => {
  return Object.values(PERMISSIONS).includes(permission as PermissionType);
};

/**
 * Type guard to check if an array is a valid permission group.
 * @param permissions - Array of permissions to check
 * @returns True if the array matches a permission group
 */
export const isValidPermissionGroup = (permissions: readonly string[]): permissions is PermissionGroupType => {
  return Object.values(PERMISSION_GROUPS).some(
    group => group.length === permissions.length && 
    group.every(perm => permissions.includes(perm))
  );
};