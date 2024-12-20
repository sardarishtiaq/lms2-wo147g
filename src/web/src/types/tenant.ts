/**
 * @fileoverview Defines comprehensive TypeScript types and interfaces for tenant-related data structures
 * Implements type safety and proper constraints for multi-tenant architecture features
 * @version 1.0.0
 */

import { PERMISSIONS } from '../constants/permissions';

/**
 * Enum defining all possible tenant lifecycle status values
 */
export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_ACTIVATION = 'PENDING_ACTIVATION'
}

/**
 * Interface defining password policy configuration for tenant security
 */
interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expirationDays: number;
  preventReuse: number;
}

/**
 * Interface defining tenant-specific branding and customization options
 */
export interface TenantBranding {
  logo: string;
  primaryColor: string;
  secondaryColor: string;
}

/**
 * Interface defining tenant-specific security configuration
 */
export interface TenantSecuritySettings {
  mfaRequired: boolean;
  passwordPolicy: PasswordPolicy;
  sessionTimeout: number;
}

/**
 * Interface defining feature flags and capabilities available to a tenant
 */
export interface TenantFeatures {
  quoteManagement: boolean;
  advancedReporting: boolean;
  apiAccess: boolean;
  customFields: boolean;
  multipleWorkflows: boolean;
  automatedAssignment: boolean;
}

/**
 * Interface defining comprehensive tenant configuration settings
 */
export interface TenantSettings {
  leadCategories: string[];
  maxUsers: number;
  maxLeads: number;
  allowedDomains: string[];
  features: TenantFeatures;
  branding: TenantBranding;
  securitySettings: TenantSecuritySettings;
}

/**
 * Main tenant interface with comprehensive management capabilities
 * Implements complete tenant isolation and configuration requirements
 */
export interface Tenant {
  /** Unique identifier for the tenant */
  id: string;
  
  /** Display name of the tenant organization */
  name: string;
  
  /** Comprehensive tenant configuration settings */
  settings: TenantSettings;
  
  /** Current lifecycle status of the tenant */
  status: TenantStatus;
  
  /** ISO timestamp of tenant creation */
  createdAt: string;
  
  /** ISO timestamp of last tenant update */
  updatedAt: string;
  
  /** Flexible metadata storage for tenant-specific attributes */
  metadata: Record<string, unknown>;
}

/**
 * Type guard to check if a user has tenant settings view permission
 * @param permissions - Array of user permissions
 */
export const canViewTenantSettings = (permissions: string[]): boolean => {
  return permissions.includes(PERMISSIONS.TENANT_SETTINGS_VIEW);
};

/**
 * Type guard to check if a user has tenant settings update permission
 * @param permissions - Array of user permissions
 */
export const canUpdateTenantSettings = (permissions: string[]): boolean => {
  return permissions.includes(PERMISSIONS.TENANT_SETTINGS_UPDATE);
};

/**
 * Type guard to check if a tenant status is valid
 * @param status - Status value to check
 */
export const isValidTenantStatus = (status: string): status is TenantStatus => {
  return Object.values(TenantStatus).includes(status as TenantStatus);
};

/**
 * Type for tenant creation payload with required fields
 */
export type CreateTenantPayload = Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Type for tenant update payload with optional fields
 */
export type UpdateTenantPayload = Partial<Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>>;