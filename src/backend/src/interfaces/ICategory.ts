/**
 * @fileoverview Interface definition for lead categories in the multi-tenant CRM system.
 * Implements the 12-stage pipeline process with comprehensive category metadata.
 * @version 1.0.0
 */

import { LeadCategory } from '../constants/leadCategories';

/**
 * Interface defining the structure and properties of a lead category in the CRM system.
 * Supports multi-tenant architecture with complete data isolation between organizations.
 * 
 * @interface ICategory
 * @property {string} id - Unique identifier for the category instance
 * @property {string} tenantId - Tenant identifier for multi-tenant isolation
 * @property {string} name - Human-readable category name
 * @property {string} icon - Material Design icon identifier
 * @property {string} description - Detailed category description
 * @property {string} implementation - Technical implementation details
 * @property {boolean} active - Category activation status
 * @property {number} order - Display and processing order (1-based)
 * @property {LeadCategory} type - Category type from predefined enum
 * @property {Date} createdAt - Category creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */
export interface ICategory {
    /** Unique identifier for the category instance */
    id: string;

    /** Tenant identifier for multi-tenant isolation */
    tenantId: string;

    /** Human-readable category name */
    name: string;

    /** Material Design icon identifier */
    icon: string;

    /** Detailed category description */
    description: string;

    /** Technical implementation details */
    implementation: string;

    /** Category activation status */
    active: boolean;

    /** Display and processing order (1-based) */
    order: number;

    /** Category type from predefined enum */
    type: LeadCategory;

    /** Category creation timestamp */
    createdAt: Date;

    /** Last update timestamp */
    updatedAt: Date;
}