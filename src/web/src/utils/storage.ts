/**
 * @fileoverview Browser storage utility module for the multi-tenant CRM system
 * Implements secure, type-safe storage operations with tenant isolation
 * @version 1.0.0
 */

import { AuthTokens } from '../types/auth';
import { Tenant } from '../types/tenant';

// Storage configuration constants
const STORAGE_PREFIX = 'crm_';
const TOKEN_KEY = 'auth_tokens';
const TENANT_KEY = 'current_tenant';
const USER_PREFERENCES_KEY = 'user_preferences';
const STORAGE_VERSION = '1.0';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

/**
 * Error class for storage-related exceptions
 */
class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Interface for storage metadata
 */
interface StorageMetadata {
  version: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  encrypted?: boolean;
}

/**
 * Interface for storage item wrapper
 */
interface StorageItem<T> {
  data: T;
  metadata: StorageMetadata;
}

/**
 * Validates tenant ID format and existence
 * @param tenantId - Tenant identifier to validate
 * @throws {StorageError} If tenant ID is invalid
 */
const validateTenantId = (tenantId: string): void => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!tenantId || !uuidRegex.test(tenantId)) {
    throw new StorageError('Invalid tenant ID format');
  }
};

/**
 * Validates storage key format and characters
 * @param key - Storage key to validate
 * @throws {StorageError} If key format is invalid
 */
const validateKey = (key: string): void => {
  const keyRegex = /^[a-zA-Z0-9_-]+$/;
  if (!key || !keyRegex.test(key)) {
    throw new StorageError('Invalid storage key format');
  }
};

/**
 * Generates a tenant-specific storage key
 * @param tenantId - Tenant identifier
 * @param key - Base storage key
 * @returns Prefixed storage key with tenant isolation
 */
const getTenantStorageKey = (tenantId: string, key: string): string => {
  validateTenantId(tenantId);
  validateKey(key);
  return `${STORAGE_PREFIX}${STORAGE_VERSION}_${tenantId}_${key}`;
};

/**
 * Checks if browser storage is available
 * @throws {StorageError} If storage is not available
 */
const checkStorageAvailability = (): void => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
  } catch (error) {
    throw new StorageError('Local storage is not available');
  }
};

/**
 * Encrypts sensitive data before storage
 * @param data - Data to encrypt
 * @returns Encrypted data string
 */
const encryptSensitiveData = (data: unknown): string => {
  // Implementation would use a proper encryption library
  // This is a placeholder for the actual encryption logic
  return btoa(JSON.stringify(data));
};

/**
 * Decrypts sensitive data from storage
 * @param data - Encrypted data string
 * @returns Decrypted data
 */
const decryptSensitiveData = (data: string): unknown => {
  // Implementation would use a proper decryption library
  // This is a placeholder for the actual decryption logic
  return JSON.parse(atob(data));
};

/**
 * Checks if a value should be encrypted
 * @param key - Storage key
 * @returns Boolean indicating if encryption is needed
 */
const shouldEncrypt = (key: string): boolean => {
  const sensitiveKeys = [TOKEN_KEY, USER_PREFERENCES_KEY];
  return sensitiveKeys.includes(key);
};

/**
 * Sets an item in localStorage with tenant isolation
 * @param tenantId - Tenant identifier
 * @param key - Storage key
 * @param value - Value to store
 * @throws {StorageError} If storage operation fails
 */
export const setItem = <T>(tenantId: string, key: string, value: T): void => {
  try {
    checkStorageAvailability();
    const storageKey = getTenantStorageKey(tenantId, key);
    
    const metadata: StorageMetadata = {
      version: STORAGE_VERSION,
      tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      encrypted: shouldEncrypt(key)
    };

    const storageItem: StorageItem<T> = {
      data: value,
      metadata
    };

    const serializedData = metadata.encrypted 
      ? encryptSensitiveData(storageItem)
      : JSON.stringify(storageItem);

    if (serializedData.length > MAX_STORAGE_SIZE) {
      throw new StorageError('Storage quota exceeded');
    }

    localStorage.setItem(storageKey, serializedData);
  } catch (error) {
    throw new StorageError(
      error instanceof Error ? error.message : 'Failed to set storage item'
    );
  }
};

/**
 * Retrieves an item from localStorage with tenant isolation
 * @param tenantId - Tenant identifier
 * @param key - Storage key
 * @returns Retrieved value or null if not found
 * @throws {StorageError} If retrieval operation fails
 */
export const getItem = <T>(tenantId: string, key: string): T | null => {
  try {
    checkStorageAvailability();
    const storageKey = getTenantStorageKey(tenantId, key);
    const serializedData = localStorage.getItem(storageKey);

    if (!serializedData) {
      return null;
    }

    const storageItem: StorageItem<T> = JSON.parse(
      shouldEncrypt(key) 
        ? decryptSensitiveData(serializedData) as string
        : serializedData
    );

    if (storageItem.metadata.tenantId !== tenantId) {
      throw new StorageError('Tenant ID mismatch');
    }

    return storageItem.data;
  } catch (error) {
    throw new StorageError(
      error instanceof Error ? error.message : 'Failed to get storage item'
    );
  }
};

/**
 * Removes an item from localStorage
 * @param tenantId - Tenant identifier
 * @param key - Storage key
 * @throws {StorageError} If removal operation fails
 */
export const removeItem = (tenantId: string, key: string): void => {
  try {
    checkStorageAvailability();
    const storageKey = getTenantStorageKey(tenantId, key);
    localStorage.removeItem(storageKey);
  } catch (error) {
    throw new StorageError(
      error instanceof Error ? error.message : 'Failed to remove storage item'
    );
  }
};

/**
 * Clears all storage for a specific tenant
 * @param tenantId - Tenant identifier
 * @param preserveAuth - Whether to preserve authentication data
 * @throws {StorageError} If clear operation fails
 */
export const clearTenantStorage = (tenantId: string, preserveAuth = false): void => {
  try {
    checkStorageAvailability();
    validateTenantId(tenantId);

    const prefix = `${STORAGE_PREFIX}${STORAGE_VERSION}_${tenantId}_`;
    
    // Collect keys to remove
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        if (preserveAuth && key.includes(TOKEN_KEY)) {
          continue;
        }
        keysToRemove.push(key);
      }
    }

    // Remove collected keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    throw new StorageError(
      error instanceof Error ? error.message : 'Failed to clear tenant storage'
    );
  }
};

/**
 * Type guard to check if a value is a valid storage item
 * @param value - Value to check
 * @returns Boolean indicating if value is a valid storage item
 */
const isValidStorageItem = <T>(value: unknown): value is StorageItem<T> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'metadata' in value &&
    typeof (value as StorageItem<T>).metadata.version === 'string' &&
    typeof (value as StorageItem<T>).metadata.tenantId === 'string'
  );
};