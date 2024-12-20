/**
 * Encryption Utility Module
 * Version: 1.0.0
 * 
 * Provides secure encryption and hashing functions for the multi-tenant CRM system
 * with support for field-level encryption, key rotation, and HSM integration.
 */

import crypto from 'crypto'; // Node.js crypto module
import bcrypt from 'bcrypt'; // ^5.1.0
import forge from 'node-forge'; // ^1.3.1
import { authConfig } from '../config/auth.config';
import { logger } from './logger';

// Global constants
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || generateEncryptionKey();
const SALT_ROUNDS = authConfig.password.saltRounds || 10;
const KEY_ROTATION_INTERVAL = authConfig.encryption.keyRotationInterval || 30 * 24 * 60 * 60 * 1000; // 30 days
const HSM_ENABLED = process.env.HSM_ENABLED === 'true';

// Encryption key store with tenant isolation
const keyStore = new Map<string, { key: string; version: number; createdAt: Date }>();

/**
 * Interface for encrypted data structure
 */
interface EncryptedData {
  iv: string;
  tag: string;
  ciphertext: string;
  version: number;
}

/**
 * Generates a secure encryption key with optional HSM support
 * @param tenantId - Tenant identifier for isolation
 * @returns Promise<string> Base64 encoded encryption key
 */
async function generateEncryptionKey(tenantId?: string): Promise<string> {
  try {
    let key: Buffer;

    if (HSM_ENABLED) {
      // Generate key using HSM if enabled
      const hsm = forge.pkcs11.createModule({
        library: process.env.HSM_LIBRARY_PATH,
        name: 'CRM-HSM'
      });
      const session = await hsm.getSession();
      key = await session.generateKey({
        algorithm: 'AES-256-GCM',
        extractable: false,
        keyUsages: ['encrypt', 'decrypt']
      });
    } else {
      // Generate key using crypto module
      key = crypto.randomBytes(32);
    }

    const encodedKey = key.toString('base64');

    // Store key with tenant association if provided
    if (tenantId) {
      keyStore.set(tenantId, {
        key: encodedKey,
        version: 1,
        createdAt: new Date()
      });
    }

    logger.audit('Encryption key generated', {
      tenantId,
      keyVersion: 1,
      hsmEnabled: HSM_ENABLED
    });

    return encodedKey;
  } catch (error) {
    logger.error('Failed to generate encryption key', {
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error('Encryption key generation failed');
  }
}

/**
 * Encrypts data using AES-256-GCM with tenant isolation
 * @param data - Data to encrypt
 * @param tenantId - Tenant identifier
 * @returns Promise<EncryptedData> Encrypted data object
 */
async function encrypt(data: string, tenantId: string): Promise<EncryptedData> {
  try {
    // Input validation
    if (!data) {
      throw new Error('Data is required for encryption');
    }

    // Get tenant-specific key or generate new one
    let keyData = keyStore.get(tenantId);
    if (!keyData) {
      const newKey = await generateEncryptionKey(tenantId);
      keyData = {
        key: newKey,
        version: 1,
        createdAt: new Date()
      };
      keyStore.set(tenantId, keyData);
    }

    // Generate random IV
    const iv = crypto.randomBytes(12);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(keyData.key, 'base64'),
      iv
    );

    // Encrypt data
    let ciphertext = cipher.update(data, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Clean up sensitive data from memory
    cipher.end();

    const encryptedData: EncryptedData = {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext,
      version: keyData.version
    };

    logger.audit('Data encrypted', {
      tenantId,
      keyVersion: keyData.version
    });

    return encryptedData;
  } catch (error) {
    logger.error('Encryption failed', {
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts data encrypted with AES-256-GCM using tenant-specific key
 * @param encryptedData - Encrypted data object
 * @param tenantId - Tenant identifier
 * @returns Promise<string> Decrypted data
 */
async function decrypt(encryptedData: EncryptedData, tenantId: string): Promise<string> {
  try {
    // Input validation
    if (!encryptedData || !encryptedData.iv || !encryptedData.tag || !encryptedData.ciphertext) {
      throw new Error('Invalid encrypted data format');
    }

    // Get tenant-specific key
    const keyData = keyStore.get(tenantId);
    if (!keyData) {
      throw new Error('Encryption key not found for tenant');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(keyData.key, 'base64'),
      Buffer.from(encryptedData.iv, 'base64')
    );

    // Set auth tag
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'base64'));

    // Decrypt data
    let decrypted = decipher.update(encryptedData.ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    // Clean up
    decipher.end();

    logger.audit('Data decrypted', {
      tenantId,
      keyVersion: keyData.version
    });

    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', {
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error('Decryption failed');
  }
}

/**
 * Hashes password using bcrypt with configurable salt rounds
 * @param password - Password to hash
 * @returns Promise<string> Hashed password
 */
async function hashPassword(password: string): Promise<string> {
  try {
    // Validate password against policy
    if (!password || password.length < authConfig.passwordPolicy.minLength) {
      throw new Error('Invalid password');
    }

    // Generate salt and hash
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);

    // Clean up password from memory
    password = '';

    return hash;
  } catch (error) {
    logger.error('Password hashing failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error('Password hashing failed');
  }
}

/**
 * Rotates encryption keys for a tenant
 * @param tenantId - Tenant identifier
 * @returns Promise<void>
 */
async function rotateEncryptionKey(tenantId: string): Promise<void> {
  try {
    // Get current key data
    const currentKeyData = keyStore.get(tenantId);
    if (!currentKeyData) {
      throw new Error('No encryption key found for tenant');
    }

    // Generate new key
    const newKey = await generateEncryptionKey(tenantId);
    
    // Update key store with new version
    keyStore.set(tenantId, {
      key: newKey,
      version: currentKeyData.version + 1,
      createdAt: new Date()
    });

    // Clean up old key from memory
    currentKeyData.key = '';

    logger.audit('Encryption key rotated', {
      tenantId,
      oldVersion: currentKeyData.version,
      newVersion: currentKeyData.version + 1
    });
  } catch (error) {
    logger.error('Key rotation failed', {
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error('Key rotation failed');
  }
}

// Set up key rotation interval
if (KEY_ROTATION_INTERVAL > 0) {
  setInterval(async () => {
    for (const [tenantId, keyData] of keyStore.entries()) {
      const keyAge = Date.now() - keyData.createdAt.getTime();
      if (keyAge >= KEY_ROTATION_INTERVAL) {
        await rotateEncryptionKey(tenantId);
      }
    }
  }, 24 * 60 * 60 * 1000); // Check daily
}

export {
  encrypt,
  decrypt,
  hashPassword,
  rotateEncryptionKey
};