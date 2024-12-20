/**
 * @fileoverview Tenant service module for managing tenant-related operations
 * Implements comprehensive tenant settings management with caching and security
 * @version 1.0.0
 */

import { AxiosResponse } from 'axios'; // ^1.4.0
import cache from 'memory-cache'; // ^0.2.0
import { apiClient } from '../utils/api';
import { TENANT_ENDPOINTS } from '../constants/apiEndpoints';
import { TenantTypes } from '../types/tenant';

// Cache configuration constants
const TENANT_SETTINGS_CACHE_TTL = 300000; // 5 minutes
const TENANT_SETTINGS_VERSION = '1.0';
const MAX_SETTINGS_SIZE = 1048576; // 1MB

/**
 * Custom error class for tenant service operations
 */
class TenantServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public tenantId: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TenantServiceError';
    this.timestamp = new Date();
  }

  public timestamp: Date;
}

/**
 * Validates tenant settings structure and constraints
 * @param settings - Tenant settings to validate
 * @throws {TenantServiceError} If validation fails
 */
const validateSettings = (settings: TenantTypes.TenantSettings): void => {
  if (!settings) {
    throw new TenantServiceError(
      'Invalid settings object',
      'INVALID_SETTINGS',
      settings?.tenantId || ''
    );
  }

  // Validate size constraints
  const settingsSize = new TextEncoder().encode(JSON.stringify(settings)).length;
  if (settingsSize > MAX_SETTINGS_SIZE) {
    throw new TenantServiceError(
      'Settings size exceeds maximum allowed',
      'SETTINGS_TOO_LARGE',
      settings.tenantId,
      { size: settingsSize, maxSize: MAX_SETTINGS_SIZE }
    );
  }

  // Validate required fields
  const requiredFields = ['leadCategories', 'maxUsers', 'maxLeads', 'features'];
  for (const field of requiredFields) {
    if (!(field in settings)) {
      throw new TenantServiceError(
        `Missing required field: ${field}`,
        'MISSING_REQUIRED_FIELD',
        settings.tenantId,
        { field }
      );
    }
  }
}

/**
 * Generates cache key for tenant settings
 * @param tenantId - Tenant identifier
 * @returns Formatted cache key
 */
const getTenantCacheKey = (tenantId: string): string => {
  return `tenant_settings_${TENANT_SETTINGS_VERSION}_${tenantId}`;
};

/**
 * Retrieves tenant settings with caching support
 * @param tenantId - Tenant identifier
 * @param bypassCache - Optional flag to bypass cache
 * @returns Promise resolving to tenant settings
 * @throws {TenantServiceError} If retrieval fails
 */
export const getTenantSettings = async (
  tenantId: string,
  bypassCache = false
): Promise<TenantTypes.TenantSettings> => {
  try {
    if (!tenantId) {
      throw new TenantServiceError(
        'Tenant ID is required',
        'MISSING_TENANT_ID',
        ''
      );
    }

    // Check cache first unless bypassed
    const cacheKey = getTenantCacheKey(tenantId);
    if (!bypassCache) {
      const cachedSettings = cache.get(cacheKey);
      if (cachedSettings) {
        return cachedSettings as TenantTypes.TenantSettings;
      }
    }

    // Fetch fresh settings
    const settings = await apiClient.get<TenantTypes.TenantSettings>(
      TENANT_ENDPOINTS.GET_SETTINGS
    );

    // Validate settings before caching
    validateSettings(settings);

    // Cache the settings
    cache.put(cacheKey, settings, TENANT_SETTINGS_CACHE_TTL);

    return settings;
  } catch (error) {
    if (error instanceof TenantServiceError) {
      throw error;
    }
    throw new TenantServiceError(
      'Failed to retrieve tenant settings',
      'RETRIEVAL_ERROR',
      tenantId,
      { originalError: error }
    );
  }
};

/**
 * Updates tenant settings with validation
 * @param tenantId - Tenant identifier
 * @param settings - New tenant settings
 * @returns Promise resolving to updated settings
 * @throws {TenantServiceError} If update fails
 */
export const updateTenantSettings = async (
  tenantId: string,
  settings: TenantTypes.TenantSettings
): Promise<TenantTypes.TenantSettings> => {
  try {
    if (!tenantId) {
      throw new TenantServiceError(
        'Tenant ID is required',
        'MISSING_TENANT_ID',
        ''
      );
    }

    // Validate settings before update
    validateSettings(settings);

    // Update settings
    const updatedSettings = await apiClient.put<TenantTypes.TenantSettings>(
      TENANT_ENDPOINTS.UPDATE_SETTINGS,
      settings
    );

    // Clear cache to force fresh fetch
    cache.del(getTenantCacheKey(tenantId));

    return updatedSettings;
  } catch (error) {
    if (error instanceof TenantServiceError) {
      throw error;
    }
    throw new TenantServiceError(
      'Failed to update tenant settings',
      'UPDATE_ERROR',
      tenantId,
      { originalError: error }
    );
  }
};

/**
 * Validates tenant settings without updating
 * @param tenantId - Tenant identifier
 * @param settings - Settings to validate
 * @returns Promise resolving to validation result
 * @throws {TenantServiceError} If validation fails
 */
export const validateTenantSettings = async (
  tenantId: string,
  settings: TenantTypes.TenantSettings
): Promise<boolean> => {
  try {
    if (!tenantId) {
      throw new TenantServiceError(
        'Tenant ID is required',
        'MISSING_TENANT_ID',
        ''
      );
    }

    // Local validation
    validateSettings(settings);

    // Server-side validation
    await apiClient.post(TENANT_ENDPOINTS.VALIDATE_SETTINGS, settings);

    return true;
  } catch (error) {
    if (error instanceof TenantServiceError) {
      throw error;
    }
    throw new TenantServiceError(
      'Settings validation failed',
      'VALIDATION_ERROR',
      tenantId,
      { originalError: error }
    );
  }
};