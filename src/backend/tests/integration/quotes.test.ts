/**
 * @fileoverview Integration tests for quote management functionality in the multi-tenant CRM system
 * @version 1.0.0
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'; // ^29.0.0
import mongoose from 'mongoose'; // ^7.0.0
import { Types } from 'mongoose';
import QuoteService from '../../src/services/QuoteService';
import EmailService from '../../src/services/EmailService';
import Quote from '../../src/db/models/Quote';
import { IQuote } from '../../src/interfaces/IQuote';
import { ILead } from '../../src/interfaces/ILead';
import { LeadCategory } from '../../src/constants/leadCategories';
import logger from '../../src/utils/logger';

// Test constants
const TEST_TENANT_ID = new Types.ObjectId();
const TEST_LEAD_ID = new Types.ObjectId();
const TEST_USER_ID = new Types.ObjectId();

// Mock quote data
const MOCK_QUOTE_DATA: Partial<IQuote> = {
  leadId: TEST_LEAD_ID,
  quoteNumber: 'QT-000001-2023',
  status: 'draft',
  items: [
    {
      itemId: 'ITEM-001',
      description: 'Enterprise License',
      quantity: 1,
      unitPrice: 1000,
      amount: 1000,
      currency: 'USD',
      taxable: true,
      customFields: {}
    }
  ],
  taxRate: 0.1,
  currency: 'USD',
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  notes: 'Test quote notes',
  createdBy: TEST_USER_ID,
  lastModifiedBy: TEST_USER_ID,
  tags: ['test', 'integration']
};

// Mock lead data
const MOCK_LEAD_DATA: Partial<ILead> = {
  tenantId: TEST_TENANT_ID,
  category: LeadCategory.PIPELINE,
  company: 'Test Company',
  contactName: 'John Doe',
  email: 'john.doe@test.com',
  phone: '+1234567890'
};

describe('Quote Management Integration Tests', () => {
  let quoteService: QuoteService;
  let emailService: EmailService;
  let testQuoteId: Types.ObjectId;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/crm-test');

    // Initialize services with mocked dependencies
    emailService = new EmailService();
    quoteService = new QuoteService(emailService, logger);

    // Mock email service methods
    jest.spyOn(emailService, 'sendQuoteEmail').mockImplementation(async () => ({
      success: true,
      messageId: 'test-message-id',
      timestamp: new Date(),
      recipient: MOCK_LEAD_DATA.email!
    }));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Clean up quotes collection before each test
    await Quote.deleteMany({});
  });

  describe('Quote Creation', () => {
    test('should create quote with valid data and proper tenant context', async () => {
      const quote = await quoteService.createQuote(
        TEST_TENANT_ID,
        TEST_LEAD_ID,
        MOCK_QUOTE_DATA,
        { generatePDF: false }
      );

      expect(quote).toBeDefined();
      expect(quote.tenantId).toEqual(TEST_TENANT_ID);
      expect(quote.leadId).toEqual(TEST_LEAD_ID);
      expect(quote.status).toBe('draft');
      expect(quote.items).toHaveLength(1);
      expect(quote.subtotal).toBe(1000);
      expect(quote.tax).toBe(100);
      expect(quote.total).toBe(1100);
    });

    test('should enforce tenant isolation during creation', async () => {
      const DIFFERENT_TENANT_ID = new Types.ObjectId();

      await quoteService.createQuote(TEST_TENANT_ID, TEST_LEAD_ID, MOCK_QUOTE_DATA);
      
      const quotes = await Quote.find({ tenantId: DIFFERENT_TENANT_ID });
      expect(quotes).toHaveLength(0);
    });

    test('should validate all required fields', async () => {
      const invalidQuoteData = { ...MOCK_QUOTE_DATA };
      delete invalidQuoteData.items;

      await expect(
        quoteService.createQuote(TEST_TENANT_ID, TEST_LEAD_ID, invalidQuoteData)
      ).rejects.toThrow('At least one item is required');
    });

    test('should calculate totals correctly with tax', async () => {
      const quote = await quoteService.createQuote(TEST_TENANT_ID, TEST_LEAD_ID, {
        ...MOCK_QUOTE_DATA,
        items: [
          {
            itemId: 'ITEM-001',
            description: 'Product A',
            quantity: 2,
            unitPrice: 100,
            amount: 200,
            currency: 'USD',
            taxable: true,
            customFields: {}
          },
          {
            itemId: 'ITEM-002',
            description: 'Product B',
            quantity: 1,
            unitPrice: 50,
            amount: 50,
            currency: 'USD',
            taxable: false,
            customFields: {}
          }
        ],
        taxRate: 0.2
      });

      expect(quote.subtotal).toBe(250);
      expect(quote.tax).toBe(40); // Only taxable items
      expect(quote.total).toBe(290);
    });
  });

  describe('Quote Retrieval', () => {
    beforeEach(async () => {
      const quote = await quoteService.createQuote(TEST_TENANT_ID, TEST_LEAD_ID, MOCK_QUOTE_DATA);
      testQuoteId = quote._id;
    });

    test('should retrieve quote by ID with tenant context', async () => {
      const quote = await quoteService.getQuoteById(TEST_TENANT_ID, testQuoteId);

      expect(quote).toBeDefined();
      expect(quote?.tenantId).toEqual(TEST_TENANT_ID);
      expect(quote?.quoteNumber).toBe(MOCK_QUOTE_DATA.quoteNumber);
    });

    test('should retrieve quotes by lead with pagination', async () => {
      // Create additional quotes for the same lead
      await Promise.all([
        quoteService.createQuote(TEST_TENANT_ID, TEST_LEAD_ID, {
          ...MOCK_QUOTE_DATA,
          quoteNumber: 'QT-000002-2023'
        }),
        quoteService.createQuote(TEST_TENANT_ID, TEST_LEAD_ID, {
          ...MOCK_QUOTE_DATA,
          quoteNumber: 'QT-000003-2023'
        })
      ]);

      const quotes = await quoteService.getQuotesByLead(
        TEST_TENANT_ID,
        TEST_LEAD_ID,
        { page: 1, limit: 2 }
      );

      expect(quotes).toHaveLength(2);
      expect(quotes[0].tenantId).toEqual(TEST_TENANT_ID);
      expect(quotes[0].leadId).toEqual(TEST_LEAD_ID);
    });
  });

  describe('Quote Email Delivery', () => {
    test('should send quote email with proper tenant context', async () => {
      const quote = await quoteService.createQuote(TEST_TENANT_ID, TEST_LEAD_ID, MOCK_QUOTE_DATA);

      await expect(
        quoteService.sendQuoteEmail(
          TEST_TENANT_ID,
          quote._id,
          MOCK_LEAD_DATA.email!
        )
      ).resolves.not.toThrow();

      expect(emailService.sendQuoteEmail).toHaveBeenCalledWith(
        TEST_TENANT_ID.toString(),
        MOCK_LEAD_DATA.email,
        expect.objectContaining({
          quoteId: quote._id,
          quoteNumber: quote.quoteNumber
        })
      );
    });

    test('should enforce tenant isolation in email delivery', async () => {
      const DIFFERENT_TENANT_ID = new Types.ObjectId();
      const quote = await quoteService.createQuote(TEST_TENANT_ID, TEST_LEAD_ID, MOCK_QUOTE_DATA);

      await expect(
        quoteService.sendQuoteEmail(
          DIFFERENT_TENANT_ID,
          quote._id,
          MOCK_LEAD_DATA.email!
        )
      ).rejects.toThrow('Quote not found or access denied');
    });
  });

  describe('Quote Updates', () => {
    beforeEach(async () => {
      const quote = await quoteService.createQuote(TEST_TENANT_ID, TEST_LEAD_ID, MOCK_QUOTE_DATA);
      testQuoteId = quote._id;
    });

    test('should update quote with valid status transition', async () => {
      const quote = await quoteService.updateQuote(
        TEST_TENANT_ID,
        testQuoteId,
        { status: 'sent' },
        { validateTransition: true }
      );

      expect(quote.status).toBe('sent');
      expect(quote.updatedAt).toBeInstanceOf(Date);
    });

    test('should prevent invalid status transitions', async () => {
      await expect(
        quoteService.updateQuote(
          TEST_TENANT_ID,
          testQuoteId,
          { status: 'accepted' },
          { validateTransition: true }
        )
      ).rejects.toThrow('Invalid status transition');
    });

    test('should recalculate totals on item updates', async () => {
      const quote = await quoteService.updateQuote(
        TEST_TENANT_ID,
        testQuoteId,
        {
          items: [
            {
              itemId: 'ITEM-001',
              description: 'Updated Item',
              quantity: 2,
              unitPrice: 500,
              amount: 1000,
              currency: 'USD',
              taxable: true,
              customFields: {}
            }
          ]
        },
        { recalculateTotals: true }
      );

      expect(quote.subtotal).toBe(1000);
      expect(quote.tax).toBe(100);
      expect(quote.total).toBe(1100);
    });
  });
});