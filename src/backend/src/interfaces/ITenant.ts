/**
 * @fileoverview Defines the core tenant interfaces and types for the multi-tenant CRM system
 * Implements tenant data structure, settings, and configuration types
 * @version 1.0.0
 */

import { Document } from 'mongoose'; // v7.x
import { PERMISSIONS } from '../constants/permissions';

/**
 * Enum defining possible tenant status values
 * Used to track tenant account state
 */
export enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

/**
 * Interface defining available feature flags for tenants
 * Controls access to premium/optional features
 */
export interface ITenantFeatures {
  /** Enable quote generation and management functionality */
  quoteManagement: boolean;
  
  /** Enable advanced reporting and analytics */
  advancedReporting: boolean;
  
  /** Enable API access for external integrations */
  apiAccess: boolean;
  
  /** Enable custom fields for leads and contacts */
  customFields: boolean;
}

/**
 * Interface defining tenant configuration settings
 * Contains all customizable tenant-level settings
 */
export interface ITenantSettings {
  /** List of enabled lead categories for this tenant */
  leadCategories: string[];
  
  /** Maximum number of users allowed for the tenant */
  maxUsers: number;
  
  /** Maximum number of leads allowed for the tenant */
  maxLeads: number;
  
  /** List of allowed email domains for user registration */
  allowedDomains: string[];
  
  /** Feature flags configuration */
  features: ITenantFeatures;
}

/**
 * Main tenant interface extending MongoDB Document
 * Defines the core tenant data structure
 * @requires PERMISSIONS.TENANT_SETTINGS_VIEW for reading
 * @requires PERMISSIONS.TENANT_SETTINGS_UPDATE for modification
 */
export interface ITenant extends Document {
  /** Unique identifier for the tenant */
  id: string;
  
  /** Display name of the tenant organization */
  name: string;
  
  /** Tenant configuration settings */
  settings: ITenantSettings;
  
  /** Current status of the tenant account */
  status: TenantStatus;
  
  /** Timestamp of tenant creation */
  createdAt: Date;
  
  /** Timestamp of last tenant update */
  updatedAt: Date;
}