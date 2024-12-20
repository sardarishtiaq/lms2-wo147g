/**
 * @fileoverview Lead management service for the multi-tenant CRM frontend application
 * Implements comprehensive lead operations with tenant isolation and validation
 * @version 1.0.0
 */

import { AxiosResponse } from 'axios'; // ^1.4.0
import { apiClient } from '../utils/api';
import { LEAD_ENDPOINTS } from '../constants/apiEndpoints';
import { validateLeadData } from '../utils/validation';
import { Lead, LeadFilters, LeadFormData } from '../types/lead';
import { LeadCategory } from '../constants/leadCategories';

// Service configuration constants
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const RETRY_ATTEMPTS = 3;
const REQUEST_TIMEOUT = 5000;

/**
 * Interface for pagination parameters
 */
interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for lead service response with pagination
 */
interface LeadServiceResponse<T> {
  data: T;
  total: number;
  page: number;
  limit: number;
}

/**
 * Lead service class implementing comprehensive lead management functionality
 * with tenant isolation and error handling
 */
export class LeadService {
  /**
   * Fetches a paginated list of leads with filtering options
   * @param filters - Lead filtering criteria
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated lead data
   */
  public static async fetchLeads(
    filters: Partial<LeadFilters>,
    pagination: PaginationParams
  ): Promise<LeadServiceResponse<Lead[]>> {
    try {
      const params = {
        ...filters,
        page: pagination.page,
        limit: Math.min(pagination.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder
      };

      const response = await apiClient.get<LeadServiceResponse<Lead[]>>(
        LEAD_ENDPOINTS.GET_ALL,
        { params, timeout: REQUEST_TIMEOUT }
      );

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieves a single lead by ID
   * @param leadId - Unique identifier of the lead
   * @returns Promise resolving to lead data
   */
  public static async fetchLeadById(leadId: string): Promise<Lead> {
    try {
      const response = await apiClient.get<Lead>(
        LEAD_ENDPOINTS.GET_BY_ID.replace(':id', leadId)
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Creates a new lead with validation
   * @param leadData - Lead creation data
   * @returns Promise resolving to created lead
   */
  public static async createLead(leadData: LeadFormData): Promise<Lead> {
    try {
      await validateLeadData(leadData);
      const response = await apiClient.post<Lead>(
        LEAD_ENDPOINTS.CREATE,
        leadData
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Updates an existing lead
   * @param leadId - Lead identifier
   * @param leadData - Updated lead data
   * @returns Promise resolving to updated lead
   */
  public static async updateLead(
    leadId: string,
    leadData: Partial<LeadFormData>
  ): Promise<Lead> {
    try {
      await validateLeadData(leadData, true);
      const response = await apiClient.put<Lead>(
        LEAD_ENDPOINTS.UPDATE.replace(':id', leadId),
        leadData
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Updates lead category in the pipeline
   * @param leadId - Lead identifier
   * @param category - New category
   * @returns Promise resolving to updated lead
   */
  public static async updateLeadCategory(
    leadId: string,
    category: LeadCategory
  ): Promise<Lead> {
    try {
      const response = await apiClient.patch<Lead>(
        LEAD_ENDPOINTS.UPDATE_CATEGORY.replace(':id', leadId),
        { category }
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Deletes a lead by ID
   * @param leadId - Lead identifier
   * @returns Promise resolving to void
   */
  public static async deleteLead(leadId: string): Promise<void> {
    try {
      await apiClient.delete(LEAD_ENDPOINTS.DELETE.replace(':id', leadId));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Assigns a lead to an agent
   * @param leadId - Lead identifier
   * @param agentId - Agent identifier
   * @returns Promise resolving to updated lead
   */
  public static async assignLead(
    leadId: string,
    agentId: string
  ): Promise<Lead> {
    try {
      const response = await apiClient.post<Lead>(
        LEAD_ENDPOINTS.ASSIGN.replace(':id', leadId),
        { agentId }
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Bulk updates multiple leads
   * @param leads - Array of leads to update
   * @returns Promise resolving to updated leads
   */
  public static async bulkUpdateLeads(
    leads: Array<{ id: string; data: Partial<LeadFormData> }>
  ): Promise<Lead[]> {
    try {
      const response = await apiClient.post<Lead[]>(
        LEAD_ENDPOINTS.BULK_UPDATE,
        { leads }
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handles service errors and transforms them into user-friendly format
   * @param error - Error object
   * @returns Transformed error
   */
  private static handleError(error: unknown): Error {
    if (error instanceof Error) {
      // Add additional context or transform error if needed
      return error;
    }
    return new Error('An unexpected error occurred in the lead service');
  }
}

export default LeadService;