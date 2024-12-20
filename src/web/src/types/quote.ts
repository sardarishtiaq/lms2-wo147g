import { Lead } from './lead';

/**
 * Enumeration of all possible quote statuses for tracking the quote lifecycle.
 * Provides type-safe status identification throughout the application.
 */
export enum QuoteStatus {
    DRAFT = 'DRAFT',
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    EXPIRED = 'EXPIRED',
    ACCEPTED = 'ACCEPTED',
    DECLINED = 'DECLINED'
}

/**
 * Interface defining the structure of individual line items within a quote.
 * Includes comprehensive pricing and tax calculation fields.
 */
export interface QuoteItem {
    /** Unique identifier for the quote item */
    id: string;

    /** Reference to the product catalog item */
    productId: string;

    /** Detailed item description */
    description: string;

    /** Quantity of items */
    quantity: number;

    /** Price per unit */
    unitPrice: number;

    /** Discount percentage (0-100) */
    discountPercent: number;

    /** Tax rate percentage (0-100) */
    taxRate: number;

    /** Total amount for the line item after calculations */
    amount: number;
}

/**
 * Core interface defining the complete structure of a quote entity.
 * Supports multi-tenant isolation and comprehensive quote management features.
 */
export interface Quote {
    /** Unique identifier for the quote */
    id: string;

    /** Tenant identifier for multi-tenant isolation */
    tenantId: string;

    /** Reference to the associated lead */
    leadId: string;

    /** Human-readable quote number for business reference */
    quoteNumber: string;

    /** Quote version number for tracking revisions */
    version: number;

    /** Current status of the quote */
    status: QuoteStatus;

    /** Array of line items in the quote */
    items: QuoteItem[];

    /** Subtotal before discounts and taxes */
    subtotal: number;

    /** Total discount amount */
    totalDiscount: number;

    /** Total tax amount */
    totalTax: number;

    /** Final total amount */
    total: number;

    /** Quote validity end date */
    validUntil: Date;

    /** Additional notes or comments */
    notes: string;

    /** Terms and conditions */
    terms: string;

    /** Flexible metadata for tenant-specific customization */
    metadata: Record<string, unknown>;

    /** ID of the user who created the quote */
    createdBy: string;

    /** ID of the user who approved the quote (if applicable) */
    approvedBy: string;

    /** Creation timestamp */
    createdAt: Date;

    /** Last update timestamp */
    updatedAt: Date;
}

/**
 * Interface for quote form data optimized for frontend form handling.
 * Excludes system-generated fields and computed values.
 */
export interface QuoteFormData {
    /** Reference to the associated lead */
    leadId: string;

    /** Array of line items excluding computed fields */
    items: Omit<QuoteItem, 'id' | 'amount'>[];

    /** Quote validity end date */
    validUntil: Date;

    /** Additional notes or comments */
    notes: string;

    /** Terms and conditions */
    terms: string;
}

/**
 * Interface for comprehensive quote filtering options in the UI.
 * Supports multiple filter combinations for advanced search capabilities.
 */
export interface QuoteFilters {
    /** Filter by quote status */
    status: QuoteStatus;

    /** Filter by associated lead */
    leadId: string;

    /** Filter by quote creator */
    createdBy: string;

    /** Filter by date range start */
    startDate: Date;

    /** Filter by date range end */
    endDate: Date;

    /** Filter by minimum amount */
    minAmount: number;

    /** Filter by maximum amount */
    maxAmount: number;
}

/**
 * Type guard to check if a value is a valid Quote object
 * @param value - The value to check
 * @returns Boolean indicating if the value is a valid Quote
 */
export const isQuote = (value: any): value is Quote => {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof value.id === 'string' &&
        typeof value.tenantId === 'string' &&
        typeof value.leadId === 'string' &&
        typeof value.quoteNumber === 'string' &&
        typeof value.version === 'number' &&
        Object.values(QuoteStatus).includes(value.status) &&
        Array.isArray(value.items) &&
        typeof value.subtotal === 'number' &&
        typeof value.totalDiscount === 'number' &&
        typeof value.totalTax === 'number' &&
        typeof value.total === 'number' &&
        value.validUntil instanceof Date &&
        typeof value.notes === 'string' &&
        typeof value.terms === 'string' &&
        typeof value.metadata === 'object' &&
        typeof value.createdBy === 'string' &&
        (value.approvedBy === null || typeof value.approvedBy === 'string') &&
        value.createdAt instanceof Date &&
        value.updatedAt instanceof Date
    );
};

/**
 * Type guard to check if a value is a valid QuoteItem object
 * @param value - The value to check
 * @returns Boolean indicating if the value is a valid QuoteItem
 */
export const isQuoteItem = (value: any): value is QuoteItem => {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof value.id === 'string' &&
        typeof value.productId === 'string' &&
        typeof value.description === 'string' &&
        typeof value.quantity === 'number' &&
        typeof value.unitPrice === 'number' &&
        typeof value.discountPercent === 'number' &&
        typeof value.taxRate === 'number' &&
        typeof value.amount === 'number'
    );
};