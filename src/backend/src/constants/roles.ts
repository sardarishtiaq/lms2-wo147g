/**
 * @fileoverview Role definitions and permission mappings for the multi-tenant CRM system
 * Implements role-based access control (RBAC) with granular permissions and tenant isolation
 * @version 1.0.0
 */

import { PERMISSIONS, PERMISSION_GROUPS } from './permissions';

/**
 * Enum defining the available roles in the system
 * These roles form the foundation of the RBAC system and are used
 * across the application for access control decisions
 */
export enum ROLES {
  /**
   * System administrator with full access to all functionalities
   * Has complete control over system configuration and user management
   */
  ADMIN = 'admin',

  /**
   * Tenant-level manager with broad access to operational features
   * Can manage leads, quotes, and view user information
   */
  MANAGER = 'manager',

  /**
   * Sales agent with focused access to lead and quote management
   * Limited to their assigned leads and related functionalities
   */
  AGENT = 'agent',

  /**
   * Read-only user with minimal access rights
   * Can view leads, quotes, and basic reports
   */
  VIEWER = 'viewer'
}

/**
 * Maps each role to its corresponding set of permissions
 * Implements the authorization matrix defined in the technical specifications
 * Ensures proper tenant isolation and security boundaries
 */
export const ROLE_PERMISSIONS = {
  /**
   * Administrator permissions
   * Has access to all system functionalities and management capabilities
   */
  [ROLES.ADMIN]: [
    ...PERMISSION_GROUPS.LEAD_MANAGEMENT,
    ...PERMISSION_GROUPS.QUOTE_MANAGEMENT,
    ...PERMISSION_GROUPS.USER_MANAGEMENT,
    ...PERMISSION_GROUPS.SYSTEM_MANAGEMENT,
    ...PERMISSION_GROUPS.TENANT_MANAGEMENT,
    ...PERMISSION_GROUPS.REPORTING
  ],

  /**
   * Manager permissions
   * Has full access to operational features but limited system configuration access
   */
  [ROLES.MANAGER]: [
    ...PERMISSION_GROUPS.LEAD_MANAGEMENT,
    ...PERMISSION_GROUPS.QUOTE_MANAGEMENT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_CREATE
  ],

  /**
   * Agent permissions
   * Has focused access to lead and quote management features
   */
  [ROLES.AGENT]: [
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.QUOTE_VIEW,
    PERMISSIONS.QUOTE_CREATE,
    PERMISSIONS.REPORTS_VIEW
  ],

  /**
   * Viewer permissions
   * Has read-only access to basic system features
   */
  [ROLES.VIEWER]: [
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.QUOTE_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ]
} as const;

/**
 * Type to ensure role permissions only contain valid permissions
 * Provides compile-time type safety for permission assignments
 */
type RolePermissionsType = {
  readonly [K in ROLES]: readonly PERMISSIONS[];
};

/**
 * Validate that ROLE_PERMISSIONS matches the expected type
 * This ensures type safety and prevents invalid permission assignments
 */
export const validateRolePermissions: RolePermissionsType = ROLE_PERMISSIONS;

/**
 * Helper function to check if a role has a specific permission
 * @param role The role to check
 * @param permission The permission to verify
 * @returns boolean indicating if the role has the permission
 */
export const hasPermission = (role: ROLES, permission: PERMISSIONS): boolean => {
  return ROLE_PERMISSIONS[role].includes(permission);
};

/**
 * Helper function to get all permissions for a role
 * @param role The role to get permissions for
 * @returns Array of permissions assigned to the role
 */
export const getRolePermissions = (role: ROLES): readonly PERMISSIONS[] => {
  return ROLE_PERMISSIONS[role];
};