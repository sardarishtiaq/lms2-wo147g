// @ts-check
import { config } from 'dotenv'; // ^16.0.0
config();

/**
 * Interface for lifecycle management rules
 */
interface LifecycleRule {
  enabled: boolean;
  prefix?: string;
  expireInDays?: number;
  transitionInDays?: number;
  storageClass?: string;
}

/**
 * Comprehensive storage configuration interface for multi-tenant CRM system
 */
interface StorageConfig {
  provider: string;
  region: string;
  bucket: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  encryption: {
    enabled: boolean;
    kmsKeyId: string;
    algorithm: string;
    enforceEncryption: boolean;
  };
  tenantIsolation: {
    enabled: boolean;
    pathPrefix: string;
    enforceIsolation: boolean;
    accessControl: {
      type: string;
      policies: string[];
    };
  };
  upload: {
    maxSize: number;
    allowedTypes: string[];
    scanVirus: boolean;
    validateContent: boolean;
  };
  lifecycle: {
    enabled: boolean;
    rules: LifecycleRule[];
  };
}

/**
 * Validates the storage configuration for security and completeness
 * @param {StorageConfig} config - Storage configuration to validate
 * @throws {Error} Detailed error message if configuration is invalid
 */
const validateStorageConfig = (config: StorageConfig): void => {
  // Validate AWS credentials
  if (!config.credentials.accessKeyId || !config.credentials.secretAccessKey) {
    throw new Error('AWS credentials are required');
  }

  // Validate bucket configuration
  if (!config.bucket) {
    throw new Error('S3 bucket name is required');
  }

  // Validate encryption settings
  if (config.encryption.enabled && !config.encryption.kmsKeyId) {
    throw new Error('KMS Key ID is required when encryption is enabled');
  }

  // Validate tenant isolation
  if (config.tenantIsolation.enabled && !config.tenantIsolation.pathPrefix) {
    throw new Error('Path prefix is required for tenant isolation');
  }

  // Validate upload configuration
  if (config.upload.maxSize <= 0) {
    throw new Error('Invalid maximum file size');
  }

  if (!config.upload.allowedTypes.length) {
    throw new Error('At least one allowed file type must be specified');
  }
};

/**
 * Storage configuration for the multi-tenant CRM system
 * Provides secure AWS S3 integration with tenant isolation and encryption
 */
export const storageConfig: StorageConfig = {
  provider: 'aws-s3',
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.AWS_BUCKET_NAME || '',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  encryption: {
    enabled: true,
    kmsKeyId: process.env.AWS_KMS_KEY_ID || '',
    algorithm: 'AES256',
    enforceEncryption: true,
  },
  tenantIsolation: {
    enabled: true,
    pathPrefix: 'tenants/${tenantId}',
    enforceIsolation: true,
    accessControl: {
      type: 'IAM',
      policies: [
        'bucket-owner-full-control',
        'tenant-restricted-access'
      ],
    },
  },
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB default
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx'
    ],
    scanVirus: true,
    validateContent: true,
  },
  lifecycle: {
    enabled: true,
    rules: [
      {
        enabled: true,
        prefix: 'temp/',
        expireInDays: 1,
      },
      {
        enabled: true,
        prefix: 'archives/',
        transitionInDays: 90,
        storageClass: 'GLACIER',
      },
    ],
  },
};

// Validate configuration on module load
validateStorageConfig(storageConfig);

// Export the validated storage configuration
export default storageConfig;

// Export types for consumers
export type { StorageConfig, LifecycleRule };