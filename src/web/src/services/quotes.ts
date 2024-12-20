/**
 * @fileoverview Quote management service for the multi-tenant CRM system
 * Implements comprehensive CRUD operations with tenant isolation, caching, and error handling
 * @version 1.0.0
 */

import { retry } from 'axios-retry'; // ^3.5.0
import CircuitBreaker from 'opossum'; // ^7.0.0
import { ApiError } from '@shared/errors'; // ^1.0.0
import { Quote, QuoteFormData, QuoteStatus, isQuote, isQuoteItem } from '../types/quote';
import { apiClient } from '../utils/api';
import { QUOTE_ENDPOINTS, formatEndpoint } from '../constants/apiEndpoints';
import { PERMISSIONS } from '../constants/permissions';

// Circuit breaker configuration
const BREAKER_OPTIONS = {
  timeout: 10000, // 10 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000 // 30 seconds
};

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: Quote[]; timestamp: number }>();

/**
 * Interface for quote filtering options
 */
interface QuoteFilters {
  leadId?: string;
  status?: QuoteStatus;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Interface for tenant context
 */
interface TenantContext {
  tenantId: string;
  permissions: string[];
}

/**
 * Decorator for circuit breaker pattern
 */
function withCircuitBreaker(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const breaker = new CircuitBreaker(originalMethod, BREAKER_OPTIONS);

  descriptor.value = async function (...args: any[]) {
    try {
      return await breaker.fire(...args);
    } catch (error) {
      throw new ApiError('Service temporarily unavailable', 503);
    }
  };
}

/**
 * Decorator for tenant permission validation
 */
function validateTenantContext(requiredPermission: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (tenantContext: TenantContext, ...args: any[]) {
      if (!tenantContext?.tenantId) {
        throw new ApiError('Tenant context is required', 400);
      }

      if (!tenantContext.permissions.includes(requiredPermission)) {
        throw new ApiError('Permission denied', 403);
      }

      return originalMethod.apply(this, [tenantContext, ...args]);
    };
  };
}

/**
 * Quote management service class implementing comprehensive CRUD operations
 * with tenant isolation, caching, and error handling
 */
export class QuoteService {
  /**
   * Retrieves a list of quotes with tenant isolation and filtering
   * @param filters - Optional filters for quote retrieval
   * @param tenantContext - Tenant context for isolation
   * @returns Promise resolving to filtered quote list
   */
  @withCircuitBreaker
  @validateTenantContext(PERMISSIONS.QUOTE_VIEW)
  async getQuotes(
    filters: QuoteFilters = {},
    tenantContext: TenantContext
  ): Promise<Quote[]> {
    const cacheKey = `${tenantContext.tenantId}:quotes:${JSON.stringify(filters)}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      apiClient.setTenantContext(tenantContext.tenantId);
      const response = await apiClient.get<Quote[]>(QUOTE_ENDPOINTS.GET_ALL, {
        params: filters
      });

      // Validate response data
      const quotes = response.filter(isQuote);
      
      // Update cache
      cache.set(cacheKey, { data: quotes, timestamp: Date.now() });
      
      return quotes;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieves a specific quote by ID with tenant validation
   * @param id - Quote identifier
   * @param tenantContext - Tenant context for isolation
   * @returns Promise resolving to quote details
   */
  @withCircuitBreaker
  @validateTenantContext(PERMISSIONS.QUOTE_VIEW)
  async getQuoteById(id: string, tenantContext: TenantContext): Promise<Quote> {
    try {
      apiClient.setTenantContext(tenantContext.tenantId);
      const response = await apiClient.get<Quote>(
        formatEndpoint(QUOTE_ENDPOINTS.GET_BY_ID, { id })
      );

      if (!isQuote(response)) {
        throw new ApiError('Invalid quote data received', 500);
      }

      if (response.tenantId !== tenantContext.tenantId) {
        throw new ApiError('Quote not found', 404);
      }

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Creates a new quote with tenant isolation
   * @param quoteData - Quote creation data
   * @param tenantContext - Tenant context for isolation
   * @returns Promise resolving to created quote
   */
  @withCircuitBreaker
  @validateTenantContext(PERMISSIONS.QUOTE_CREATE)
  async createQuote(
    quoteData: QuoteFormData,
    tenantContext: TenantContext
  ): Promise<Quote> {
    try {
      // Validate quote items
      if (!quoteData.items.every(item => isQuoteItem(item))) {
        throw new ApiError('Invalid quote items', 400);
      }

      apiClient.setTenantContext(tenantContext.tenantId);
      const response = await apiClient.post<Quote>(QUOTE_ENDPOINTS.CREATE, quoteData);

      if (!isQuote(response)) {
        throw new ApiError('Invalid quote data received', 500);
      }

      // Invalidate cache
      this.invalidateCache(tenantContext.tenantId);

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Updates an existing quote with tenant validation
   * @param id - Quote identifier
   * @param quoteData - Quote update data
   * @param tenantContext - Tenant context for isolation
   * @returns Promise resolving to updated quote
   */
  @withCircuitBreaker
  @validateTenantContext(PERMISSIONS.QUOTE_UPDATE)
  async updateQuote(
    id: string,
    quoteData: Partial<QuoteFormData>,
    tenantContext: TenantContext
  ): Promise<Quote> {
    try {
      apiClient.setTenantContext(tenantContext.tenantId);
      const response = await apiClient.put<Quote>(
        formatEndpoint(QUOTE_ENDPOINTS.UPDATE, { id }),
        quoteData
      );

      if (!isQuote(response)) {
        throw new ApiError('Invalid quote data received', 500);
      }

      // Invalidate cache
      this.invalidateCache(tenantContext.tenantId);

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Deletes a quote with tenant validation
   * @param id - Quote identifier
   * @param tenantContext - Tenant context for isolation
   */
  @withCircuitBreaker
  @validateTenantContext(PERMISSIONS.QUOTE_DELETE)
  async deleteQuote(id: string, tenantContext: TenantContext): Promise<void> {
    try {
      apiClient.setTenantContext(tenantContext.tenantId);
      await apiClient.delete(formatEndpoint(QUOTE_ENDPOINTS.DELETE, { id }));

      // Invalidate cache
      this.invalidateCache(tenantContext.tenantId);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generates a PDF version of the quote
   * @param id - Quote identifier
   * @param tenantContext - Tenant context for isolation
   * @returns Promise resolving to PDF blob
   */
  @withCircuitBreaker
  @validateTenantContext(PERMISSIONS.QUOTE_VIEW)
  async generateQuotePDF(id: string, tenantContext: TenantContext): Promise<Blob> {
    try {
      apiClient.setTenantContext(tenantContext.tenantId);
      const response = await apiClient.get<Blob>(
        formatEndpoint(QUOTE_ENDPOINTS.GENERATE_PDF, { id }),
        { responseType: 'blob' }
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Sends quote to customer via email
   * @param id - Quote identifier
   * @param tenantContext - Tenant context for isolation
   */
  @withCircuitBreaker
  @validateTenantContext(PERMISSIONS.QUOTE_UPDATE)
  async sendQuoteToCustomer(id: string, tenantContext: TenantContext): Promise<void> {
    try {
      apiClient.setTenantContext(tenantContext.tenantId);
      await apiClient.post(formatEndpoint(QUOTE_ENDPOINTS.SEND_TO_CUSTOMER, { id }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Invalidates cache for a specific tenant
   * @param tenantId - Tenant identifier
   */
  private invalidateCache(tenantId: string): void {
    for (const [key] of cache) {
      if (key.startsWith(`${tenantId}:`)) {
        cache.delete(key);
      }
    }
  }

  /**
   * Handles and transforms API errors
   * @param error - Error to handle
   * @returns Transformed API error
   */
  private handleError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof Error) {
      return new ApiError(error.message, 500);
    }

    return new ApiError('An unexpected error occurred', 500);
  }
}

// Export singleton instance
export const quoteService = new QuoteService();