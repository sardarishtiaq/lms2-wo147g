/**
 * @fileoverview Custom React hook for managing lead operations in the multi-tenant CRM system
 * Implements comprehensive lead management with tenant isolation, real-time updates, and optimistic updates
 * @version 1.0.0
 */

import { useState, useCallback } from 'react'; // ^18.0.0
import { useWebSocket } from 'react-use-websocket'; // ^3.0.0
import { useDispatch } from '../store';
import { Lead, LeadFilters } from '../types/lead';
import { LeadCategory } from '../constants/leadCategories';
import { leadActions } from '../store/slices/leadSlice';
import { LeadService } from '../services/leads';
import { WEBSOCKET_EVENTS } from '../services/websocket';

// Constants for retry logic and error handling
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

/**
 * Interface for hook state management
 */
interface UseLeadsState {
  loading: boolean;
  error: Error | null;
  retryCount: number;
  optimisticUpdates: Map<string, Lead>;
}

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Custom hook for managing leads with comprehensive error handling and real-time updates
 */
export const useLeads = (tenantId: string) => {
  const dispatch = useDispatch();
  const [state, setState] = useState<UseLeadsState>({
    loading: false,
    error: null,
    retryCount: 0,
    optimisticUpdates: new Map()
  });

  // WebSocket connection for real-time updates
  const { sendMessage } = useWebSocket(process.env.REACT_APP_WS_URL || '', {
    shouldReconnect: true,
    reconnectAttempts: 5,
    reconnectInterval: 3000,
    share: true,
    queryParams: { tenantId }
  });

  /**
   * Fetches leads with filtering, sorting, and pagination
   */
  const fetchLeads = useCallback(async (
    filters: LeadFilters,
    pagination: PaginationOptions
  ): Promise<Lead[]> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const leads = await LeadService.fetchLeads(filters, pagination);
      setState(prev => ({ ...prev, loading: false }));
      return leads;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
      throw error;
    }
  }, []);

  /**
   * Creates a new lead with optimistic update
   */
  const createLead = useCallback(async (leadData: Partial<Lead>): Promise<Lead> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Create temporary ID for optimistic update
      const tempId = `temp_${Date.now()}`;
      const optimisticLead = {
        ...leadData,
        id: tempId,
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Lead;

      // Apply optimistic update
      setState(prev => ({
        ...prev,
        optimisticUpdates: new Map(prev.optimisticUpdates).set(tempId, optimisticLead)
      }));

      // Create lead on server
      const createdLead = await LeadService.createLead(leadData);

      // Remove optimistic update
      setState(prev => {
        const updates = new Map(prev.optimisticUpdates);
        updates.delete(tempId);
        return { ...prev, loading: false, optimisticUpdates: updates };
      });

      // Notify other clients via WebSocket
      sendMessage(JSON.stringify({
        event: WEBSOCKET_EVENTS.LEAD_UPDATED,
        data: createdLead,
        tenantId
      }));

      return createdLead;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
      throw error;
    }
  }, [tenantId, sendMessage]);

  /**
   * Updates lead category with optimistic update and WebSocket notification
   */
  const updateLeadCategory = useCallback(async (
    leadId: string,
    category: LeadCategory
  ): Promise<Lead> => {
    try {
      // Apply optimistic update
      dispatch(leadActions.setOptimisticUpdate({ leadId, category }));

      const updatedLead = await LeadService.updateLeadCategory(leadId, category);

      // Notify other clients via WebSocket
      sendMessage(JSON.stringify({
        event: WEBSOCKET_EVENTS.LEAD_UPDATED,
        data: updatedLead,
        tenantId
      }));

      return updatedLead;
    } catch (error) {
      // Revert optimistic update on error
      dispatch(leadActions.setOptimisticUpdate({ leadId, category: null }));
      throw error;
    }
  }, [dispatch, tenantId, sendMessage]);

  /**
   * Retries a failed operation with exponential backoff
   */
  const retryOperation = useCallback(async (
    operation: () => Promise<any>
  ): Promise<any> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const result = await operation();
      setState(prev => ({ ...prev, loading: false, retryCount: 0 }));
      return result;
    } catch (error) {
      if (state.retryCount < MAX_RETRY_ATTEMPTS) {
        setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
        await new Promise(resolve => 
          setTimeout(resolve, RETRY_DELAY * Math.pow(2, state.retryCount))
        );
        return retryOperation(operation);
      }
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
      throw error;
    }
  }, [state.retryCount]);

  return {
    // State
    loading: state.loading,
    error: state.error,
    retryCount: state.retryCount,
    optimisticUpdates: state.optimisticUpdates,

    // Operations
    fetchLeads,
    createLead,
    updateLeadCategory,
    retryOperation,

    // Utilities
    clearError: () => setState(prev => ({ ...prev, error: null })),
    resetRetryCount: () => setState(prev => ({ ...prev, retryCount: 0 }))
  };
};

export default useLeads;