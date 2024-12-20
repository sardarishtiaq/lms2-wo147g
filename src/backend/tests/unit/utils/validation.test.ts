/**
 * @fileoverview Comprehensive unit test suite for validation utility functions
 * Testing data validation, tenant isolation, and security rules for the CRM system
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ObjectId } from 'mongodb';
import {
  validateLead,
  validateUser,
  validateQuote,
  validateTenantContext
} from '../../src/utils/validation';
import { ErrorCode } from '../../src/constants/errorCodes';
import { LeadCategory } from '../../src/constants/leadCategories';

describe('Validation Utility Tests', () => {
  // Mock valid data setup
  const validTenantId = new ObjectId().toString();
  const validUserId = new ObjectId().toString();
  const validLeadId = new ObjectId().toString();

  const validLeadData = {
    tenantId: validTenantId,
    company: 'Test Company',
    contactName: 'John Doe',
    email: 'john.doe@test.com',
    phone: '+12025550123',
    category: LeadCategory.NEW_DATA,
    priority: 3,
    metadata: {
      source: 'Website',
      campaign: 'Q4_2023'
    }
  };

  const validUserData = {
    tenantId: validTenantId,
    email: 'agent@company.com',
    password: 'Test@12345678',
    role: 'agent'
  };

  const validQuoteData = {
    tenantId: validTenantId,
    leadId: validLeadId,
    items: [
      {
        description: 'Service Package A',
        quantity: 1,
        unitPrice: 1000,
        total: 1000
      }
    ],
    total: 1000,
    status: 'draft'
  };

  const validTenantData = {
    tenantId: validTenantId,
    name: 'Test Tenant',
    settings: {},
    status: 'active'
  };

  describe('validateLead', () => {
    it('should validate a correct lead object', async () => {
      await expect(validateLead(validLeadData)).resolves.toBe(true);
    });

    it('should reject lead with invalid tenant ID', async () => {
      const invalidData = { ...validLeadData, tenantId: 'invalid-id' };
      await expect(validateLead(invalidData)).rejects.toThrow('Invalid tenant ID format');
    });

    it('should validate all lead categories', async () => {
      for (const category of Object.values(LeadCategory)) {
        const testData = { ...validLeadData, category };
        await expect(validateLead(testData)).resolves.toBe(true);
      }
    });

    it('should reject invalid email format', async () => {
      const invalidData = { ...validLeadData, email: 'invalid-email' };
      await expect(validateLead(invalidData)).rejects.toThrow('Invalid email format');
    });

    it('should reject invalid phone format', async () => {
      const invalidData = { ...validLeadData, phone: '123456' };
      await expect(validateLead(invalidData)).rejects.toThrow('Phone number must be in E.164 format');
    });

    it('should validate metadata structure', async () => {
      const testData = {
        ...validLeadData,
        metadata: {
          complexData: { nested: true },
          arrays: [1, 2, 3]
        }
      };
      await expect(validateLead(testData)).resolves.toBe(true);
    });
  });

  describe('validateUser', () => {
    it('should validate a correct user object', async () => {
      await expect(validateUser(validUserData)).resolves.toBe(true);
    });

    it('should enforce password strength requirements', async () => {
      const weakPasswords = [
        'short',
        'NoSpecialChar1',
        'no-upper-1@',
        'NO-LOWER-1@'
      ];

      for (const password of weakPasswords) {
        const testData = { ...validUserData, password };
        await expect(validateUser(testData)).rejects.toThrow(/Password must be/);
      }
    });

    it('should validate all allowed user roles', async () => {
      const roles = ['admin', 'manager', 'agent', 'viewer'];
      for (const role of roles) {
        const testData = { ...validUserData, role };
        await expect(validateUser(testData)).resolves.toBe(true);
      }
    });

    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'not-an-email',
        '@no-local.com',
        'spaces in@email.com',
        'missing.domain@'
      ];

      for (const email of invalidEmails) {
        const testData = { ...validUserData, email };
        await expect(validateUser(testData)).rejects.toThrow('Invalid email format');
      }
    });
  });

  describe('validateQuote', () => {
    it('should validate a correct quote object', async () => {
      await expect(validateQuote(validQuoteData)).resolves.toBe(true);
    });

    it('should validate quote total matches sum of items', async () => {
      const invalidTotal = {
        ...validQuoteData,
        total: 2000 // Doesn't match item total of 1000
      };
      await expect(validateQuote(invalidTotal))
        .rejects.toThrow('Total amount does not match sum of item totals');
    });

    it('should validate multiple quote items', async () => {
      const multiItemQuote = {
        ...validQuoteData,
        items: [
          { description: 'Item 1', quantity: 2, unitPrice: 100, total: 200 },
          { description: 'Item 2', quantity: 1, unitPrice: 300, total: 300 }
        ],
        total: 500
      };
      await expect(validateQuote(multiItemQuote)).resolves.toBe(true);
    });

    it('should reject quotes with invalid status', async () => {
      const invalidStatus = {
        ...validQuoteData,
        status: 'invalid-status'
      };
      await expect(validateQuote(invalidStatus)).rejects.toThrow();
    });
  });

  describe('validateTenantContext', () => {
    it('should validate a correct tenant object', async () => {
      await expect(validateTenantContext(validTenantData)).resolves.toBe(true);
    });

    it('should reject invalid tenant status', async () => {
      const invalidStatus = {
        ...validTenantData,
        status: 'invalid'
      };
      await expect(validateTenantContext(invalidStatus))
        .rejects.toThrow();
    });

    it('should validate tenant name constraints', async () => {
      // Test empty name
      await expect(validateTenantContext({ ...validTenantData, name: '' }))
        .rejects.toThrow();

      // Test name too long (> 200 chars)
      await expect(validateTenantContext({ 
        ...validTenantData, 
        name: 'a'.repeat(201) 
      })).rejects.toThrow();
    });

    it('should validate tenant settings object', async () => {
      const complexSettings = {
        ...validTenantData,
        settings: {
          theme: { primary: '#000000', secondary: '#FFFFFF' },
          features: ['feature1', 'feature2'],
          limits: { users: 100, storage: '5GB' }
        }
      };
      await expect(validateTenantContext(complexSettings)).resolves.toBe(true);
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    it('should return appropriate error codes', async () => {
      try {
        await validateLead({ ...validLeadData, tenantId: 'invalid' });
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('should provide detailed error messages', async () => {
      try {
        await validateUser({});
      } catch (error: any) {
        expect(error.details).toBeDefined();
        expect(Object.keys(error.details).length).toBeGreaterThan(0);
      }
    });
  });
});