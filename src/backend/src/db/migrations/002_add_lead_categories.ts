/**
 * @fileoverview Database migration to create and populate the lead categories collection
 * with multi-tenant support and proper indexing for the CRM's 12-stage pipeline process.
 * @version 1.0.0
 */

import mongoose from 'mongoose'; // v7.x
import { LeadCategory, CATEGORY_DETAILS } from '../../constants/leadCategories';
import categorySchema from '../../db/schemas/categorySchema';

/**
 * Migration to create the categories collection and populate initial category data
 * with multi-tenant support and proper indexing.
 * 
 * @returns {Promise<void>} Resolves when migration is complete
 */
export const up = async (): Promise<void> => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.collections();
    
    // Check if categories collection already exists
    if (collections.find(c => c.collectionName === 'categories')) {
      console.log('Categories collection already exists, skipping creation');
      return;
    }

    // Create categories collection with schema validation
    await db.createCollection('categories', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['tenantId', 'name', 'icon', 'description', 'implementation', 'active', 'order', 'type'],
          properties: {
            tenantId: { bsonType: 'objectId' },
            name: { 
              bsonType: 'string',
              minLength: 2,
              maxLength: 50
            },
            icon: { bsonType: 'string' },
            description: {
              bsonType: 'string',
              minLength: 10,
              maxLength: 500
            },
            implementation: {
              bsonType: 'string',
              minLength: 10,
              maxLength: 1000
            },
            active: { bsonType: 'bool' },
            order: {
              bsonType: 'int',
              minimum: 1,
              maximum: 12
            },
            type: { 
              enum: Object.values(LeadCategory)
            }
          }
        }
      }
    });

    // Get reference to the categories collection
    const categories = db.collection('categories');

    // Create compound indexes for tenant isolation and optimization
    await categories.createIndex(
      { tenantId: 1, type: 1 },
      { 
        unique: true,
        name: 'tenant_category_type_unique'
      }
    );

    await categories.createIndex(
      { tenantId: 1, order: 1 },
      { 
        name: 'tenant_category_order'
      }
    );

    await categories.createIndex(
      { tenantId: 1, active: 1 },
      { 
        name: 'tenant_category_active'
      }
    );

    // Create system tenant for initial categories (will be used as template)
    const systemTenantId = new mongoose.Types.ObjectId();

    // Prepare initial category data with system tenant
    const initialCategories = CATEGORY_DETAILS.map(category => ({
      tenantId: systemTenantId,
      name: category.name,
      icon: category.icon,
      description: category.description,
      implementation: category.implementation,
      active: true,
      order: category.order,
      type: category.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // Insert initial categories
    await categories.insertMany(initialCategories);

    console.log('Successfully created categories collection and populated initial data');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

/**
 * Rollback migration by dropping the categories collection
 * with proper tenant consideration.
 * 
 * @returns {Promise<void>} Resolves when rollback is complete
 */
export const down = async (): Promise<void> => {
  try {
    const db = mongoose.connection.db;
    
    // Create backup of existing category data if needed
    const categories = db.collection('categories');
    const backupName = `categories_backup_${Date.now()}`;
    await db.createCollection(backupName);
    const backup = db.collection(backupName);
    
    // Copy existing data to backup
    const existingCategories = await categories.find({}).toArray();
    if (existingCategories.length > 0) {
      await backup.insertMany(existingCategories);
    }

    // Drop the categories collection and its indexes
    await categories.drop();

    console.log('Successfully rolled back categories migration');
    console.log(`Backup created in collection: ${backupName}`);

  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
};