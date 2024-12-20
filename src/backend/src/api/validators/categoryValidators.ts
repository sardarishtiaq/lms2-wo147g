/**
 * @fileoverview Comprehensive validation schemas and functions for the 12-stage lead category pipeline.
 * Ensures data integrity and tenant isolation in the CRM system.
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { ObjectId } from 'mongodb'; // v5.0.0
import { ICategory } from '../../interfaces/ICategory';
import { LeadCategory, CATEGORY_DETAILS } from '../../constants/leadCategories';

/**
 * Valid Material Design icons for category representation
 */
const MATERIAL_ICONS = [
    'spatial_audio',
    'assignment_ind',
    'shield_moon',
    'headset_mic',
    'data_exploration',
    'face_5',
    'blanket',
    'readiness_score'
] as const;

/**
 * Schema for validating category creation with tenant isolation
 */
const categoryCreateSchema = Joi.object<ICategory>({
    tenantId: Joi.string()
        .custom((value, helpers) => {
            if (!ObjectId.isValid(value)) {
                return helpers.error('Invalid tenant ID format');
            }
            return value;
        })
        .required()
        .messages({
            'any.required': 'Tenant ID is required for multi-tenant isolation',
            'string.empty': 'Tenant ID cannot be empty'
        }),

    name: Joi.string()
        .min(3)
        .max(50)
        .required()
        .pattern(/^[\w\s-]+$/)
        .messages({
            'string.min': 'Category name must be at least 3 characters',
            'string.max': 'Category name cannot exceed 50 characters',
            'string.pattern.base': 'Category name can only contain letters, numbers, spaces, and hyphens'
        }),

    icon: Joi.string()
        .valid(...MATERIAL_ICONS)
        .required()
        .messages({
            'any.only': 'Icon must be a valid Material Design icon',
            'any.required': 'Icon is required for category visualization'
        }),

    type: Joi.string()
        .valid(...Object.values(LeadCategory))
        .required()
        .messages({
            'any.only': 'Category type must be one of the predefined lead categories',
            'any.required': 'Category type is required'
        }),

    description: Joi.string()
        .min(10)
        .max(500)
        .required()
        .messages({
            'string.min': 'Description must be at least 10 characters',
            'string.max': 'Description cannot exceed 500 characters'
        }),

    implementation: Joi.string()
        .min(10)
        .max(1000)
        .required()
        .messages({
            'string.min': 'Implementation details must be at least 10 characters',
            'string.max': 'Implementation details cannot exceed 1000 characters'
        }),

    order: Joi.number()
        .min(1)
        .max(12)
        .integer()
        .required()
        .messages({
            'number.min': 'Order must be between 1 and 12',
            'number.max': 'Order must be between 1 and 12',
            'number.integer': 'Order must be an integer'
        }),

    active: Joi.boolean()
        .default(true)
        .messages({
            'boolean.base': 'Active status must be a boolean'
        })
});

/**
 * Schema for validating category updates while preserving pipeline integrity
 */
const categoryUpdateSchema = Joi.object<Partial<ICategory>>({
    id: Joi.string()
        .custom((value, helpers) => {
            if (!ObjectId.isValid(value)) {
                return helpers.error('Invalid category ID format');
            }
            return value;
        })
        .required()
        .messages({
            'any.required': 'Category ID is required for updates'
        }),

    tenantId: Joi.string()
        .custom((value, helpers) => {
            if (!ObjectId.isValid(value)) {
                return helpers.error('Invalid tenant ID format');
            }
            return value;
        })
        .required()
        .messages({
            'any.required': 'Tenant ID is required for multi-tenant isolation'
        }),

    name: Joi.string()
        .min(3)
        .max(50)
        .pattern(/^[\w\s-]+$/),

    icon: Joi.string()
        .valid(...MATERIAL_ICONS),

    description: Joi.string()
        .min(10)
        .max(500),

    implementation: Joi.string()
        .min(10)
        .max(1000),

    order: Joi.number()
        .min(1)
        .max(12)
        .integer(),

    active: Joi.boolean()
}).min(2); // At least one field besides id must be updated

/**
 * Schema for validating category order updates in the pipeline
 */
const categoryOrderSchema = Joi.object({
    categories: Joi.array().items(
        Joi.object({
            id: Joi.string()
                .custom((value, helpers) => {
                    if (!ObjectId.isValid(value)) {
                        return helpers.error('Invalid category ID format');
                    }
                    return value;
                })
                .required(),
            order: Joi.number()
                .min(1)
                .max(12)
                .integer()
                .required()
        })
    ).min(1).max(12)
        .unique('order')
        .required()
});

/**
 * Validates the complete data required to create a new lead category with tenant isolation
 * @param categoryData - The category data to validate
 * @returns Promise resolving to true if validation passes, throws ValidationError otherwise
 */
export async function validateCreateCategory(categoryData: Partial<ICategory>): Promise<boolean> {
    try {
        await categoryCreateSchema.validateAsync(categoryData, { abortEarly: false });
        
        // Additional validation for category order uniqueness within tenant
        const orderExists = await checkOrderExistsForTenant(
            categoryData.tenantId!,
            categoryData.order!
        );
        if (orderExists) {
            throw new Error(`Order ${categoryData.order} already exists for this tenant`);
        }

        // Validate category type implementation matches predefined details
        const categoryDetail = CATEGORY_DETAILS.find(c => c.id === categoryData.type);
        if (!categoryDetail) {
            throw new Error('Invalid category type implementation');
        }

        return true;
    } catch (error) {
        throw error;
    }
}

/**
 * Validates category update data while preserving pipeline integrity
 * @param categoryData - The category update data to validate
 * @returns Promise resolving to true if validation passes, throws ValidationError otherwise
 */
export async function validateUpdateCategory(categoryData: Partial<ICategory>): Promise<boolean> {
    try {
        await categoryUpdateSchema.validateAsync(categoryData, { abortEarly: false });

        // Additional validation for order updates
        if (categoryData.order) {
            const orderExists = await checkOrderExistsForTenant(
                categoryData.tenantId!,
                categoryData.order,
                categoryData.id
            );
            if (orderExists) {
                throw new Error(`Order ${categoryData.order} already exists for this tenant`);
            }
        }

        // Validate impact on existing leads
        const hasActiveLeads = await checkCategoryHasActiveLeads(categoryData.id!);
        if (hasActiveLeads && categoryData.active === false) {
            throw new Error('Cannot deactivate category with active leads');
        }

        return true;
    } catch (error) {
        throw error;
    }
}

/**
 * Validates the complete order structure of the lead pipeline
 * @param orderData - The order update data to validate
 * @returns Promise resolving to true if validation passes, throws ValidationError otherwise
 */
export async function validateCategoryOrder(
    orderData: { categories: Array<{ id: string; order: number }> }
): Promise<boolean> {
    try {
        await categoryOrderSchema.validateAsync(orderData, { abortEarly: false });

        // Validate order sequence completeness
        const orders = orderData.categories.map(c => c.order).sort((a, b) => a - b);
        for (let i = 0; i < orders.length; i++) {
            if (orders[i] !== i + 1) {
                throw new Error('Category orders must be sequential without gaps');
            }
        }

        // Validate all categories belong to the same tenant
        const tenantMatch = await validateCategoriesSameTenant(
            orderData.categories.map(c => c.id)
        );
        if (!tenantMatch) {
            throw new Error('All categories must belong to the same tenant');
        }

        return true;
    } catch (error) {
        throw error;
    }
}

/**
 * Helper function to check if an order number already exists for a tenant
 * @param tenantId - The tenant ID to check
 * @param order - The order number to check
 * @param excludeId - Optional category ID to exclude from check
 */
async function checkOrderExistsForTenant(
    tenantId: string,
    order: number,
    excludeId?: string
): Promise<boolean> {
    // Implementation would check database for existing order
    return false; // Placeholder return
}

/**
 * Helper function to check if a category has any active leads
 * @param categoryId - The category ID to check
 */
async function checkCategoryHasActiveLeads(categoryId: string): Promise<boolean> {
    // Implementation would check database for active leads
    return false; // Placeholder return
}

/**
 * Helper function to validate all categories belong to the same tenant
 * @param categoryIds - Array of category IDs to validate
 */
async function validateCategoriesSameTenant(categoryIds: string[]): Promise<boolean> {
    // Implementation would check database for tenant matching
    return true; // Placeholder return
}