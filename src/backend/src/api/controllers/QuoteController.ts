/**
 * @fileoverview Quote Controller implementing RESTful API endpoints for quote management
 * with comprehensive security, tenant isolation, and error handling.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { rateLimit } from 'express-rate-limit'; // ^6.7.0
import { QuoteService } from '../../services/QuoteService';
import { IQuote } from '../../interfaces/IQuote';
import logger from '../../utils/logger';

/**
 * Rate limiter configuration for quote operations
 */
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each tenant to 100 requests per windowMs
  message: 'Too many quote requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Controller handling HTTP requests for quote management with enhanced security
 * and tenant isolation.
 */
export class QuoteController {
  private readonly quoteService: QuoteService;
  private readonly rateLimiter: any;

  constructor(quoteService: QuoteService) {
    this.quoteService = quoteService;
    this.rateLimiter = rateLimit({
      ...RATE_LIMIT_CONFIG,
      keyGenerator: (req: Request) => `${req.tenantId}:quotes`,
    });
  }

  /**
   * Creates a new quote with tenant isolation and security validation
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  public async createQuote(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = req;
      const quoteData: Partial<IQuote> = req.body;

      logger.debug('Creating new quote', { tenantId, leadId: quoteData.leadId });

      // Validate tenant context
      if (!tenantId) {
        throw new Error('Tenant context is required');
      }

      // Create quote with tenant isolation
      const createdQuote = await this.quoteService.createQuote(
        tenantId,
        quoteData.leadId!,
        quoteData,
        {
          generatePDF: req.query.generatePdf === 'true',
          sendEmail: req.query.sendEmail === 'true',
          recipientEmail: req.body.recipientEmail,
        }
      );

      logger.info('Quote created successfully', {
        quoteId: createdQuote._id,
        tenantId,
      });

      res.status(201).json({
        success: true,
        data: createdQuote,
      });
    } catch (error) {
      logger.error('Error creating quote', { error, tenantId: req.tenantId });
      next(error);
    }
  }

  /**
   * Updates quote with ownership verification and concurrency handling
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  public async updateQuote(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = req;
      const { quoteId } = req.params;
      const updateData: Partial<IQuote> = req.body;

      logger.debug('Updating quote', { tenantId, quoteId });

      // Validate tenant context and ownership
      await this.quoteService.validateQuoteOwnership(tenantId, quoteId);

      // Validate status transition if status is being updated
      if (updateData.status) {
        await this.quoteService.validateStatusTransition(
          quoteId,
          updateData.status
        );
      }

      // Update quote with tenant isolation
      const updatedQuote = await this.quoteService.updateQuote(
        tenantId,
        quoteId,
        updateData,
        {
          recalculateTotals: true,
          notifyStakeholders: req.query.notify === 'true',
          validateTransition: true,
        }
      );

      logger.info('Quote updated successfully', { quoteId, tenantId });

      res.status(200).json({
        success: true,
        data: updatedQuote,
      });
    } catch (error) {
      logger.error('Error updating quote', {
        error,
        tenantId: req.tenantId,
        quoteId: req.params.quoteId,
      });
      next(error);
    }
  }

  /**
   * Retrieves quote with tenant validation and caching
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  public async getQuoteById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = req;
      const { quoteId } = req.params;

      logger.debug('Retrieving quote', { tenantId, quoteId });

      // Validate tenant context and ownership
      await this.quoteService.validateQuoteOwnership(tenantId, quoteId);

      // Get quote with tenant isolation
      const quote = await this.quoteService.getQuoteById(quoteId, {
        populate: ['leadId', 'createdBy'],
      });

      if (!quote) {
        res.status(404).json({
          success: false,
          error: 'Quote not found',
        });
        return;
      }

      logger.info('Quote retrieved successfully', { quoteId, tenantId });

      res.status(200).json({
        success: true,
        data: quote,
      });
    } catch (error) {
      logger.error('Error retrieving quote', {
        error,
        tenantId: req.tenantId,
        quoteId: req.params.quoteId,
      });
      next(error);
    }
  }

  /**
   * Retrieves lead quotes with pagination and filtering
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  public async getQuotesByLead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = req;
      const { leadId } = req.params;
      const { page = 1, limit = 10, status } = req.query;

      logger.debug('Retrieving quotes by lead', { tenantId, leadId });

      // Get quotes with tenant isolation
      const quotes = await this.quoteService.getQuotesByLead(leadId, {
        page: Number(page),
        limit: Number(limit),
        status: status as string[],
        populate: ['createdBy'],
      });

      logger.info('Quotes retrieved successfully', {
        leadId,
        tenantId,
        count: quotes.length,
      });

      res.status(200).json({
        success: true,
        data: quotes,
        pagination: {
          page: Number(page),
          limit: Number(limit),
        },
      });
    } catch (error) {
      logger.error('Error retrieving quotes by lead', {
        error,
        tenantId: req.tenantId,
        leadId: req.params.leadId,
      });
      next(error);
    }
  }

  /**
   * Sends quote email with rate limiting and security
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  public async sendQuote(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tenantId } = req;
      const { quoteId } = req.params;
      const { recipientEmail, template } = req.body;

      logger.debug('Sending quote email', {
        tenantId,
        quoteId,
        recipientEmail,
      });

      // Validate tenant context and ownership
      await this.quoteService.validateQuoteOwnership(tenantId, quoteId);

      // Send quote email
      await this.quoteService.sendQuoteEmail(
        tenantId,
        quoteId,
        recipientEmail,
        template
      );

      logger.info('Quote email sent successfully', {
        quoteId,
        tenantId,
        recipientEmail,
      });

      res.status(200).json({
        success: true,
        message: 'Quote email sent successfully',
      });
    } catch (error) {
      logger.error('Error sending quote email', {
        error,
        tenantId: req.tenantId,
        quoteId: req.params.quoteId,
      });
      next(error);
    }
  }
}

export default QuoteController;