import { describe, it, expect } from '@jest/globals'; // v29.7.0
import {
  validateEmail,
  validatePhone,
  leadValidationSchema,
  quoteValidationSchema,
  userValidationSchema
} from '../../../src/utils/validation';
import { LeadCategory } from '../../../src/constants/leadCategories';
import { ROLES } from '../../../backend/src/constants/roles';
import { UserStatus } from '../../../src/types/user';

describe('Email Validation', () => {
  const validTenantId = 'test-tenant-123';

  it('should validate standard email formats', async () => {
    const validEmails = [
      'user@domain.com',
      'user.name@domain.com',
      'user+tag@domain.com',
      'user@sub.domain.com',
      'user123@domain.co.uk'
    ];

    for (const email of validEmails) {
      expect(await validateEmail(email, validTenantId)).toBe(true);
    }
  });

  it('should reject invalid email formats', async () => {
    const invalidEmails = [
      'invalid-email',
      '@domain.com',
      'user@',
      'user@.com',
      'user@domain.',
      'user space@domain.com',
      'user..name@domain.com'
    ];

    for (const email of invalidEmails) {
      expect(await validateEmail(email, validTenantId)).toBe(false);
    }
  });

  it('should handle disposable email domains', async () => {
    const disposableEmails = [
      'user@tempmail.com',
      'user@throwawaymail.com'
    ];

    for (const email of disposableEmails) {
      expect(await validateEmail(email, validTenantId)).toBe(false);
    }
  });

  it('should handle empty and null inputs', async () => {
    expect(await validateEmail('', validTenantId)).toBe(false);
    expect(await validateEmail(null as any, validTenantId)).toBe(false);
    expect(await validateEmail(undefined as any, validTenantId)).toBe(false);
  });
});

describe('Phone Validation', () => {
  it('should validate international phone formats', () => {
    const validPhones = [
      '+1-555-555-5555',
      '+44-20-7123-4567',
      '+61-2-8765-4321',
      '+86-10-6543-2109',
      '+49-30-1234-5678'
    ];

    for (const phone of validPhones) {
      expect(validatePhone(phone)).toBe(true);
    }
  });

  it('should validate country-specific formats', () => {
    const countryTests = [
      { phone: '+1-555-555-5555', country: '1' },
      { phone: '+44-20-7123-4567', country: '44' },
      { phone: '+61-2-8765-4321', country: '61' }
    ];

    for (const test of countryTests) {
      expect(validatePhone(test.phone, test.country)).toBe(true);
    }
  });

  it('should reject invalid phone formats', () => {
    const invalidPhones = [
      'invalid-phone',
      '555-555-5555', // missing country code
      '+1234', // too short
      '+1-abc-def-ghij',
      '+1-555-555-555555555' // too long
    ];

    for (const phone of invalidPhones) {
      expect(validatePhone(phone)).toBe(false);
    }
  });

  it('should handle empty and null inputs', () => {
    expect(validatePhone('')).toBe(false);
    expect(validatePhone(null as any)).toBe(false);
    expect(validatePhone(undefined as any)).toBe(false);
  });
});

describe('Lead Validation Schema', () => {
  const validLeadData = {
    tenantId: 'test-tenant-123',
    category: LeadCategory.UNASSIGNED,
    assignedTo: null,
    status: 'NEW',
    priority: 3,
    company: 'Test Company',
    contactName: 'John Doe',
    email: 'john@example.com',
    phone: '+1-555-555-5555',
    metadata: {
      source: 'WEB',
      campaign: 'Q4_2023'
    }
  };

  it('should validate complete lead data', async () => {
    await expect(leadValidationSchema.validate(validLeadData)).resolves.toBeTruthy();
  });

  it('should require mandatory fields', async () => {
    const mandatoryFields = [
      'tenantId',
      'category',
      'status',
      'priority',
      'company',
      'contactName',
      'email',
      'phone'
    ];

    for (const field of mandatoryFields) {
      const invalidData = { ...validLeadData };
      delete (invalidData as any)[field];
      await expect(leadValidationSchema.validate(invalidData)).rejects.toThrow();
    }
  });

  it('should validate priority range', async () => {
    const invalidPriorities = [0, 6, -1, 10];
    
    for (const priority of invalidPriorities) {
      const invalidData = { ...validLeadData, priority };
      await expect(leadValidationSchema.validate(invalidData)).rejects.toThrow();
    }
  });

  it('should validate lead categories', async () => {
    const invalidData = { ...validLeadData, category: 'INVALID_CATEGORY' };
    await expect(leadValidationSchema.validate(invalidData)).rejects.toThrow();
  });
});

describe('Quote Validation Schema', () => {
  const validQuoteData = {
    tenantId: 'test-tenant-123',
    leadId: 'lead-123',
    items: [{
      productId: 'prod-123',
      description: 'Test Product',
      quantity: 2,
      unitPrice: 100,
      discountPercent: 10,
      taxRate: 20
    }],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    notes: 'Test notes',
    terms: 'Standard terms and conditions'
  };

  it('should validate complete quote data', async () => {
    await expect(quoteValidationSchema.validate(validQuoteData)).resolves.toBeTruthy();
  });

  it('should require at least one item', async () => {
    const invalidData = { ...validQuoteData, items: [] };
    await expect(quoteValidationSchema.validate(invalidData)).rejects.toThrow();
  });

  it('should validate item quantities and prices', async () => {
    const invalidItems = [
      { ...validQuoteData.items[0], quantity: 0 },
      { ...validQuoteData.items[0], quantity: -1 },
      { ...validQuoteData.items[0], unitPrice: -1 },
      { ...validQuoteData.items[0], discountPercent: 101 },
      { ...validQuoteData.items[0], taxRate: -1 }
    ];

    for (const item of invalidItems) {
      const invalidData = { ...validQuoteData, items: [item] };
      await expect(quoteValidationSchema.validate(invalidData)).rejects.toThrow();
    }
  });

  it('should validate quote validity date', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
    const invalidData = { ...validQuoteData, validUntil: pastDate };
    await expect(quoteValidationSchema.validate(invalidData)).rejects.toThrow();
  });
});

describe('User Validation Schema', () => {
  const validUserData = {
    tenantId: 'test-tenant-123',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: ROLES.AGENT,
    status: UserStatus.ACTIVE,
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: {},
      timezone: 'UTC'
    }
  };

  it('should validate complete user data', async () => {
    await expect(userValidationSchema.validate(validUserData)).resolves.toBeTruthy();
  });

  it('should validate user roles', async () => {
    const invalidData = { ...validUserData, role: 'INVALID_ROLE' };
    await expect(userValidationSchema.validate(invalidData)).rejects.toThrow();
  });

  it('should validate user status', async () => {
    const invalidData = { ...validUserData, status: 'INVALID_STATUS' };
    await expect(userValidationSchema.validate(invalidData)).rejects.toThrow();
  });

  it('should validate name length requirements', async () => {
    const invalidNames = [
      { ...validUserData, firstName: 'A' }, // too short
      { ...validUserData, lastName: 'A' }, // too short
      { ...validUserData, firstName: 'A'.repeat(51) }, // too long
      { ...validUserData, lastName: 'A'.repeat(51) } // too long
    ];

    for (const invalidData of invalidNames) {
      await expect(userValidationSchema.validate(invalidData)).rejects.toThrow();
    }
  });

  it('should validate theme preferences', async () => {
    const invalidThemes = [
      { ...validUserData, preferences: { ...validUserData.preferences, theme: 'invalid' } }
    ];

    for (const invalidData of invalidThemes) {
      await expect(userValidationSchema.validate(invalidData)).rejects.toThrow();
    }
  });
});