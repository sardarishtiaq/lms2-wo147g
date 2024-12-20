/**
 * @fileoverview MongoDB schema definition for tenant data model with comprehensive validation
 * Implements multi-tenant data structure with settings, features, and status management
 * @version 1.0.0
 */

import { Schema, model, Types } from 'mongoose'; // v7.x
import { ITenant, ITenantSettings, TenantStatus } from '../../interfaces/ITenant';

/**
 * Custom validator for tenant name
 * Enforces naming conventions and restrictions
 */
const validateTenantName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;
  
  // Check length and character restrictions
  if (name.length < 3 || name.length > 50) return false;
  
  // Allow alphanumeric, spaces, and common business identifiers
  const validNameRegex = /^[a-zA-Z0-9\s\-&.]+$/;
  if (!validNameRegex.test(name)) return false;
  
  // Check for reserved/restricted names
  const restrictedNames = ['admin', 'system', 'test', 'demo'];
  if (restrictedNames.includes(name.toLowerCase())) return false;
  
  return true;
};

/**
 * Validates domain format and structure
 * Ensures proper domain naming conventions
 */
const validateDomain = (domain: string): boolean => {
  if (!domain || typeof domain !== 'string') return false;
  
  // RFC 1035 compliant domain validation
  const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}$/;
  return domainRegex.test(domain);
};

/**
 * Validates lead categories array
 * Ensures proper category format and limits
 */
const validateLeadCategories = (categories: string[]): boolean => {
  if (!Array.isArray(categories)) return false;
  if (categories.length > 20) return false; // Maximum 20 categories per tenant
  
  return categories.every(category => 
    typeof category === 'string' && 
    category.length >= 2 && 
    category.length <= 30 &&
    /^[a-zA-Z0-9\s\-_]+$/.test(category)
  );
};

/**
 * Tenant schema definition with comprehensive validation and indexing
 */
const tenantSchema = new Schema<ITenant>({
  name: {
    type: String,
    required: [true, 'Tenant name is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Tenant name must be at least 3 characters'],
    maxlength: [50, 'Tenant name cannot exceed 50 characters'],
    validate: {
      validator: validateTenantName,
      message: 'Invalid tenant name format or restricted name'
    }
  },
  settings: {
    leadCategories: {
      type: [String],
      default: [],
      validate: {
        validator: validateLeadCategories,
        message: 'Invalid lead categories format or exceeded limit'
      }
    },
    maxUsers: {
      type: Number,
      required: true,
      min: [1, 'Minimum 1 user required'],
      max: [1000, 'Maximum 1000 users allowed'],
      validate: {
        validator: Number.isInteger,
        message: 'User limit must be an integer'
      }
    },
    maxLeads: {
      type: Number,
      required: true,
      min: [100, 'Minimum 100 leads required'],
      max: [1000000, 'Maximum 1,000,000 leads allowed'],
      validate: {
        validator: Number.isInteger,
        message: 'Lead limit must be an integer'
      }
    },
    allowedDomains: {
      type: [String],
      default: [],
      validate: {
        validator: function(domains: string[]) {
          return Array.isArray(domains) && 
                 domains.length <= 50 && // Maximum 50 domains per tenant
                 domains.every(domain => validateDomain(domain));
        },
        message: 'Invalid domain format or exceeded domain limit'
      }
    },
    features: {
      quoteManagement: {
        type: Boolean,
        default: true
      },
      advancedReporting: {
        type: Boolean,
        default: false
      },
      apiAccess: {
        type: Boolean,
        default: false
      },
      customFields: {
        type: Boolean,
        default: false
      }
    }
  },
  status: {
    type: String,
    enum: {
      values: Object.values(TenantStatus),
      message: 'Invalid tenant status'
    },
    default: TenantStatus.ACTIVE,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  version: {
    type: Number,
    default: 1,
    required: true,
    min: 1
  }
}, {
  timestamps: true,
  versionKey: false,
  collection: 'tenants',
  strict: true
});

// Create indexes for optimal query performance
tenantSchema.index({ name: 1 }, { unique: true, sparse: true });
tenantSchema.index({ status: 1, createdAt: -1 });
tenantSchema.index({ name: 1, status: 1 });

/**
 * Static method to find tenant by name with type safety
 */
tenantSchema.statics.findByName = async function(name: string): Promise<ITenant | null> {
  return this.findOne({ name, status: { $ne: TenantStatus.SUSPENDED } });
};

/**
 * Method to update tenant settings with validation
 */
tenantSchema.methods.updateSettings = async function(
  settings: Partial<ITenantSettings>
): Promise<ITenant> {
  this.settings = { ...this.settings, ...settings };
  this.version += 1;
  return this.save();
};

/**
 * Method to validate feature combinations
 */
tenantSchema.methods.validateFeatures = function(): boolean {
  const { features } = this.settings;
  
  // Advanced reporting requires API access
  if (features.advancedReporting && !features.apiAccess) {
    return false;
  }
  
  // Custom fields requires quote management
  if (features.customFields && !features.quoteManagement) {
    return false;
  }
  
  return true;
};

// Create and export the Tenant model
export const TenantModel = model<ITenant>('Tenant', tenantSchema);

// Export the schema for potential extension
export default tenantSchema;