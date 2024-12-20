/**
 * @fileoverview Mongoose model implementation for lead categories in the multi-tenant CRM system.
 * Implements the 12-stage pipeline process with comprehensive validation and tenant isolation.
 * @version 1.0.0
 */

import { Model, model, Document } from 'mongoose'; // v7.x
import { ICategory } from '../../interfaces/ICategory';
import { LeadCategory } from '../../constants/leadCategories';
import categorySchema from '../schemas/categorySchema';

/**
 * Interface for Category model instance methods
 */
interface ICategoryMethods {
  // Add any instance methods here if needed
}

/**
 * Interface for Category model static methods
 */
interface ICategoryModel extends Model<ICategory, {}, ICategoryMethods> {
  /**
   * Find all categories for a specific tenant with enhanced performance
   * @param tenantId - Tenant identifier for data isolation
   * @returns Promise resolving to array of categories
   */
  findByTenantId(tenantId: string): Promise<ICategory[]>;

  /**
   * Find a category by its type for a specific tenant with type validation
   * @param tenantId - Tenant identifier for data isolation
   * @param type - Category type from LeadCategory enum
   * @returns Promise resolving to matching category or null
   */
  findByType(tenantId: string, type: LeadCategory): Promise<ICategory | null>;

  /**
   * Find all active categories for a specific tenant with optimized querying
   * @param tenantId - Tenant identifier for data isolation
   * @returns Promise resolving to array of active categories
   */
  findActiveCategories(tenantId: string): Promise<ICategory[]>;
}

// Add static methods to the schema
categorySchema.statics.findByTenantId = async function(
  tenantId: string
): Promise<ICategory[]> {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  return this.find({ tenantId })
    .sort({ order: 1 })
    .lean()
    .cache({ key: `tenant:${tenantId}:categories` }); // Assumes Redis cache implementation
};

categorySchema.statics.findByType = async function(
  tenantId: string,
  type: LeadCategory
): Promise<ICategory | null> {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  if (!Object.values(LeadCategory).includes(type)) {
    throw new Error('Invalid category type');
  }

  return this.findOne({ tenantId, type })
    .lean()
    .cache({ key: `tenant:${tenantId}:category:${type}` }); // Assumes Redis cache implementation
};

categorySchema.statics.findActiveCategories = async function(
  tenantId: string
): Promise<ICategory[]> {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  return this.find({ tenantId, active: true })
    .sort({ order: 1 })
    .lean()
    .cache({ key: `tenant:${tenantId}:categories:active` }); // Assumes Redis cache implementation
};

/**
 * Pre-find middleware to enforce tenant isolation
 * Ensures all queries include tenantId for data isolation
 */
categorySchema.pre('find', function() {
  if (!this.getQuery().tenantId) {
    throw new Error('Tenant ID is required for data isolation');
  }
});

categorySchema.pre('findOne', function() {
  if (!this.getQuery().tenantId) {
    throw new Error('Tenant ID is required for data isolation');
  }
});

/**
 * Mongoose model for lead categories with enhanced multi-tenant support
 * Implements comprehensive validation and optimized querying capabilities
 */
const Category = model<ICategory, ICategoryModel>('Category', categorySchema);

// Create indexes for optimal query performance
Category.createIndexes().catch(error => {
  console.error('Error creating category indexes:', error);
});

export default Category;