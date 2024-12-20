/**
 * @fileoverview Initial database migration script that sets up the core schema structure
 * for the multi-tenant CRM system with enhanced security and performance optimizations.
 * @version 1.0.0
 */

import mongoose from 'mongoose'; // v7.x
import { TenantStatus, ITenantSettings } from '../../interfaces/ITenant';
import { UserStatus, IUserPreferences } from '../../interfaces/IUser';
import { LeadCategory } from '../../interfaces/ILead';

// Collection name constants for consistency
const COLLECTIONS = {
  TENANTS: 'tenants',
  USERS: 'users',
  LEADS: 'leads',
  ACTIVITIES: 'activities',
  QUOTES: 'quotes'
} as const;

// Index name constants for maintainability
const INDEXES = {
  TENANT_USER: 'idx_tenant_user',
  TENANT_LEAD: 'idx_tenant_lead',
  TENANT_ACTIVITY: 'idx_tenant_activity',
  TENANT_QUOTE: 'idx_tenant_quote'
} as const;

/**
 * Creates the initial database schema with enhanced security measures
 * and performance optimizations for the multi-tenant CRM system.
 */
export async function up(): Promise<void> {
  const db = mongoose.connection.db;

  // Create Tenants Collection
  await db.createCollection(COLLECTIONS.TENANTS, {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['name', 'status', 'settings', 'createdAt'],
        properties: {
          name: { bsonType: 'string', minLength: 1 },
          status: { enum: Object.values(TenantStatus) },
          settings: {
            bsonType: 'object',
            required: ['leadCategories', 'maxUsers', 'maxLeads', 'allowedDomains', 'features'],
            properties: {
              leadCategories: { bsonType: 'array', items: { enum: Object.values(LeadCategory) } },
              maxUsers: { bsonType: 'int', minimum: 1 },
              maxLeads: { bsonType: 'int', minimum: 1 },
              allowedDomains: { bsonType: 'array', items: { bsonType: 'string' } },
              features: {
                bsonType: 'object',
                required: ['quoteManagement', 'advancedReporting', 'apiAccess', 'customFields'],
                properties: {
                  quoteManagement: { bsonType: 'bool' },
                  advancedReporting: { bsonType: 'bool' },
                  apiAccess: { bsonType: 'bool' },
                  customFields: { bsonType: 'bool' }
                }
              }
            }
          },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' }
        }
      }
    }
  });

  // Create Users Collection
  await db.createCollection(COLLECTIONS.USERS, {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenantId', 'email', 'firstName', 'lastName', 'role', 'status', 'preferences'],
        properties: {
          tenantId: { bsonType: 'objectId' },
          email: { bsonType: 'string', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
          firstName: { bsonType: 'string', minLength: 1 },
          lastName: { bsonType: 'string', minLength: 1 },
          role: { enum: ['admin', 'manager', 'agent', 'viewer'] },
          status: { enum: Object.values(UserStatus) },
          preferences: {
            bsonType: 'object',
            required: ['theme', 'language', 'notifications', 'dashboardLayout', 'timezone'],
            properties: {
              theme: { enum: ['light', 'dark'] },
              language: { bsonType: 'string' },
              notifications: {
                bsonType: 'object',
                required: ['email', 'inApp', 'desktop', 'leadUpdates', 'quoteUpdates', 'systemAlerts'],
                properties: {
                  email: { bsonType: 'bool' },
                  inApp: { bsonType: 'bool' },
                  desktop: { bsonType: 'bool' },
                  leadUpdates: { bsonType: 'bool' },
                  quoteUpdates: { bsonType: 'bool' },
                  systemAlerts: { bsonType: 'bool' }
                }
              }
            }
          },
          lastLoginAt: { bsonType: 'date' },
          failedLoginAttempts: { bsonType: 'int', minimum: 0 },
          passwordLastChangedAt: { bsonType: 'date' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' }
        }
      }
    }
  });

  // Create Leads Collection
  await db.createCollection(COLLECTIONS.LEADS, {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenantId', 'category', 'status', 'company', 'contactName', 'email'],
        properties: {
          tenantId: { bsonType: 'objectId' },
          category: { enum: Object.values(LeadCategory) },
          assignedTo: { bsonType: 'objectId' },
          status: { bsonType: 'string' },
          priority: { bsonType: 'int', minimum: 1, maximum: 5 },
          company: { bsonType: 'string', minLength: 1 },
          contactName: { bsonType: 'string', minLength: 1 },
          email: { bsonType: 'string', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
          phone: { bsonType: 'string' },
          source: { bsonType: 'string' },
          metadata: { bsonType: 'object' },
          tags: { bsonType: 'array', items: { bsonType: 'string' } },
          score: { bsonType: 'int', minimum: 0, maximum: 100 },
          isActive: { bsonType: 'bool' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' }
        }
      }
    }
  });

  // Create Activities Collection
  await db.createCollection(COLLECTIONS.ACTIVITIES, {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenantId', 'leadId', 'type', 'performedBy', 'timestamp'],
        properties: {
          tenantId: { bsonType: 'objectId' },
          leadId: { bsonType: 'objectId' },
          type: { bsonType: 'string' },
          performedBy: { bsonType: 'objectId' },
          timestamp: { bsonType: 'date' },
          details: { bsonType: 'object' }
        }
      }
    }
  });

  // Create Quotes Collection
  await db.createCollection(COLLECTIONS.QUOTES, {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenantId', 'leadId', 'status', 'items', 'totalAmount'],
        properties: {
          tenantId: { bsonType: 'objectId' },
          leadId: { bsonType: 'objectId' },
          status: { enum: ['draft', 'sent', 'accepted', 'rejected'] },
          items: { 
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['description', 'quantity', 'unitPrice'],
              properties: {
                description: { bsonType: 'string' },
                quantity: { bsonType: 'number', minimum: 1 },
                unitPrice: { bsonType: 'number', minimum: 0 }
              }
            }
          },
          totalAmount: { bsonType: 'number', minimum: 0 },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' }
        }
      }
    }
  });

  // Create Indexes for Performance and Data Isolation
  await Promise.all([
    // Tenant Indexes
    db.collection(COLLECTIONS.TENANTS).createIndex({ name: 1 }, { unique: true }),
    
    // User Indexes
    db.collection(COLLECTIONS.USERS).createIndex(
      { tenantId: 1, email: 1 },
      { unique: true, name: INDEXES.TENANT_USER }
    ),
    db.collection(COLLECTIONS.USERS).createIndex({ tenantId: 1, role: 1 }),
    
    // Lead Indexes
    db.collection(COLLECTIONS.LEADS).createIndex(
      { tenantId: 1, category: 1 },
      { name: INDEXES.TENANT_LEAD }
    ),
    db.collection(COLLECTIONS.LEADS).createIndex({ tenantId: 1, assignedTo: 1 }),
    db.collection(COLLECTIONS.LEADS).createIndex({ tenantId: 1, score: -1 }),
    
    // Activity Indexes
    db.collection(COLLECTIONS.ACTIVITIES).createIndex(
      { tenantId: 1, leadId: 1, timestamp: -1 },
      { name: INDEXES.TENANT_ACTIVITY }
    ),
    
    // Quote Indexes
    db.collection(COLLECTIONS.QUOTES).createIndex(
      { tenantId: 1, leadId: 1 },
      { name: INDEXES.TENANT_QUOTE }
    ),
    db.collection(COLLECTIONS.QUOTES).createIndex({ tenantId: 1, status: 1 })
  ]);
}

/**
 * Rolls back the initial schema migration by dropping collections and cleaning up
 */
export async function down(): Promise<void> {
  const db = mongoose.connection.db;
  
  // Drop collections in reverse order to handle dependencies
  await Promise.all([
    db.collection(COLLECTIONS.QUOTES).drop(),
    db.collection(COLLECTIONS.ACTIVITIES).drop(),
    db.collection(COLLECTIONS.LEADS).drop(),
    db.collection(COLLECTIONS.USERS).drop(),
    db.collection(COLLECTIONS.TENANTS).drop()
  ]);
}