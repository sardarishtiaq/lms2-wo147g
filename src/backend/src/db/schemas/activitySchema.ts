/**
 * @fileoverview Mongoose schema definition for activity records in the CRM system.
 * Implements comprehensive activity tracking with multi-tenant isolation, real-time
 * updates support, and performance optimizations.
 * @version 1.0.0
 */

import { Schema, SchemaTypes } from 'mongoose'; // v7.x
import { IActivity, ActivityType } from '../../interfaces/IActivity';

/**
 * Mongoose schema definition for activity records with enhanced security,
 * performance optimizations, and strict validation rules.
 */
const ActivitySchema = new Schema<IActivity>({
    tenantId: {
        type: SchemaTypes.ObjectId,
        required: true,
        ref: 'Tenant',
        index: true,
        immutable: true,
        validate: {
            validator: function(v: any) {
                return v != null && v.toString().length === 24;
            },
            message: 'Invalid tenant ID format'
        }
    },
    leadId: {
        type: SchemaTypes.ObjectId,
        required: true,
        ref: 'Lead',
        index: true,
        immutable: true,
        validate: {
            validator: function(v: any) {
                return v != null && v.toString().length === 24;
            },
            message: 'Invalid lead ID format'
        }
    },
    userId: {
        type: SchemaTypes.ObjectId,
        required: true,
        ref: 'User',
        index: true,
        validate: {
            validator: function(v: any) {
                return v != null && v.toString().length === 24;
            },
            message: 'Invalid user ID format'
        }
    },
    type: {
        type: String,
        required: true,
        enum: Object.values(ActivityType),
        index: true,
        validate: {
            validator: function(v: string) {
                return Object.values(ActivityType).includes(v as ActivityType);
            },
            message: 'Invalid activity type'
        }
    },
    description: {
        type: String,
        required: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
        trim: true,
        validate: {
            validator: function(v: string) {
                return v.length > 0 && v.length <= 1000;
            },
            message: 'Description must be between 1 and 1000 characters'
        }
    },
    metadata: {
        type: SchemaTypes.Mixed,
        default: {},
        validate: {
            validator: function(v: Record<string, any>) {
                // Validate metadata size and structure
                const serialized = JSON.stringify(v);
                return Object.keys(v).length <= 20 && // Max 20 keys
                       serialized.length <= 16384;    // Max 16KB size
            },
            message: 'Metadata exceeds size or complexity limits'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    // Schema options
    timestamps: true,
    collection: 'activities',
    strict: true,
    optimisticConcurrency: true,
    versionKey: '__v'
});

// Compound indexes for optimized queries
ActivitySchema.index({ tenantId: 1, createdAt: -1 }, { 
    name: 'idx_tenant_timeline',
    background: true 
});

ActivitySchema.index({ leadId: 1, type: 1 }, { 
    name: 'idx_lead_activity_type',
    background: true 
});

ActivitySchema.index({ createdAt: 1 }, { 
    name: 'idx_ttl',
    expireAfterSeconds: 365 * 24 * 60 * 60 // TTL index: 1 year
});

// Pre-save middleware for validation and timestamps
ActivitySchema.pre('save', async function(next) {
    if (this.isNew) {
        this.createdAt = new Date();
    }
    this.updatedAt = new Date();

    // Validate metadata structure
    if (this.metadata) {
        try {
            // Ensure metadata is serializable
            JSON.stringify(this.metadata);
        } catch (error) {
            next(new Error('Invalid metadata structure'));
            return;
        }
    }

    next();
});

// Virtual for formatted timestamp
ActivitySchema.virtual('formattedCreatedAt').get(function() {
    return this.createdAt.toISOString();
});

// Ensure toJSON includes virtuals and removes sensitive data
ActivitySchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function(doc: any, ret: any) {
        delete ret.__v;
        return ret;
    }
});

export default ActivitySchema;