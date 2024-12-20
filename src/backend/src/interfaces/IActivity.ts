/**
 * @fileoverview Interface definition for activity records in the CRM system.
 * Provides comprehensive structure for tracking all lead-related interactions,
 * events, and timeline activities with multi-tenant isolation and real-time
 * update support.
 * @version 1.0.0
 */

import { Document, Types } from 'mongoose'; // v7.x

/**
 * Enumeration of all possible activity types in the CRM system.
 * Used for consistent categorization and filtering of activities.
 */
export enum ActivityType {
    LEAD_CREATED = 'LEAD_CREATED',
    LEAD_UPDATED = 'LEAD_UPDATED',
    LEAD_ASSIGNED = 'LEAD_ASSIGNED',
    CATEGORY_CHANGED = 'CATEGORY_CHANGED',
    QUOTE_GENERATED = 'QUOTE_GENERATED',
    DEMO_SCHEDULED = 'DEMO_SCHEDULED',
    NOTE_ADDED = 'NOTE_ADDED',
    STATUS_CHANGED = 'STATUS_CHANGED',
    COMMUNICATION_LOGGED = 'COMMUNICATION_LOGGED',
    DOCUMENT_ATTACHED = 'DOCUMENT_ATTACHED'
}

/**
 * Core interface defining the structure for activity records in the CRM system.
 * Extends Mongoose Document for MongoDB integration and document functionality.
 * 
 * @interface IActivity
 * @extends {Document}
 */
export interface IActivity extends Document {
    /**
     * Unique identifier for the activity record
     */
    _id: Types.ObjectId;

    /**
     * Reference to the tenant organization for data isolation
     */
    tenantId: Types.ObjectId;

    /**
     * Reference to the associated lead
     */
    leadId: Types.ObjectId;

    /**
     * Reference to the user who performed the activity
     */
    userId: Types.ObjectId;

    /**
     * Type of activity from predefined ActivityType enum
     */
    type: ActivityType;

    /**
     * Human-readable description of the activity
     */
    description: string;

    /**
     * Additional structured data specific to the activity type
     * Examples:
     * - For QUOTE_GENERATED: { quoteId: string, amount: number }
     * - For DEMO_SCHEDULED: { dateTime: Date, platform: string }
     */
    metadata: Record<string, any>;

    /**
     * Timestamp of activity creation
     */
    createdAt: Date;

    /**
     * Timestamp of last activity update
     */
    updatedAt: Date;
}