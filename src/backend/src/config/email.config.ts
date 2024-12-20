// @ts-check
import { config } from 'dotenv'; // ^16.0.0
import { existsSync } from 'fs';
import { isEmail } from 'validator';
import { deepFreeze, deepMerge } from '../utils/object.utils';

// Load environment variables
config();

/**
 * Interface defining the structure of email configuration with multi-tenant support
 */
export interface IEmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    rateLimit: {
      maxPerSecond: number;
      maxPerDay: number;
    };
  };
  defaults: {
    from: string;
    replyTo: string;
    headers: Record<string, string>;
    attachments: Array<{ filename: string; path: string }>;
  };
  templates: {
    path: string;
    options: {
      cache: boolean;
      preventIndent: boolean;
      compileOptions: Record<string, any>;
    };
    defaultVariables: Record<string, any>;
  };
  tenantSpecific: {
    enabled: boolean;
    overrides: Record<string, Partial<IEmailConfig>>;
    validationRules: Record<string, Array<string>>;
  };
  security: {
    encryptAttachments: boolean;
    allowedDomains: string[];
    blockedPatterns: RegExp[];
  };
}

// Global configuration constants from environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO;
const EMAIL_RATE_LIMIT_PER_SECOND = parseInt(process.env.EMAIL_RATE_LIMIT_PER_SECOND || '10', 10);
const EMAIL_RATE_LIMIT_PER_DAY = parseInt(process.env.EMAIL_RATE_LIMIT_PER_DAY || '50000', 10);
const EMAIL_TEMPLATE_PATH = process.env.EMAIL_TEMPLATE_PATH || './templates';
const EMAIL_TEMPLATE_CACHE = process.env.EMAIL_TEMPLATE_CACHE === 'true';

/**
 * Default email configuration object
 */
export const emailConfig: IEmailConfig = deepFreeze({
  smtp: {
    host: SMTP_HOST || 'smtp.sendgrid.net',
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER || '',
      pass: SMTP_PASS || '',
    },
    rateLimit: {
      maxPerSecond: EMAIL_RATE_LIMIT_PER_SECOND,
      maxPerDay: EMAIL_RATE_LIMIT_PER_DAY,
    },
  },
  defaults: {
    from: EMAIL_FROM || 'noreply@crm.com',
    replyTo: EMAIL_REPLY_TO || 'support@crm.com',
    headers: {
      'X-SES-CONFIGURATION-SET': 'crm-email-tracking',
      'X-CRM-System': 'multi-tenant-crm',
    },
    attachments: [],
  },
  templates: {
    path: EMAIL_TEMPLATE_PATH,
    options: {
      cache: EMAIL_TEMPLATE_CACHE,
      preventIndent: true,
      compileOptions: {
        strict: true,
        assumeObjects: true,
      },
    },
    defaultVariables: {
      year: new Date().getFullYear(),
      systemName: 'Multi-tenant CRM',
    },
  },
  tenantSpecific: {
    enabled: true,
    overrides: {},
    validationRules: {
      from: ['required', 'email'],
      'smtp.host': ['required', 'string'],
      'smtp.port': ['required', 'number', 'port'],
    },
  },
  security: {
    encryptAttachments: true,
    allowedDomains: ['crm.com', 'tenant.com'],
    blockedPatterns: [
      /^(?!.*@).*/,  // Blocks email addresses without @
      /^[^@]*@.*\.(ru|cn)$/i,  // Blocks specific TLDs
    ],
  },
});

/**
 * Validates email configuration including tenant-specific settings
 * @param config - Email configuration object to validate
 * @param tenantId - Optional tenant ID for tenant-specific validation
 * @returns boolean - True if valid, throws error if invalid
 */
export function validateEmailConfig(
  config: IEmailConfig,
  tenantId?: string
): boolean {
  // Validate SMTP configuration
  if (!config.smtp.host) {
    throw new Error('SMTP host is required');
  }

  if (!config.smtp.port || config.smtp.port < 1 || config.smtp.port > 65535) {
    throw new Error('Invalid SMTP port number');
  }

  // Validate email addresses
  if (!isEmail(config.defaults.from)) {
    throw new Error('Invalid from email address');
  }

  if (!isEmail(config.defaults.replyTo)) {
    throw new Error('Invalid replyTo email address');
  }

  // Validate template path
  if (!existsSync(config.templates.path)) {
    throw new Error('Template path does not exist');
  }

  // Validate rate limits
  if (config.smtp.rateLimit.maxPerSecond < 1) {
    throw new Error('Invalid rate limit per second');
  }

  if (config.smtp.rateLimit.maxPerDay < 1) {
    throw new Error('Invalid rate limit per day');
  }

  // Validate tenant-specific configuration if provided
  if (tenantId && config.tenantSpecific.enabled) {
    const tenantConfig = config.tenantSpecific.overrides[tenantId];
    if (tenantConfig) {
      // Validate tenant-specific email addresses
      if (tenantConfig.defaults?.from && !isEmail(tenantConfig.defaults.from)) {
        throw new Error(`Invalid tenant-specific from email address for tenant ${tenantId}`);
      }

      // Validate tenant-specific SMTP settings
      if (tenantConfig.smtp?.port && (tenantConfig.smtp.port < 1 || tenantConfig.smtp.port > 65535)) {
        throw new Error(`Invalid tenant-specific SMTP port for tenant ${tenantId}`);
      }
    }
  }

  return true;
}

/**
 * Retrieves tenant-specific email configuration with fallback to defaults
 * @param tenantId - Tenant identifier
 * @returns IEmailConfig - Merged configuration for specific tenant
 */
export function getTenantEmailConfig(tenantId: string): IEmailConfig {
  if (!emailConfig.tenantSpecific.enabled) {
    return emailConfig;
  }

  const tenantOverrides = emailConfig.tenantSpecific.overrides[tenantId];
  if (!tenantOverrides) {
    return emailConfig;
  }

  // Deep merge default config with tenant overrides
  const mergedConfig = deepMerge(emailConfig, tenantOverrides) as IEmailConfig;

  // Validate merged configuration
  validateEmailConfig(mergedConfig, tenantId);

  // Return immutable configuration
  return deepFreeze(mergedConfig);
}

// Export frozen default configuration
export default deepFreeze(emailConfig);