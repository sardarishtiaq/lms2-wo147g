/**
 * @fileoverview Quote entity interface definitions for the multi-tenant CRM system.
 * Provides comprehensive type definitions for quote generation and tracking with
 * complete tenant isolation support.
 * @version 1.0.0
 */

import { Types } from 'mongodb'; // v5.0.0
import { Document } from 'mongoose'; // v7.0.0
import { ILead } from './ILead';

/**
 * Interface defining a line item in a quote with comprehensive item details
 * and calculations. Supports flexible customization through custom fields.
 */
export interface IQuoteItem {
    /** Unique identifier for the item */
    itemId: string;

    /** Detailed description of the item */
    description: string;

    /** Quantity of items */
    quantity: number;

    /** Price per unit */
    unitPrice: number;

    /** Total amount for this line item (quantity * unitPrice) */
    amount: number;

    /** Currency code for the item (e.g., 'USD', 'EUR') */
    currency: string;

    /** Flexible storage for additional item-specific fields */
    customFields: Record<string, any>;

    /** Flag indicating if this item is subject to tax */
    taxable: boolean;
}

/**
 * Core interface defining the structure of a quote entity with complete
 * tracking and calculation capabilities. Supports multi-tenant isolation
 * and comprehensive quote management features.
 */
export interface IQuote {
    /** Unique identifier for the quote */
    _id: Types.ObjectId;

    /** Associated tenant identifier for multi-tenant isolation */
    tenantId: Types.ObjectId;

    /** Reference to the associated lead */
    leadId: Types.ObjectId;

    /** Unique quote number for reference */
    quoteNumber: string;

    /** Current status of the quote (e.g., 'draft', 'sent', 'accepted', 'expired') */
    status: string;

    /** Version number for quote revisions */
    version: string;

    /** Array of line items in the quote */
    items: IQuoteItem[];

    /** Subtotal amount before tax */
    subtotal: number;

    /** Applicable tax rate as a decimal */
    taxRate: number;

    /** Calculated tax amount */
    tax: number;

    /** Total amount including tax */
    total: number;

    /** Currency code for the quote */
    currency: string;

    /** Quote validity date */
    validUntil: Date;

    /** Additional notes or terms */
    notes: string;

    /** Flexible metadata storage for additional quote information */
    metadata: Record<string, any>;

    /** User who created the quote */
    createdBy: Types.ObjectId;

    /** User who last modified the quote */
    lastModifiedBy: Types.ObjectId;

    /** Quote creation timestamp */
    createdAt: Date;

    /** Last update timestamp */
    updatedAt: Date;

    /** Flag indicating if the quote is active */
    isActive: boolean;

    /** Categorization and filtering tags */
    tags: string[];
}

/**
 * Extended interface that combines IQuote with Mongoose Document properties
 * for database operations. Provides complete type coverage for MongoDB
 * operations while maintaining the core quote structure.
 */
export interface IQuoteDocument extends IQuote, Document {
    // Inherits all properties from IQuote and Document
}