/**
 * @fileoverview Custom React hook for managing tenant-related operations and state
 * Implements comprehensive tenant management with caching and real-time updates
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react'; // ^18.0.0
import { useDispatch } from 'react-redux'; // ^8.0.5
import { getTenantSettings, updateTenantSettings } from '../services/tenants';
import { Tenant, TenantSettings, TenantFeatures } from '../types/tenant';
import { showNotification } from '../store/slices/uiSlice';

// Cache configuration
const TENANT_CACHE_TTL = 300000; // 5 minutes
const REFRESH_THROTTLE = 2000; // 2 seconds

interface TenantState {
  tenant: TenantSettings | null;
  loading: boolean;
  error: string | null;
  isCached: boolean;
  lastUpdated: Date | null;
}

interface CacheEntry {
  data: TenantSettings;
  timestamp: number;
}

/**
 * Custom hook for managing tenant operations with caching and real-time updates
 * @returns Object containing tenant state and management functions
 */
export const useTenant = () => {
  // Initialize state
  const [state, setState] = useState<TenantState>({
    tenant: null,
    loading: false,
    error: null,
    isCached: false,
    lastUpdated: null,
  });

  // Redux dispatch for notifications
  const dispatch = useDispatch();

  // Cache reference
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const lastRefreshRef = useRef<number>(0);

  /**
   * Updates tenant settings with optimistic updates and rollback
   * @param settings - New tenant settings to apply
   */
  const updateSettings = useCallback(async (settings: TenantSettings) => {
    const previousSettings = state.tenant;
    
    try {
      // Optimistic update
      setState(prev => ({
        ...prev,
        tenant: settings,
        lastUpdated: new Date(),
      }));

      // Attempt to update on server
      const updatedSettings = await updateTenantSettings(settings.tenantId, settings);

      // Update cache
      cacheRef.current.set(settings.tenantId, {
        data: updatedSettings,
        timestamp: Date.now(),
      });

      dispatch(showNotification({
        message: 'Tenant settings updated successfully',
        severity: 'success',
      }));

    } catch (error) {
      // Rollback on failure
      setState(prev => ({
        ...prev,
        tenant: previousSettings,
        error: error instanceof Error ? error.message : 'Failed to update tenant settings',
      }));

      dispatch(showNotification({
        message: 'Failed to update tenant settings',
        severity: 'error',
      }));
    }
  }, [state.tenant, dispatch]);

  /**
   * Refreshes tenant data with throttling and cache management
   */
  const refreshTenant = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_THROTTLE) {
      return;
    }
    lastRefreshRef.current = now;

    if (!state.tenant?.tenantId) {
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Check cache first
      const cached = cacheRef.current.get(state.tenant!.tenantId);
      if (cached && (now - cached.timestamp) < TENANT_CACHE_TTL) {
        setState(prev => ({
          ...prev,
          tenant: cached.data,
          loading: false,
          isCached: true,
          lastUpdated: new Date(cached.timestamp),
        }));
        return;
      }

      // Fetch fresh data
      const freshSettings = await getTenantSettings(state.tenant!.tenantId);
      
      // Update cache and state
      cacheRef.current.set(state.tenant!.tenantId, {
        data: freshSettings,
        timestamp: now,
      });

      setState(prev => ({
        ...prev,
        tenant: freshSettings,
        loading: false,
        isCached: false,
        lastUpdated: new Date(),
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh tenant settings',
      }));
    }
  }, [state.tenant?.tenantId]);

  /**
   * Checks if a specific feature is enabled for the tenant
   * @param featureName - Name of the feature to check
   * @returns Boolean indicating if feature is enabled
   */
  const hasFeature = useCallback((featureName: keyof TenantFeatures): boolean => {
    return Boolean(state.tenant?.features?.[featureName]);
  }, [state.tenant?.features]);

  // Setup automatic cache invalidation
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      cacheRef.current.forEach((entry, key) => {
        if (now - entry.timestamp > TENANT_CACHE_TTL) {
          cacheRef.current.delete(key);
        }
      });
    };

    const interval = setInterval(cleanup, TENANT_CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  // Setup error recovery mechanism
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, error: null }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  return {
    tenant: state.tenant,
    loading: state.loading,
    error: state.error,
    updateSettings,
    refreshTenant,
    hasFeature,
    isCached: state.isCached,
    lastUpdated: state.lastUpdated,
  };
};