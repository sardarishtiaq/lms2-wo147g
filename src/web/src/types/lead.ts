import { LeadCategory } from '../constants/leadCategories';

/**
 * Core interface defining the complete structure of a lead entity with multi-tenant support.
 * Provides comprehensive type safety for lead management operations across the 12-stage pipeline.
 */
export interface Lead {
    /** Unique identifier for the lead */
    id: string;

    /** Tenant identifier for multi-tenant isolation */
    tenantId: string;

    /** Current category in the 12-stage pipeline process */
    category: LeadCategory;

    /** ID of the assigned agent, null if unassigned */
    assignedTo: string | null;

    /** Current status of the lead */
    status: string;

    /** Priority level (1-5, where 5 is highest) */
    priority: number;

    /** Company/organization name */
    company: string;

    /** Primary contact person name */
    contactName: string;

    /** Contact email address */
    email: string;

    /** Contact phone number */
    phone: string;

    /** Lead generation source */
    source: string;

    /** Additional flexible metadata for tenant-specific customization */
    metadata: Record<string, any>;

    /** Creation timestamp (ISO format) */
    createdAt: string;

    /** Last update timestamp (ISO format) */
    updatedAt: string;

    /** Last activity timestamp (ISO format) */
    lastActivityAt: string;

    /** Lead qualification score (0-100) */
    score: number;
}

/**
 * Interface for lead form data with validation support.
 * Used for create and edit operations in the frontend.
 */
export interface LeadFormData {
    /** Company/organization name */
    company: string;

    /** Primary contact person name */
    contactName: string;

    /** Contact email address */
    email: string;

    /** Contact phone number */
    phone: string;

    /** Lead generation source */
    source: string;

    /** Selected category in the pipeline */
    category: LeadCategory;

    /** Priority level (1-5) */
    priority: number;

    /** Additional metadata fields */
    metadata: Record<string, any>;
}

/**
 * Comprehensive interface for lead filtering options in the UI.
 * Supports multiple filter combinations for advanced search capabilities.
 */
export interface LeadFilters {
    /** Filter by multiple categories */
    category: LeadCategory[];

    /** Filter by assigned agents */
    assignedTo: string[];

    /** Filter by status values */
    status: string[];

    /** Filter by priority levels */
    priority: number[];

    /** Filter by date range */
    dateRange: {
        start: string;
        end: string;
    };

    /** Filter by lead score range */
    score: {
        min: number;
        max: number;
    };

    /** Filter by lead sources */
    source: string[];
}

/**
 * Type guard to check if a value is a valid Lead object
 * @param value - The value to check
 * @returns Boolean indicating if the value is a valid Lead
 */
export const isLead = (value: any): value is Lead => {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof value.id === 'string' &&
        typeof value.tenantId === 'string' &&
        Object.values(LeadCategory).includes(value.category) &&
        (value.assignedTo === null || typeof value.assignedTo === 'string') &&
        typeof value.status === 'string' &&
        typeof value.priority === 'number' &&
        typeof value.company === 'string' &&
        typeof value.contactName === 'string' &&
        typeof value.email === 'string' &&
        typeof value.phone === 'string' &&
        typeof value.source === 'string' &&
        typeof value.metadata === 'object' &&
        typeof value.createdAt === 'string' &&
        typeof value.updatedAt === 'string' &&
        typeof value.lastActivityAt === 'string' &&
        typeof value.score === 'number'
    );
};

/**
 * Type guard to check if a value is a valid LeadFormData object
 * @param value - The value to check
 * @returns Boolean indicating if the value is a valid LeadFormData
 */
export const isLeadFormData = (value: any): value is LeadFormData => {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof value.company === 'string' &&
        typeof value.contactName === 'string' &&
        typeof value.email === 'string' &&
        typeof value.phone === 'string' &&
        typeof value.source === 'string' &&
        Object.values(LeadCategory).includes(value.category) &&
        typeof value.priority === 'number' &&
        typeof value.metadata === 'object'
    );
};