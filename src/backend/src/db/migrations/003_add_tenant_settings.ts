/**
 * @fileoverview Migration script to add tenant settings and feature flags
 * Implements configurable tenant-level settings with validation
 * @version 1.0.0
 */

import mongoose from 'mongoose'; // v7.x
import { ITenantSettings, ITenantFeatures } from '../../interfaces/ITenant';

// Constants for default settings
const DEFAULT_MAX_USERS = 10;
const DEFAULT_MAX_LEADS = 1000;
const DEFAULT_LEAD_CATEGORIES = [
  'Un-Assigned',
  'Assigned',
  'Working On',
  'Pre Qualified',
  'Ready for Demo',
  'Pipeline'
];

/**
 * Generates default tenant settings configuration
 * @returns {ITenantSettings} Default tenant settings object
 */
const getDefaultSettings = (): ITenantSettings => ({
  leadCategories: DEFAULT_LEAD_CATEGORIES,
  maxUsers: DEFAULT_MAX_USERS,
  maxLeads: DEFAULT_MAX_LEADS,
  allowedDomains: [],
  features: {
    quoteManagement: true,
    advancedReporting: false,
    apiAccess: false,
    customFields: false
  }
});

/**
 * Validates feature flags object structure
 * @param {ITenantFeatures} features Feature flags object to validate
 * @returns {boolean} Validation result
 */
const validateFeatureFlags = (features: ITenantFeatures): boolean => {
  const requiredFlags = [
    'quoteManagement',
    'advancedReporting',
    'apiAccess',
    'customFields'
  ];
  return requiredFlags.every(flag => 
    typeof features[flag as keyof ITenantFeatures] === 'boolean'
  );
};

/**
 * Applies migration to add tenant settings
 * @returns {Promise<void>}
 */
export const up = async (): Promise<void> => {
  const db = mongoose.connection;
  const session = await db.startSession();

  try {
    await session.withTransaction(async () => {
      // Add settings schema validation
      await db.collection('tenants').updateMany(
        {},
        [{
          $set: {
            settings: {
              $ifNull: ['$settings', getDefaultSettings()]
            }
          }
        }],
        { session }
      );

      // Create compound index for tenant limits
      await db.collection('tenants').createIndex(
        {
          'settings.maxUsers': 1,
          'settings.maxLeads': 1
        },
        {
          name: 'tenant_settings_limits',
          background: true
        }
      );

      // Update schema validation
      await db.command({
        collMod: 'tenants',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['settings'],
            properties: {
              settings: {
                bsonType: 'object',
                required: ['maxUsers', 'maxLeads', 'leadCategories', 'features'],
                properties: {
                  maxUsers: {
                    bsonType: 'int',
                    minimum: 1,
                    maximum: 1000
                  },
                  maxLeads: {
                    bsonType: 'int',
                    minimum: 100,
                    maximum: 1000000
                  },
                  leadCategories: {
                    bsonType: 'array',
                    minItems: 1,
                    items: {
                      bsonType: 'string'
                    }
                  },
                  allowedDomains: {
                    bsonType: 'array',
                    items: {
                      bsonType: 'string'
                    }
                  },
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
              }
            }
          }
        },
        validationLevel: 'strict',
        validationAction: 'error'
      });
    });
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Rolls back tenant settings migration
 * @returns {Promise<void>}
 */
export const down = async (): Promise<void> => {
  const db = mongoose.connection;
  const session = await db.startSession();

  try {
    await session.withTransaction(async () => {
      // Drop settings-related index
      await db.collection('tenants').dropIndex('tenant_settings_limits');

      // Remove settings field from all tenants
      await db.collection('tenants').updateMany(
        {},
        { $unset: { settings: '' } },
        { session }
      );

      // Remove schema validation
      await db.command({
        collMod: 'tenants',
        validator: {},
        validationLevel: 'off',
        validationAction: 'warn'
      });
    });
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

export default {
  up,
  down
};