/**
 * @fileoverview Comprehensive unit test suite for QuoteService
 * Testing quote management functionality with multi-tenant isolation
 * @version 1.0.0
 */

import { describe, expect, jest, beforeEach, afterEach, it } from '@jest/globals';
import { Types } from 'mongoose';
import { QuoteService } from '../../../src/services/QuoteService';
import { IQuote, IQuoteDocument } from '../../../src/interfaces/IQuote';
import { EmailService } from '../../../src/services/EmailService';
import Quote from '../../../src/db/models/Quote';

// Mock dependencies
jest.mock('../../../src/services/EmailService');
jest.mock('../../../src/db/models/Quote');

describe('QuoteService', () => {
  let quoteService: QuoteService;
  let emailService: jest.Mocked<EmailService>;
  let mockLogger: any;
  
  // Test data setup
  const mockTenantId = new Types.ObjectId();
  const mockLeadId = new Types.ObjectId();
  const mockUserId = new Types.ObjectId();

  const mockQuoteData: Partial<IQuote> = {
    leadId: mockLeadId,
    quoteNumber: 'QT-000001-2023',
    status: 'draft',
    items: [
      {
        itemId: '1',
        description: 'Test Item',
        quantity: 2,
        unitPrice: 100,
        amount: 200,
        currency: 'USD',
        taxable: true,
        customFields: {}
      }
    ],
    subtotal: 200,
    taxRate: 0.1,
    tax: 20,
    total: 220,
    currency: 'USD',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    notes: 'Test quote',
    createdBy: mockUserId,
    lastModifiedBy: mockUserId,
    isActive: true,
    tags: ['test']
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Initialize mocked logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn()
    };

    // Initialize mocked email service
    emailService = new EmailService() as jest.Mocked<EmailService>;

    // Initialize quote service
    quoteService = new QuoteService(emailService, mockLogger);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createQuote', () => {
    it('should create a quote with valid data and tenant isolation', async () => {
      // Mock Quote.create
      const mockCreatedQuote = {
        ...mockQuoteData,
        _id: new Types.ObjectId(),
        tenantId: mockTenantId
      } as IQuoteDocument;

      (Quote.create as jest.Mock).mockResolvedValueOnce(mockCreatedQuote);

      // Execute test
      const result = await quoteService.createQuote(
        mockTenantId,
        mockLeadId,
        mockQuoteData,
        { generatePDF: false }
      );

      // Verify results
      expect(result).toBeDefined();
      expect(result.tenantId).toEqual(mockTenantId);
      expect(result.leadId).toEqual(mockLeadId);
      expect(result.status).toBe('draft');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should enforce tenant isolation', async () => {
      // Test without tenant ID
      await expect(
        quoteService.createQuote(
          undefined as unknown as Types.ObjectId,
          mockLeadId,
          mockQuoteData
        )
      ).rejects.toThrow('Tenant context is required');
    });

    it('should validate quote data comprehensively', async () => {
      // Test with invalid quote data
      const invalidQuoteData = {
        ...mockQuoteData,
        items: [] // Invalid: empty items array
      };

      await expect(
        quoteService.createQuote(mockTenantId, mockLeadId, invalidQuoteData)
      ).rejects.toThrow();
    });

    it('should handle quote creation with email notification', async () => {
      // Mock quote creation and email sending
      const mockCreatedQuote = {
        ...mockQuoteData,
        _id: new Types.ObjectId(),
        tenantId: mockTenantId
      } as IQuoteDocument;

      (Quote.create as jest.Mock).mockResolvedValueOnce(mockCreatedQuote);
      (emailService.sendQuoteEmail as jest.Mock).mockResolvedValueOnce({ success: true });

      // Execute test with email option
      const result = await quoteService.createQuote(
        mockTenantId,
        mockLeadId,
        mockQuoteData,
        {
          generatePDF: true,
          sendEmail: true,
          recipientEmail: 'test@example.com'
        }
      );

      // Verify results
      expect(result).toBeDefined();
      expect(emailService.sendQuoteEmail).toHaveBeenCalled();
    });
  });

  describe('updateQuote', () => {
    const mockQuoteId = new Types.ObjectId();
    const mockExistingQuote = {
      ...mockQuoteData,
      _id: mockQuoteId,
      tenantId: mockTenantId,
      save: jest.fn()
    } as unknown as IQuoteDocument;

    it('should update quote with proper validation', async () => {
      // Mock Quote.findOne
      (Quote.findOne as jest.Mock).mockResolvedValueOnce(mockExistingQuote);

      // Update data
      const updateData = {
        notes: 'Updated notes',
        status: 'sent'
      };

      // Execute test
      const result = await quoteService.updateQuote(
        mockTenantId,
        mockQuoteId,
        updateData,
        { validateTransition: true }
      );

      // Verify results
      expect(result).toBeDefined();
      expect(result.notes).toBe(updateData.notes);
      expect(result.status).toBe(updateData.status);
      expect(mockExistingQuote.save).toHaveBeenCalled();
    });

    it('should enforce tenant isolation on updates', async () => {
      // Mock Quote.findOne with different tenant
      (Quote.findOne as jest.Mock).mockResolvedValueOnce(null);

      // Execute test
      await expect(
        quoteService.updateQuote(
          new Types.ObjectId(), // Different tenant ID
          mockQuoteId,
          { notes: 'Updated' }
        )
      ).rejects.toThrow('Quote not found or access denied');
    });

    it('should validate status transitions', async () => {
      // Mock quote with invalid status transition
      const mockQuote = {
        ...mockExistingQuote,
        status: 'expired'
      };

      (Quote.findOne as jest.Mock).mockResolvedValueOnce(mockQuote);

      // Attempt invalid transition
      await expect(
        quoteService.updateQuote(
          mockTenantId,
          mockQuoteId,
          { status: 'sent' },
          { validateTransition: true }
        )
      ).rejects.toThrow(/Invalid status transition/);
    });
  });

  describe('sendQuoteEmail', () => {
    const mockQuoteId = new Types.ObjectId();
    const mockRecipientEmail = 'test@example.com';

    it('should send quote email with proper validation', async () => {
      // Mock quote retrieval with populated fields
      const mockQuote = {
        ...mockQuoteData,
        _id: mockQuoteId,
        tenantId: mockTenantId,
        leadId: {
          contactName: 'John Doe',
          company: 'Test Corp'
        },
        createdBy: {
          email: 'agent@example.com'
        }
      };

      (Quote.findOne as jest.Mock)
        .mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockQuote)
          })
        });

      // Execute test
      await quoteService.sendQuoteEmail(
        mockTenantId,
        mockQuoteId,
        mockRecipientEmail
      );

      // Verify email service was called correctly
      expect(emailService.sendQuoteEmail).toHaveBeenCalledWith(
        mockTenantId.toString(),
        mockRecipientEmail,
        expect.objectContaining({
          quoteId: mockQuoteId,
          customerName: 'John Doe',
          companyName: 'Test Corp'
        })
      );
    });

    it('should enforce tenant isolation for email sending', async () => {
      // Mock quote not found for different tenant
      (Quote.findOne as jest.Mock)
        .mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(null)
          })
        });

      // Execute test
      await expect(
        quoteService.sendQuoteEmail(
          new Types.ObjectId(), // Different tenant ID
          mockQuoteId,
          mockRecipientEmail
        )
      ).rejects.toThrow('Quote not found or access denied');
    });

    it('should handle email service errors gracefully', async () => {
      // Mock quote retrieval success but email failure
      const mockQuote = {
        ...mockQuoteData,
        _id: mockQuoteId,
        tenantId: mockTenantId,
        leadId: {
          contactName: 'John Doe',
          company: 'Test Corp'
        },
        createdBy: {
          email: 'agent@example.com'
        }
      };

      (Quote.findOne as jest.Mock)
        .mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockQuote)
          })
        });

      // Mock email service error
      (emailService.sendQuoteEmail as jest.Mock).mockRejectedValueOnce(
        new Error('Email service error')
      );

      // Execute test
      await expect(
        quoteService.sendQuoteEmail(
          mockTenantId,
          mockQuoteId,
          mockRecipientEmail
        )
      ).rejects.toThrow('Email service error');
    });
  });
});