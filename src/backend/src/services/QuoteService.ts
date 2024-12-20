/**
 * @fileoverview Quote management service implementing secure, multi-tenant quote operations
 * with comprehensive lead tracking, quote generation, and email delivery capabilities.
 * @version 1.0.0
 */

import { Types } from 'mongoose'; // v7.0.0
import Decimal from 'decimal.js'; // v10.4.0
import { Logger } from 'winston'; // v3.8.0
import { IQuote, IQuoteDocument } from '../../interfaces/IQuote';
import Quote from '../db/models/Quote';
import EmailService from './EmailService';

/**
 * Interface for quote creation options
 */
interface IQuoteCreationOptions {
  generatePDF?: boolean;
  sendEmail?: boolean;
  recipientEmail?: string;
  customTemplate?: string;
}

/**
 * Interface for quote update options
 */
interface IQuoteUpdateOptions {
  recalculateTotals?: boolean;
  notifyStakeholders?: boolean;
  validateTransition?: boolean;
}

/**
 * Service class implementing secure quote management functionality
 */
export class QuoteService {
  private readonly emailService: EmailService;
  private readonly logger: Logger;

  constructor(emailService: EmailService, logger: Logger) {
    this.emailService = emailService;
    this.logger = logger;
  }

  /**
   * Creates a new quote with comprehensive validation and tenant isolation
   * @param tenantId - Tenant identifier for isolation
   * @param leadId - Associated lead identifier
   * @param quoteData - Quote data to create
   * @param options - Creation options
   * @returns Created quote document
   */
  public async createQuote(
    tenantId: Types.ObjectId,
    leadId: Types.ObjectId,
    quoteData: Partial<IQuote>,
    options: IQuoteCreationOptions = {}
  ): Promise<IQuoteDocument> {
    try {
      this.logger.debug('Creating new quote', { tenantId, leadId });

      // Validate tenant context
      if (!tenantId) {
        throw new Error('Tenant context is required');
      }

      // Prepare quote data with tenant isolation
      const quote: Partial<IQuote> = {
        ...quoteData,
        tenantId,
        leadId,
        status: 'draft',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Calculate totals
      const totals = await Quote.calculateTotals(quote.items || [], quote.taxRate || 0);
      Object.assign(quote, totals);

      // Create quote document
      const createdQuote = await Quote.create(quote);
      this.logger.info('Quote created successfully', { 
        quoteId: createdQuote._id,
        tenantId 
      });

      // Handle additional options
      if (options.generatePDF && options.sendEmail && options.recipientEmail) {
        await this.sendQuoteEmail(
          tenantId,
          createdQuote._id,
          options.recipientEmail,
          options.customTemplate
        );
      }

      return createdQuote;
    } catch (error) {
      this.logger.error('Error creating quote', { error, tenantId, leadId });
      throw error;
    }
  }

  /**
   * Updates an existing quote with validation and security checks
   * @param tenantId - Tenant identifier for isolation
   * @param quoteId - Quote identifier to update
   * @param updateData - Quote data to update
   * @param options - Update options
   * @returns Updated quote document
   */
  public async updateQuote(
    tenantId: Types.ObjectId,
    quoteId: Types.ObjectId,
    updateData: Partial<IQuote>,
    options: IQuoteUpdateOptions = {}
  ): Promise<IQuoteDocument> {
    try {
      this.logger.debug('Updating quote', { tenantId, quoteId });

      // Find quote with tenant isolation
      const quote = await Quote.findOne({ _id: quoteId, tenantId, isActive: true });
      if (!quote) {
        throw new Error('Quote not found or access denied');
      }

      // Validate status transition if required
      if (options.validateTransition && updateData.status) {
        this.validateStatusTransition(quote.status, updateData.status);
      }

      // Update quote fields
      Object.assign(quote, updateData);
      quote.updatedAt = new Date();

      // Recalculate totals if needed
      if (options.recalculateTotals || updateData.items || updateData.taxRate) {
        const totals = await Quote.calculateTotals(quote.items, quote.taxRate);
        Object.assign(quote, totals);
      }

      // Save updates
      await quote.save();
      this.logger.info('Quote updated successfully', { quoteId, tenantId });

      // Notify stakeholders if required
      if (options.notifyStakeholders) {
        await this.notifyQuoteUpdate(quote);
      }

      return quote;
    } catch (error) {
      this.logger.error('Error updating quote', { error, tenantId, quoteId });
      throw error;
    }
  }

  /**
   * Sends quote via secure email with PDF attachment
   * @param tenantId - Tenant identifier for isolation
   * @param quoteId - Quote identifier to send
   * @param recipientEmail - Recipient email address
   * @param templateName - Optional custom email template
   */
  public async sendQuoteEmail(
    tenantId: Types.ObjectId,
    quoteId: Types.ObjectId,
    recipientEmail: string,
    templateName?: string
  ): Promise<void> {
    try {
      this.logger.debug('Sending quote email', { tenantId, quoteId, recipientEmail });

      // Find quote with tenant isolation
      const quote = await Quote.findOne({ _id: quoteId, tenantId, isActive: true })
        .populate('leadId')
        .populate('createdBy');

      if (!quote) {
        throw new Error('Quote not found or access denied');
      }

      // Prepare quote data for email
      const quoteData = {
        quoteId: quote._id,
        quoteNumber: quote.quoteNumber,
        customerName: quote.leadId.contactName,
        companyName: quote.leadId.company,
        items: quote.items,
        subtotal: quote.subtotal,
        tax: quote.tax,
        total: quote.total,
        validUntil: quote.validUntil,
        notes: quote.notes,
        createdBy: quote.createdBy
      };

      // Send email with quote details
      await this.emailService.sendQuoteEmail(
        tenantId.toString(),
        recipientEmail,
        quoteData
      );

      // Update quote status
      await this.updateQuote(
        tenantId,
        quoteId,
        { status: 'sent' },
        { validateTransition: true }
      );

      this.logger.info('Quote email sent successfully', { 
        quoteId,
        tenantId,
        recipientEmail 
      });
    } catch (error) {
      this.logger.error('Error sending quote email', {
        error,
        tenantId,
        quoteId,
        recipientEmail
      });
      throw error;
    }
  }

  /**
   * Validates quote status transitions
   * @param currentStatus - Current quote status
   * @param newStatus - New quote status
   * @throws Error if transition is invalid
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      draft: ['sent', 'expired'],
      sent: ['accepted', 'rejected', 'expired'],
      accepted: ['expired'],
      rejected: ['expired'],
      expired: []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Notifies relevant stakeholders about quote updates
   * @param quote - Updated quote document
   */
  private async notifyQuoteUpdate(quote: IQuoteDocument): Promise<void> {
    try {
      // Prepare notification data
      const notificationData = {
        quoteId: quote._id,
        quoteNumber: quote.quoteNumber,
        status: quote.status,
        updatedAt: quote.updatedAt,
        total: quote.total
      };

      // Send notifications based on quote status
      switch (quote.status) {
        case 'accepted':
          await this.emailService.sendEmail({
            to: quote.createdBy.email,
            subject: 'Quote Accepted',
            template: 'quote-accepted',
            context: notificationData,
            tenantId: quote.tenantId.toString()
          });
          break;
        case 'rejected':
          await this.emailService.sendEmail({
            to: quote.createdBy.email,
            subject: 'Quote Rejected',
            template: 'quote-rejected',
            context: notificationData,
            tenantId: quote.tenantId.toString()
          });
          break;
        case 'expired':
          await this.emailService.sendEmail({
            to: quote.createdBy.email,
            subject: 'Quote Expired',
            template: 'quote-expired',
            context: notificationData,
            tenantId: quote.tenantId.toString()
          });
          break;
      }
    } catch (error) {
      this.logger.error('Error sending quote update notification', { 
        error,
        quoteId: quote._id 
      });
      // Don't throw error to prevent disrupting the main flow
    }
  }
}

export default QuoteService;