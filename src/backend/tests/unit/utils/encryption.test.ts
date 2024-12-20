/**
 * Encryption Utility Module Tests
 * Version: 1.0.0
 * 
 * Comprehensive test suite for verifying encryption, password security,
 * tenant isolation, and key management functionality.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MockHsmKeyGenerator } from '@aws-crypto/mock-hsm';
import {
  encrypt,
  decrypt,
  hashPassword,
  comparePassword,
  rotateEncryptionKey,
  getTenantEncryptionKey
} from '../../../src/utils/encryption';

// Test constants
const TEST_DATA = 'test sensitive data';
const TEST_PASSWORD = 'testPassword123!';
const TENANT_ID = 'test-tenant-001';
const HSM_KEY_ID = 'arn:aws:kms:region:account:key/mock-key-id';

// Mock HSM for testing
let mockHsm: MockHsmKeyGenerator;

describe('Encryption Module', () => {
  beforeEach(() => {
    // Initialize mock HSM before each test
    mockHsm = new MockHsmKeyGenerator({
      keyId: HSM_KEY_ID,
      algorithm: 'AES-256-GCM'
    });

    // Reset any mocked functions
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up mock HSM
    mockHsm.destroy();
  });

  describe('Field Level Encryption', () => {
    test('should correctly encrypt and decrypt data with AES-256-GCM', async () => {
      // Encrypt test data
      const encrypted = await encrypt(TEST_DATA, TENANT_ID);

      // Verify encrypted data structure
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('version');

      // Verify IV length (12 bytes in base64)
      const ivBuffer = Buffer.from(encrypted.iv, 'base64');
      expect(ivBuffer.length).toBe(12);

      // Verify authentication tag length (16 bytes in base64)
      const tagBuffer = Buffer.from(encrypted.tag, 'base64');
      expect(tagBuffer.length).toBe(16);

      // Decrypt and verify data
      const decrypted = await decrypt(encrypted, TENANT_ID);
      expect(decrypted).toBe(TEST_DATA);
    });

    test('should generate unique IVs for each encryption', async () => {
      const encrypted1 = await encrypt(TEST_DATA, TENANT_ID);
      const encrypted2 = await encrypt(TEST_DATA, TENANT_ID);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });

    test('should fail decryption with invalid authentication tag', async () => {
      const encrypted = await encrypt(TEST_DATA, TENANT_ID);
      const invalidTag = Buffer.alloc(16).toString('base64');

      await expect(decrypt({
        ...encrypted,
        tag: invalidTag
      }, TENANT_ID)).rejects.toThrow('Decryption failed');
    });

    test('should handle different data types correctly', async () => {
      const testCases = [
        { input: 'string data', type: 'string' },
        { input: JSON.stringify({ key: 'value' }), type: 'json' },
        { input: Buffer.from('binary data').toString('base64'), type: 'binary' }
      ];

      for (const { input, type } of testCases) {
        const encrypted = await encrypt(input, TENANT_ID);
        const decrypted = await decrypt(encrypted, TENANT_ID);
        expect(decrypted).toBe(input);
      }
    });
  });

  describe('Password Security', () => {
    test('should properly hash and compare passwords', async () => {
      const hashedPassword = await hashPassword(TEST_PASSWORD);

      // Verify hash format
      expect(hashedPassword).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(hashedPassword).not.toBe(TEST_PASSWORD);

      // Verify correct password comparison
      const isValid = await comparePassword(TEST_PASSWORD, hashedPassword);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect passwords', async () => {
      const hashedPassword = await hashPassword(TEST_PASSWORD);
      const isValid = await comparePassword('wrongPassword', hashedPassword);
      expect(isValid).toBe(false);
    });

    test('should use correct number of salt rounds', async () => {
      const hashedPassword = await hashPassword(TEST_PASSWORD);
      const rounds = parseInt(hashedPassword.split('$')[2]);
      expect(rounds).toBe(10); // Default from auth.config
    });

    test('should reject weak passwords', async () => {
      const weakPasswords = ['short', '12345678', 'password123'];

      for (const password of weakPasswords) {
        await expect(hashPassword(password)).rejects.toThrow('Invalid password');
      }
    });
  });

  describe('Tenant Isolation', () => {
    test('should maintain complete tenant data isolation', async () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';
      const testData = 'sensitive data';

      // Encrypt data for tenant 1
      const encryptedTenant1 = await encrypt(testData, tenant1);

      // Attempt to decrypt with tenant 2 should fail
      await expect(decrypt(encryptedTenant1, tenant2))
        .rejects.toThrow('Encryption key not found for tenant');
    });

    test('should generate unique encryption keys per tenant', async () => {
      const tenant1Key = await getTenantEncryptionKey('tenant-1');
      const tenant2Key = await getTenantEncryptionKey('tenant-2');

      expect(tenant1Key).not.toBe(tenant2Key);
    });

    test('should maintain isolation after key rotation', async () => {
      // Encrypt data before rotation
      const encrypted = await encrypt(TEST_DATA, TENANT_ID);

      // Rotate key
      await rotateEncryptionKey(TENANT_ID);

      // Should still decrypt with new key
      const decrypted = await decrypt(encrypted, TENANT_ID);
      expect(decrypted).toBe(TEST_DATA);

      // Different tenant should not decrypt
      await expect(decrypt(encrypted, 'other-tenant'))
        .rejects.toThrow('Encryption key not found for tenant');
    });
  });

  describe('Key Management', () => {
    test('should handle key rotation correctly', async () => {
      // Get initial key version
      const initialKey = await getTenantEncryptionKey(TENANT_ID);
      const encrypted = await encrypt(TEST_DATA, TENANT_ID);

      // Rotate key
      await rotateEncryptionKey(TENANT_ID);
      const newKey = await getTenantEncryptionKey(TENANT_ID);

      // Verify key changed
      expect(newKey).not.toBe(initialKey);

      // Verify old data can still be decrypted
      const decrypted = await decrypt(encrypted, TENANT_ID);
      expect(decrypted).toBe(TEST_DATA);
    });

    test('should track key versions correctly', async () => {
      const encrypted = await encrypt(TEST_DATA, TENANT_ID);
      expect(encrypted.version).toBe(1);

      await rotateEncryptionKey(TENANT_ID);
      const newEncrypted = await encrypt(TEST_DATA, TENANT_ID);
      expect(newEncrypted.version).toBe(2);
    });

    test('should integrate with HSM correctly', async () => {
      // Mock HSM key generation
      const mockGenerateKey = jest.spyOn(mockHsm, 'generateKey');
      
      await rotateEncryptionKey(TENANT_ID);

      expect(mockGenerateKey).toHaveBeenCalledWith({
        algorithm: 'AES-256-GCM',
        extractable: false,
        keyUsages: ['encrypt', 'decrypt']
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input data', async () => {
      const invalidInputs = ['', null, undefined];

      for (const input of invalidInputs) {
        // @ts-ignore - Testing invalid inputs
        await expect(encrypt(input, TENANT_ID))
          .rejects.toThrow('Data is required for encryption');
      }
    });

    test('should handle HSM failures gracefully', async () => {
      // Mock HSM failure
      mockHsm.generateKey = jest.fn().mockRejectedValue(new Error('HSM error'));

      await expect(rotateEncryptionKey(TENANT_ID))
        .rejects.toThrow('Key rotation failed');
    });

    test('should handle invalid encrypted data format', async () => {
      const invalidData = {
        iv: 'invalid',
        tag: 'invalid',
        ciphertext: 'invalid',
        version: 1
      };

      await expect(decrypt(invalidData, TENANT_ID))
        .rejects.toThrow('Decryption failed');
    });

    test('should handle missing tenant context', async () => {
      await expect(encrypt(TEST_DATA, ''))
        .rejects.toThrow('Encryption failed');
    });
  });
});