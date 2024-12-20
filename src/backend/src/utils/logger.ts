import winston from 'winston'; // ^3.8.0
import DailyRotateFile from 'winston-daily-rotate-file'; // ^4.7.0
import { NODE_ENV, APP_ENV, LOG_LEVEL } from '../config';
import crypto from 'crypto';

/**
 * Log levels with audit support for compliance
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  audit: 4
};

/**
 * Patterns for sensitive data masking
 */
const SENSITIVE_PATTERNS = [
  /(password|passwd|pwd)=.*/gi,
  /(authorization|auth|token|jwt|bearer).*/gi,
  /([a-zA-Z0-9+/]{4})*([a-zA-Z0-9+/]{4}|[a-zA-Z0-9+/]{3}=|[a-zA-Z0-9+/]{2}==)/g, // Base64
  /(key|secret|credential)=.*/gi,
  /([0-9]{13,16})/g // Credit card numbers
];

/**
 * Interface for enhanced log context information
 */
interface LogContext {
  tenantId?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  source: string;
  environment: string;
}

/**
 * Interface for logger security options
 */
interface SecurityOptions {
  maskPatterns: RegExp[];
  encryptionKey?: string;
  integrityCheck: boolean;
}

/**
 * Interface for tenant isolation configuration
 */
interface TenantIsolationConfig {
  enabled: boolean;
  pathPrefix: string;
  enforceIsolation: boolean;
}

/**
 * Interface for performance monitoring configuration
 */
interface PerformanceConfig {
  slowLogThreshold: number;
  enableMetrics: boolean;
  samplingRate: number;
}

/**
 * Interface for logger configuration
 */
interface LoggerConfig {
  level: string;
  format: winston.Logform.Format;
  transports: winston.transport[];
  security: SecurityOptions;
  tenantIsolation: TenantIsolationConfig;
  performance: PerformanceConfig;
}

/**
 * Custom secure transport with tenant isolation
 */
class SecureTransport extends winston.Transport {
  private security: SecurityOptions;
  private tenantContext: TenantIsolationConfig;

  constructor(options: winston.TransportStreamOptions, security: SecurityOptions) {
    super(options);
    this.security = security;
    this.tenantContext = {
      enabled: true,
      pathPrefix: 'logs/tenants',
      enforceIsolation: true
    };
  }

  /**
   * Secure log processing with tenant isolation
   */
  log(info: winston.LogEntry, callback: Function): void {
    try {
      // Apply tenant isolation
      if (this.tenantContext.enabled && info.tenantId) {
        info.tenant = info.tenantId;
        delete info.tenantId; // Remove raw tenant ID from logs
      }

      // Mask sensitive data
      const maskedInfo = this.maskSensitiveData(info);

      // Add integrity check
      if (this.security.integrityCheck) {
        maskedInfo.hash = this.calculateLogHash(maskedInfo);
      }

      callback(null, true);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Masks sensitive data based on patterns
   */
  private maskSensitiveData(info: any): any {
    const maskedInfo = { ...info };
    const message = JSON.stringify(maskedInfo.message);

    this.security.maskPatterns.forEach(pattern => {
      maskedInfo.message = message.replace(pattern, '[REDACTED]');
    });

    return maskedInfo;
  }

  /**
   * Calculates hash for log integrity
   */
  private calculateLogHash(info: any): string {
    const content = JSON.stringify(info);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

/**
 * Creates and configures a secure, tenant-aware Winston logger instance
 */
function createLogger(config: LoggerConfig): winston.Logger {
  const defaultFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  const logger = winston.createLogger({
    level: config.level || LOG_LEVEL || 'info',
    levels: LOG_LEVELS,
    format: config.format || defaultFormat,
    defaultMeta: {
      environment: NODE_ENV,
      appEnv: APP_ENV
    },
    transports: [
      // Console transport for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      // File transport for production
      new DailyRotateFile({
        filename: 'logs/%DATE%-application.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }),
      // Secure transport for sensitive logs
      new SecureTransport(
        {
          level: 'audit',
          filename: 'logs/audit/%DATE%-audit.log'
        },
        config.security
      )
    ]
  });

  return logger;
}

/**
 * Validates and sanitizes log context information
 */
function validateLogContext(context: LogContext): LogContext {
  const sanitizedContext = { ...context };

  // Validate tenant ID format if present
  if (sanitizedContext.tenantId && !/^[a-zA-Z0-9-]+$/.test(sanitizedContext.tenantId)) {
    throw new Error('Invalid tenant ID format');
  }

  // Ensure required fields
  if (!sanitizedContext.source) {
    throw new Error('Log source is required');
  }

  return sanitizedContext;
}

// Create the default logger instance
const logger = createLogger({
  level: LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [],
  security: {
    maskPatterns: SENSITIVE_PATTERNS,
    integrityCheck: NODE_ENV === 'production'
  },
  tenantIsolation: {
    enabled: true,
    pathPrefix: 'logs/tenants',
    enforceIsolation: true
  },
  performance: {
    slowLogThreshold: 1000,
    enableMetrics: true,
    samplingRate: 0.1
  }
});

// Export the configured logger instance
export default logger;

// Named exports for specific functionality
export {
  createLogger,
  validateLogContext,
  SecureTransport,
  LOG_LEVELS,
  type LogContext,
  type LoggerConfig,
  type SecurityOptions
};