/**
 * @fileoverview Mongoose model implementation for quotes in the multi-tenant CRM system.
 * Provides comprehensive quote management with tenant isolation, lead integration,
 * and automated calculations.
 * @version 1.0.0
 */

import { model, Types, FilterQuery, PipelineStage } from 'mongoose'; // v7.0.0
import { Logger } from 'winston'; // v3.8.0
import { IQuote, IQuoteDocument } from '../../interfaces/IQuote';
import QuoteSchema from '../schemas/quoteSchema';

// Configure logger
const logger: Logger = require('../../utils/logger').getLogger('QuoteModel');

/**
 * Interface for quote search options
 */
interface QuoteSearchOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  populate?: string[];
}

/**
 * Interface for quote filter options
 */
interface QuoteFilterOptions {
  status?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
}

/**
 * Quote model with enhanced tenant isolation and calculation capabilities
 */
const Quote = model<IQuoteDocument>('Quote', QuoteSchema);

/**
 * Find quotes by tenant ID with comprehensive filtering and pagination
 */
Quote.findByTenant = async function(
  tenantId: Types.ObjectId,
  options: QuoteSearchOptions = {},
  filters: QuoteFilterOptions = {}
): Promise<IQuoteDocument[]> {
  try {
    logger.debug('Finding quotes by tenant', { tenantId, options, filters });

    // Build base query with tenant isolation
    const query: FilterQuery<IQuoteDocument> = { tenantId, isActive: true };

    // Apply status filters
    if (filters.status?.length) {
      query.status = { $in: filters.status };
    }

    // Apply date range filter
    if (filters.dateRange) {
      query.createdAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    // Apply amount range filters
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      query.total = {};
      if (filters.minAmount !== undefined) {
        query.total.$gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        query.total.$lte = filters.maxAmount;
      }
    }

    // Apply tag filters
    if (filters.tags?.length) {
      query.tags = { $all: filters.tags };
    }

    // Configure pagination
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, options.limit || 20);
    const skip = (page - 1) * limit;

    // Execute query with pagination and optional population
    const query$ = this.find(query)
      .sort(options.sort || { createdAt: -1 })
      .skip(skip)
      .limit(limit);

    if (options.populate?.length) {
      options.populate.forEach(path => query$.populate(path));
    }

    const quotes = await query$.exec();
    logger.debug('Found quotes by tenant', { count: quotes.length });

    return quotes;
  } catch (error) {
    logger.error('Error finding quotes by tenant', { error, tenantId });
    throw error;
  }
};

/**
 * Find quotes by lead ID with tenant validation
 */
Quote.findByLead = async function(
  leadId: Types.ObjectId,
  tenantId: Types.ObjectId,
  options: QuoteSearchOptions = {}
): Promise<IQuoteDocument[]> {
  try {
    logger.debug('Finding quotes by lead', { leadId, tenantId });

    // Build query with tenant isolation
    const query = {
      leadId,
      tenantId,
      isActive: true
    };

    // Configure pagination
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, options.limit || 10);
    const skip = (page - 1) * limit;

    // Execute query with optional population
    const query$ = this.find(query)
      .sort(options.sort || { createdAt: -1 })
      .skip(skip)
      .limit(limit);

    if (options.populate?.length) {
      options.populate.forEach(path => query$.populate(path));
    }

    const quotes = await query$.exec();
    logger.debug('Found quotes by lead', { count: quotes.length });

    return quotes;
  } catch (error) {
    logger.error('Error finding quotes by lead', { error, leadId, tenantId });
    throw error;
  }
};

/**
 * Calculate quote totals with comprehensive validation
 */
Quote.calculateTotals = async function(
  items: IQuote['items'],
  taxRate: number
): Promise<{
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
}> {
  try {
    logger.debug('Calculating quote totals', { itemCount: items.length, taxRate });

    // Validate inputs
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and must not be empty');
    }
    if (taxRate < 0 || taxRate > 1) {
      throw new Error('Tax rate must be between 0 and 1');
    }

    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => {
      const itemAmount = Number((item.quantity * item.unitPrice).toFixed(2));
      return sum + itemAmount;
    }, 0);

    // Calculate tax for taxable items
    const taxableAmount = items
      .filter(item => item.taxable)
      .reduce((sum, item) => {
        const itemAmount = Number((item.quantity * item.unitPrice).toFixed(2));
        return sum + itemAmount;
      }, 0);

    const tax = Number((taxableAmount * taxRate).toFixed(2));

    // Calculate total
    const total = Number((subtotal + tax).toFixed(2));

    const result = {
      subtotal,
      tax,
      total,
      itemCount: items.length
    };

    logger.debug('Calculated quote totals', result);
    return result;
  } catch (error) {
    logger.error('Error calculating quote totals', { error });
    throw error;
  }
};

export default Quote;