/**
 * @fileoverview MongoDB schema definition for lead categories in the multi-tenant CRM system.
 * Implements the 12-stage pipeline process with comprehensive validation and tenant isolation.
 * @version 1.0.0
 */

import { Schema } from 'mongoose'; // v7.x
import { ICategory, LeadCategory } from '../../interfaces/ICategory';

/**
 * MongoDB schema definition for lead categories with multi-tenant support.
 * Implements comprehensive validation and indexing for optimal performance.
 */
const categorySchema = new Schema<ICategory>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Tenant ID is required for multi-tenant isolation'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters long'],
      maxlength: [50, 'Category name cannot exceed 50 characters'],
    },
    icon: {
      type: String,
      required: [true, 'Material Design icon identifier is required'],
      trim: true,
      validate: {
        validator: function(value: string) {
          // Validate against allowed Material Design icons
          const validIcons = [
            'spatial_audio',
            'assignment_ind',
            'shield_moon',
            'headset_mic',
            'data_exploration',
            'face_5',
            'blanket',
            'readiness_score'
          ];
          return validIcons.includes(value);
        },
        message: 'Invalid Material Design icon identifier'
      }
    },
    description: {
      type: String,
      required: [true, 'Category description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long'],
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    implementation: {
      type: String,
      required: [true, 'Technical implementation details are required'],
      trim: true,
      minlength: [10, 'Implementation details must be at least 10 characters long'],
      maxlength: [1000, 'Implementation details cannot exceed 1000 characters']
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
      index: true
    },
    order: {
      type: Number,
      required: [true, 'Category order is required for pipeline sequencing'],
      min: [1, 'Order must be at least 1'],
      max: [12, 'Order cannot exceed 12'],
      validate: {
        validator: function(value: number) {
          return Number.isInteger(value);
        },
        message: 'Order must be an integer'
      }
    },
    type: {
      type: String,
      required: [true, 'Category type is required'],
      enum: {
        values: Object.values(LeadCategory),
        message: 'Invalid category type'
      },
      validate: {
        validator: function(value: string) {
          return Object.values(LeadCategory).includes(value as LeadCategory);
        },
        message: 'Category type must be a valid LeadCategory enum value'
      }
    }
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
    collection: 'categories', // Explicit collection name
    toJSON: {
      virtuals: true,
      transform: function(doc, ret) {
        ret.id = ret._id; // Map _id to id for API consistency
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: function(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

/**
 * Compound index for tenant isolation and unique category types per tenant
 * Optimizes queries filtering by tenant and category type
 */
categorySchema.index(
  { tenantId: 1, type: 1 },
  { 
    unique: true,
    name: 'tenant_category_type_unique'
  }
);

/**
 * Compound index for tenant isolation and category ordering
 * Optimizes queries for ordered category lists within tenant context
 */
categorySchema.index(
  { tenantId: 1, order: 1 },
  { 
    name: 'tenant_category_order'
  }
);

/**
 * Compound index for tenant isolation and active status
 * Optimizes queries for active categories within tenant context
 */
categorySchema.index(
  { tenantId: 1, active: 1 },
  { 
    name: 'tenant_category_active'
  }
);

/**
 * Pre-save middleware to ensure order uniqueness within tenant context
 */
categorySchema.pre('save', async function(next) {
  if (this.isModified('order')) {
    const Category = this.constructor as any;
    const existing = await Category.findOne({
      tenantId: this.tenantId,
      order: this.order,
      _id: { $ne: this._id }
    });
    if (existing) {
      next(new Error('Category order must be unique within tenant'));
    }
  }
  next();
});

export default categorySchema;