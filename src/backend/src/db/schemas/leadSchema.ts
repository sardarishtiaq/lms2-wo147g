/**
 * @fileoverview MongoDB schema definition for lead entities in the multi-tenant CRM system.
 * Implements the 12-stage pipeline process with comprehensive validation, indexing, and tenant isolation.
 * @version 1.0.0
 */

import { Schema, model, Types } from 'mongoose'; // v7.0.0
import { ILead } from '../../interfaces/ILead';
import { LeadCategory } from '../../constants/leadCategories';

/**
 * Validates the metadata structure for a lead
 * @param metadata - The metadata object to validate
 * @returns boolean indicating if the metadata is valid
 */
const validateMetadata = (metadata: Record<string, any>): boolean => {
  // Ensure metadata is a plain object
  if (!(metadata instanceof Object) || Array.isArray(metadata)) {
    return false;
  }
  
  // Validate known metadata fields
  const allowedTypes = ['string', 'number', 'boolean', 'object'];
  return Object.values(metadata).every(value => 
    value === null || allowedTypes.includes(typeof value)
  );
};

/**
 * Validates category transitions based on the pipeline rules
 * @param category - The new category value
 * @returns boolean indicating if the transition is valid
 */
const validateCategoryTransition = function(this: any, category: string): boolean {
  if (this.isNew) return true; // Allow any initial category
  
  const currentCategory = this.category;
  if (currentCategory === category) return true;
  
  // Get current and new category orders
  const currentOrder = LeadCategory[currentCategory as keyof typeof LeadCategory];
  const newOrder = LeadCategory[category as keyof typeof LeadCategory];
  
  // Validate sequential progression (allow moving back one stage)
  return Math.abs(newOrder - currentOrder) <= 1;
};

/**
 * Schema definition for the lead entity
 */
const leadSchema = new Schema<ILead>({
  tenantId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Tenant ID is required'],
    ref: 'Tenant',
    index: true
  },
  
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: Object.values(LeadCategory),
    default: LeadCategory.UNASSIGNED,
    validate: {
      validator: validateCategoryTransition,
      message: 'Invalid category transition'
    },
    index: true
  },
  
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    sparse: true
  },
  
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['ACTIVE', 'INACTIVE', 'CONVERTED', 'LOST'],
    default: 'ACTIVE',
    index: true
  },
  
  priority: {
    type: Number,
    required: [true, 'Priority is required'],
    min: [1, 'Priority must be between 1 and 5'],
    max: [5, 'Priority must be between 1 and 5'],
    default: 3
  },
  
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    minlength: [2, 'Company name must be at least 2 characters'],
    maxlength: [100, 'Company name cannot exceed 100 characters'],
    index: true
  },
  
  contactName: {
    type: String,
    required: [true, 'Contact name is required'],
    trim: true,
    minlength: [2, 'Contact name must be at least 2 characters'],
    maxlength: [100, 'Contact name cannot exceed 100 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    index: true
  },
  
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format']
  },
  
  source: {
    type: String,
    required: [true, 'Lead source is required'],
    trim: true
  },
  
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
    validate: {
      validator: validateMetadata,
      message: 'Invalid metadata structure'
    }
  },
  
  lastActivityTimestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  categoryChangeHistory: [{
    fromCategory: String,
    toCategory: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  }],
  
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  tags: [{
    type: String,
    trim: true
  }],
  
  relatedLeads: [{
    type: Schema.Types.ObjectId,
    ref: 'Lead'
  }],
  
  lastActivity: {
    type: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    details: Schema.Types.Mixed
  },
  
  pipelineStage: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'leads'
});

// Compound indexes for optimized queries
leadSchema.index({ tenantId: 1, category: 1, status: 1 });
leadSchema.index({ tenantId: 1, assignedTo: 1 });
leadSchema.index({ tenantId: 1, email: 1 });
leadSchema.index({ tenantId: 1, company: 1 });
leadSchema.index({ tenantId: 1, lastActivityTimestamp: -1 });
leadSchema.index({ tenantId: 1, category: 1, priority: -1 });

/**
 * Pre-save middleware for lead processing
 */
leadSchema.pre('save', async function(next) {
  if (this.isModified('category')) {
    // Record category change in history
    const oldCategory = this.isNew ? null : this.$__.previousValue('category');
    if (oldCategory !== this.category) {
      this.categoryChangeHistory.push({
        fromCategory: oldCategory,
        toCategory: this.category,
        changedAt: new Date(),
        changedBy: this.modifiedBy // Assumes modifiedBy is set in the request context
      });
    }
  }
  
  // Update lastActivityTimestamp
  this.lastActivityTimestamp = new Date();
  
  next();
});

/**
 * Export the lead model with strict type checking
 */
export const Lead = model<ILead>('Lead', leadSchema);

export default leadSchema;