import nodemailer from 'nodemailer'; // ^6.9.0
import handlebars from 'handlebars'; // ^4.7.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^2.4.1
import ClamAV from 'clamav.js'; // ^1.0.0
import { emailConfig } from '../config/email.config';
import { logger } from '../utils/logger';
import { readFileSync } from 'fs';
import { join } from 'path';
import { injectable } from 'inversify';

/**
 * Email priority levels for message handling
 */
enum EmailPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low'
}

/**
 * Security levels for email content
 */
enum EmailSecurityLevel {
  STRICT = 'strict',
  NORMAL = 'normal',
  RELAXED = 'relaxed'
}

/**
 * Interface for secure email attachments
 */
interface ISecureAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  size: number;
  checksum: string;
}

/**
 * Interface for tenant-specific branding
 */
interface ITenantBranding {
  logo: string;
  colors: {
    primary: string;
    secondary: string;
  };
  companyName: string;
  footer: string;
}

/**
 * Interface for rate limiting options
 */
interface IRateLimitOptions {
  points: number;
  duration: number;
  blockDuration: number;
}

/**
 * Interface for email sending options
 */
interface IEmailOptions {
  to: string | string[];
  subject: string;
  template: string;
  context: Record<string, any>;
  tenantId: string;
  branding?: ITenantBranding;
  attachments?: ISecureAttachment[];
  priority?: EmailPriority;
  rateLimitOptions?: IRateLimitOptions;
}

/**
 * Interface for email sending result
 */
interface IEmailResult {
  success: boolean;
  messageId?: string;
  error?: Error;
  timestamp: Date;
  recipient: string | string[];
}

/**
 * Service responsible for handling all email communications with enhanced security
 * and multi-tenant support
 */
@injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private templates: Map<string, HandlebarsTemplateDelegate>;
  private rateLimiter: RateLimiterRedis;
  private virusScanner: typeof ClamAV;
  private readonly securityHeaders: Record<string, string>;

  constructor() {
    this.initializeService().catch(error => {
      logger.error('Failed to initialize EmailService', { error });
      throw error;
    });
  }

  /**
   * Initializes the email service with security configurations
   */
  private async initializeService(): Promise<void> {
    try {
      // Initialize nodemailer with secure SMTP configuration
      this.transporter = nodemailer.createTransport({
        ...emailConfig.smtp,
        secure: true,
        pool: true,
        maxConnections: 5,
        rateDelta: 1000,
        rateLimit: 5
      });

      // Verify SMTP connection
      await this.transporter.verify();
      logger.info('SMTP connection established successfully');

      // Initialize template cache
      this.templates = new Map();
      await this.loadTemplates();

      // Initialize virus scanner
      this.virusScanner = new ClamAV();
      await this.virusScanner.init({
        removeInfected: true,
        quarantinePath: '/var/quarantine',
        debugMode: false
      });

      // Set security headers
      this.securityHeaders = {
        'X-MS-Exchange-Organization-BypassFocusedInbox': 'true',
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block'
      };

    } catch (error) {
      logger.error('EmailService initialization failed', { error });
      throw error;
    }
  }

  /**
   * Loads and compiles email templates with security validation
   */
  private async loadTemplates(): Promise<void> {
    try {
      const templatePath = emailConfig.templates.path;
      const templates = emailConfig.templates;

      for (const [name, template] of Object.entries(templates)) {
        const filePath = join(templatePath, `${name}.hbs`);
        const content = readFileSync(filePath, 'utf-8');

        // Validate template content
        this.validateTemplateContent(content);

        // Compile template with security options
        const compiled = handlebars.compile(content, {
          strict: true,
          noEscape: false,
          preventIndent: true
        });

        this.templates.set(name, compiled);
      }

      logger.info('Email templates loaded successfully');
    } catch (error) {
      logger.error('Failed to load email templates', { error });
      throw error;
    }
  }

  /**
   * Validates template content for security concerns
   */
  private validateTemplateContent(content: string): void {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /onclick/i,
      /onerror/i,
      /data:/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        throw new Error(`Template contains potentially unsafe content: ${pattern}`);
      }
    }
  }

  /**
   * Sends an email with comprehensive security checks and tenant isolation
   */
  public async sendEmail(options: IEmailOptions): Promise<IEmailResult> {
    try {
      // Validate tenant context
      if (!options.tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Apply rate limiting
      await this.checkRateLimit(options.tenantId, options.rateLimitOptions);

      // Get tenant-specific configuration
      const tenantConfig = emailConfig.tenantSpecific.overrides[options.tenantId];

      // Validate recipients
      this.validateRecipients(options.to);

      // Prepare template
      const template = this.templates.get(options.template);
      if (!template) {
        throw new Error(`Template ${options.template} not found`);
      }

      // Process attachments if present
      const secureAttachments = options.attachments 
        ? await this.processAttachments(options.attachments)
        : [];

      // Render email content with tenant branding
      const html = template({
        ...options.context,
        branding: options.branding || tenantConfig?.branding,
        year: new Date().getFullYear()
      });

      // Send email with security headers
      const result = await this.transporter.sendMail({
        from: tenantConfig?.defaults?.from || emailConfig.defaults.from,
        to: options.to,
        subject: options.subject,
        html,
        attachments: secureAttachments,
        headers: {
          ...this.securityHeaders,
          'X-Tenant-ID': options.tenantId,
          'X-Priority': options.priority || EmailPriority.NORMAL
        }
      });

      logger.info('Email sent successfully', {
        tenantId: options.tenantId,
        messageId: result.messageId,
        recipient: options.to
      });

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date(),
        recipient: options.to
      };

    } catch (error) {
      logger.error('Failed to send email', {
        tenantId: options.tenantId,
        error,
        recipient: options.to
      });

      return {
        success: false,
        error: error as Error,
        timestamp: new Date(),
        recipient: options.to
      };
    }
  }

  /**
   * Sends a lead notification email with tenant context
   */
  public async sendLeadNotification(
    tenantId: string,
    recipientEmail: string,
    leadData: Record<string, any>
  ): Promise<IEmailResult> {
    return this.sendEmail({
      to: recipientEmail,
      subject: 'New Lead Notification',
      template: 'lead-notification',
      context: {
        ...leadData,
        timestamp: new Date().toISOString()
      },
      tenantId,
      priority: EmailPriority.HIGH
    });
  }

  /**
   * Sends a quote email with secure attachment handling
   */
  public async sendQuoteEmail(
    tenantId: string,
    recipientEmail: string,
    quoteData: Record<string, any>
  ): Promise<IEmailResult> {
    return this.sendEmail({
      to: recipientEmail,
      subject: 'Quote Details',
      template: 'quote-email',
      context: quoteData,
      tenantId,
      priority: EmailPriority.HIGH,
      attachments: [{
        filename: `quote-${quoteData.quoteId}.pdf`,
        content: quoteData.pdfContent,
        contentType: 'application/pdf',
        size: quoteData.pdfContent.length,
        checksum: this.calculateChecksum(quoteData.pdfContent)
      }]
    });
  }

  /**
   * Validates email recipients for security
   */
  private validateRecipients(recipients: string | string[]): void {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const recipientList = Array.isArray(recipients) ? recipients : [recipients];

    for (const recipient of recipientList) {
      if (!emailPattern.test(recipient)) {
        throw new Error(`Invalid email address: ${recipient}`);
      }

      // Check against blocked patterns
      for (const pattern of emailConfig.security.blockedPatterns) {
        if (pattern.test(recipient)) {
          throw new Error(`Blocked email pattern detected: ${recipient}`);
        }
      }
    }
  }

  /**
   * Processes attachments with virus scanning and size validation
   */
  private async processAttachments(
    attachments: ISecureAttachment[]
  ): Promise<nodemailer.Attachment[]> {
    const processedAttachments: nodemailer.Attachment[] = [];

    for (const attachment of attachments) {
      // Scan for viruses
      const scanResult = await this.virusScanner.scanBuffer(attachment.content);
      if (!scanResult.isClean) {
        throw new Error(`Virus detected in attachment: ${attachment.filename}`);
      }

      // Validate file size
      if (attachment.size > emailConfig.templates.maxSize) {
        throw new Error(`Attachment size exceeds limit: ${attachment.filename}`);
      }

      processedAttachments.push({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        encoding: 'base64'
      });
    }

    return processedAttachments;
  }

  /**
   * Checks rate limits for email sending
   */
  private async checkRateLimit(
    tenantId: string,
    options?: IRateLimitOptions
  ): Promise<void> {
    const limits = options || emailConfig.smtp.rateLimit;

    try {
      await this.rateLimiter.consume(tenantId, 1);
    } catch (error) {
      throw new Error(`Rate limit exceeded for tenant: ${tenantId}`);
    }
  }

  /**
   * Calculates checksum for attachment verification
   */
  private calculateChecksum(content: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

export default EmailService;