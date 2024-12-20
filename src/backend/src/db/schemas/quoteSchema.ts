/**
 * @fileoverview Mongoose schema definition for quotes in the multi-tenant CRM system.
 * Provides comprehensive structure for quote generation and tracking with tenant isolation,
 * automatic calculations, and validation.
 * @version 1.0.0
 */

import { Schema, Types } from 'mongoose'; // v7.0.0
import { IQuote, IQuoteDocument } from '../../interfaces/IQuote';

/**
 * Embedded schema for quote line items with enhanced validation and calculation
 */
const QuoteItemSchema = new Schema({
  itemId: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.01,
    validate: {
      validator: Number.isFinite,
      message: 'Quantity must be a valid number'
    }
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isFinite,
      message: 'Unit price must be a valid number'
    }
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP'],
    default: 'USD'
  },
  customFields: {
    type: Map,
    of: Schema.Types.Mixed,
    default: () => new Map()
  },
  taxable: {
    type: Boolean,
    required: true,
    default: true
  }
}, {
  _id: false,
  timestamps: false
});

/**
 * Pre-save middleware for quote item amount calculation
 */
QuoteItemSchema.pre('save', function() {
  this.amount = Number((this.quantity * this.unitPrice).toFixed(2));
});

/**
 * Quote schema definition with comprehensive validation and tenant isolation
 */
const QuoteSchema = new Schema<IQuoteDocument>({
  tenantId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Tenant ID is required'],
    ref: 'Tenant',
    index: true
  },
  leadId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Lead ID is required'],
    ref: 'Lead',
    index: true
  },
  quoteNumber: {
    type: String,
    required: [true, 'Quote number is required'],
    unique: true,
    validate: {
      validator: (v: string) => /^QT-\d{6}-\d{4}$/.test(v),
      message: 'Quote number must follow format: QT-XXXXXX-YYYY'
    }
  },
  version: {
    type: String,
    required: true,
    default: '1.0'
  },
  status: {
    type: String,
    required: true,
    enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
    default: 'draft'
  },
  items: {
    type: [QuoteItemSchema],
    required: true,
    validate: {
      validator: (items: any[]) => Array.isArray(items) && items.length > 0,
      message: 'At least one item is required'
    }
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxRate: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0
  },
  tax: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP'],
    default: 'USD'
  },
  validUntil: {
    type: Date,
    required: true,
    validate: {
      validator: (date: Date) => date > new Date(),
      message: 'Valid until date must be in the future'
    }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: () => new Map()
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true,
    required: true
  },
  tags: {
    type: [String],
    default: [],
    validate: {
      validator: (tags: string[]) => Array.isArray(tags) && tags.every(tag => typeof tag === 'string'),
      message: 'Tags must be an array of strings'
    }
  }
}, {
  timestamps: true,
  collection: 'quotes',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Compound indexes for optimized querying and tenant isolation
 */
QuoteSchema.index({ tenantId: 1, leadId: 1 }, { background: true });
QuoteSchema.index({ tenantId: 1, quoteNumber: 1 }, { unique: true, background: true });
QuoteSchema.index({ tenantId: 1, status: 1 }, { background: true });
QuoteSchema.index({ tenantId: 1, validUntil: 1 }, { background: true });

/**
 * Pre-save middleware for quote calculations
 */
QuoteSchema.pre('save', async function(next) {
  try {
    // Calculate subtotal
    this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
    
    // Calculate tax amount for taxable items
    const taxableAmount = this.items
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + item.amount, 0);
    
    this.tax = Number((taxableAmount * this.taxRate).toFixed(2));
    
    // Calculate total
    this.total = Number((this.subtotal + this.tax).toFixed(2));

    // Validate minimum amount requirements
    if (this.total < 0.01) {
      throw new Error('Quote total must be greater than zero');
    }

    // Auto-expire quote if validUntil date has passed
    if (this.validUntil < new Date() && this.status !== 'expired') {
      this.status = 'expired';
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Pre-validate middleware for enhanced validation
 */
QuoteSchema.pre('validate', async function(next) {
  try {
    // Validate tenant context
    if (!this.tenantId) {
      throw new Error('Tenant context is required');
    }

    // Validate status transitions
    if (this.isModified('status')) {
      const validTransitions: Record<string, string[]> = {
        draft: ['sent', 'expired'],
        sent: ['accepted', 'rejected', 'expired'],
        accepted: ['expired'],
        rejected: ['expired'],
        expired: []
      };

      const currentStatus = this.status;
      const previousStatus = this.get('status', String, { getters: false });

      if (previousStatus && 
          !validTransitions[previousStatus].includes(currentStatus)) {
        throw new Error(`Invalid status transition from ${previousStatus} to ${currentStatus}`);
      }
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Virtual for remaining validity days
 */
QuoteSchema.virtual('validityDays').get(function() {
  return Math.ceil((this.validUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
});

export default QuoteSchema;