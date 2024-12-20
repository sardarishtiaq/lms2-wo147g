/**
 * @fileoverview Activity validation module for the CRM system.
 * Implements comprehensive validation rules for activity records with
 * enhanced security, tenant isolation, and performance optimizations.
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { ObjectId } from 'mongodb'; // v5.0.0
import { IActivity, ActivityType } from '../../interfaces/IActivity';
import { ErrorCode } from '../../constants/errorCodes';

/**
 * Performance optimization: Cache validation results
 * Key: JSON stringified activity data, Value: validation result
 */
const VALIDATION_CACHE = new Map<string, Joi.ValidationResult>();

/**
 * Maximum cache size to prevent memory leaks
 */
const MAX_CACHE_SIZE = 1000;

/**
 * Metadata validation schemas for different activity types
 */
const metadataSchemas = {
    [ActivityType.QUOTE_GENERATED]: Joi.object({
        quoteId: Joi.string().required(),
        amount: Joi.number().positive().required(),
        currency: Joi.string().length(3).required()
    }),
    [ActivityType.DEMO_SCHEDULED]: Joi.object({
        dateTime: Joi.date().iso().greater('now').required(),
        platform: Joi.string().required(),
        duration: Joi.number().integer().min(15).max(180).required()
    }),
    [ActivityType.LEAD_ASSIGNED]: Joi.object({
        previousAssignee: Joi.string().allow(null),
        newAssignee: Joi.string().required(),
        reason: Joi.string()
    }),
    [ActivityType.COMMUNICATION_LOGGED]: Joi.object({
        channel: Joi.string().valid('email', 'phone', 'meeting', 'other').required(),
        duration: Joi.number().integer().min(0),
        outcome: Joi.string().required()
    }),
    [ActivityType.DOCUMENT_ATTACHED]: Joi.object({
        documentId: Joi.string().required(),
        fileName: Joi.string().required(),
        fileSize: Joi.number().integer().positive().required(),
        mimeType: Joi.string().required()
    })
};

/**
 * Base Joi schema for activity validation with enhanced security measures
 */
export const activitySchema = Joi.object<IActivity>({
    _id: Joi.string().custom((value, helpers) => {
        return ObjectId.isValid(value) ? value : helpers.error('invalid id');
    }).optional(),
    
    tenantId: Joi.string().custom((value, helpers) => {
        return ObjectId.isValid(value) ? value : helpers.error('invalid tenant id');
    }).required(),
    
    leadId: Joi.string().custom((value, helpers) => {
        return ObjectId.isValid(value) ? value : helpers.error('invalid lead id');
    }).required(),
    
    userId: Joi.string().custom((value, helpers) => {
        return ObjectId.isValid(value) ? value : helpers.error('invalid user id');
    }).required(),
    
    type: Joi.string().valid(...Object.values(ActivityType)).required(),
    
    description: Joi.string()
        .min(1)
        .max(1000)
        .pattern(/^[^<>]*$/) // Basic XSS prevention
        .required(),
    
    metadata: Joi.object().custom((value, helpers) => {
        const ctx = helpers.state.ancestors[0] as IActivity;
        const typeSchema = metadataSchemas[ctx.type];
        if (!typeSchema) {
            return value; // Allow any metadata for types without specific schema
        }
        const { error } = typeSchema.validate(value);
        if (error) {
            return helpers.error('invalid metadata');
        }
        return value;
    }).required(),
    
    createdAt: Joi.date().iso().max('now').required(),
    
    updatedAt: Joi.date().iso().max('now').required()
}).options({ stripUnknown: true, abortEarly: false });

/**
 * Validates a single activity record with enhanced security checks and performance optimization
 * @param activityData Activity data to validate
 * @param tenantContext Current tenant context for isolation check
 * @returns Promise resolving to true if validation passes
 * @throws ValidationError with detailed context if validation fails
 */
export async function validateActivity(
    activityData: IActivity,
    tenantContext: string
): Promise<boolean> {
    try {
        // Check cache for existing validation result
        const cacheKey = JSON.stringify(activityData);
        const cachedResult = VALIDATION_CACHE.get(cacheKey);
        if (cachedResult) {
            if (cachedResult.error) {
                throw cachedResult.error;
            }
            return true;
        }

        // Tenant isolation check
        if (activityData.tenantId.toString() !== tenantContext) {
            throw new Error('Tenant isolation violation');
        }

        // Validate against schema
        const validationResult = await activitySchema.validateAsync(activityData);
        
        // Cache successful validation result
        if (VALIDATION_CACHE.size >= MAX_CACHE_SIZE) {
            const firstKey = VALIDATION_CACHE.keys().next().value;
            VALIDATION_CACHE.delete(firstKey);
        }
        VALIDATION_CACHE.set(cacheKey, validationResult);

        return true;
    } catch (error) {
        const validationError = new Error('Activity validation failed');
        (validationError as any).code = ErrorCode.VALIDATION_ERROR;
        (validationError as any).details = error;
        throw validationError;
    }
}

/**
 * Validates multiple activity records in batch with optimized performance
 * @param activityDataArray Array of activity records to validate
 * @param tenantContext Current tenant context for isolation check
 * @returns Promise resolving to true if all validations pass
 * @throws BatchValidationError with detailed contexts if any validation fails
 */
export async function validateActivityBatch(
    activityDataArray: IActivity[],
    tenantContext: string
): Promise<boolean> {
    if (!Array.isArray(activityDataArray) || activityDataArray.length === 0) {
        throw new Error('Invalid activity batch');
    }

    // Validate batch size
    const MAX_BATCH_SIZE = 100;
    if (activityDataArray.length > MAX_BATCH_SIZE) {
        throw new Error(`Batch size exceeds maximum limit of ${MAX_BATCH_SIZE}`);
    }

    // Validate all activities in parallel for performance
    const validationPromises = activityDataArray.map(activity =>
        validateActivity(activity, tenantContext)
    );

    try {
        await Promise.all(validationPromises);
        return true;
    } catch (error) {
        const batchError = new Error('Batch validation failed');
        (batchError as any).code = ErrorCode.VALIDATION_ERROR;
        (batchError as any).details = error;
        throw batchError;
    }
}