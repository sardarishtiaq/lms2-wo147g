import { injectable } from 'inversify';
import { 
    S3,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    GetObjectCommandOutput,
    S3ClientConfig
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import multerS3 from 'multer-s3';
import crypto from 'crypto';
import { storageConfig } from '../config/storage.config';
import { logger } from '../utils/logger';

/**
 * Interface for storage operation options with tenant context
 */
interface IStorageOptions {
    tenantId: string;
    path?: string;
    contentType?: string;
    metadata?: Record<string, string>;
    encryption?: {
        algorithm: string;
        key: string;
    };
    expiration?: number;
    maxSize?: number;
    allowedTypes?: string[];
}

/**
 * Interface defining storage service operations with tenant isolation
 */
interface IStorageService {
    uploadFile(file: Express.Multer.File, options: IStorageOptions): Promise<string>;
    downloadFile(key: string, options: IStorageOptions): Promise<GetObjectCommandOutput>;
    deleteFile(key: string, options: IStorageOptions): Promise<void>;
    getSignedUrl(key: string, options: IStorageOptions): Promise<string>;
    listFiles(prefix: string, options: IStorageOptions): Promise<string[]>;
    validateTenantAccess(key: string, tenantId: string): Promise<boolean>;
    getStorageMetrics(tenantId: string): Promise<any>;
}

/**
 * Enhanced service class implementing secure file storage operations with tenant isolation
 * @version 1.0.0
 */
@injectable()
class StorageService implements IStorageService {
    private s3Client: S3;
    private bucket: string;
    private uploadMiddleware: multer.Multer;
    private readonly encryptionConfig: typeof storageConfig.encryption;
    private readonly tenantConfig: typeof storageConfig.tenantIsolation;

    constructor() {
        // Initialize S3 client with enhanced security settings
        const s3Config: S3ClientConfig = {
            region: storageConfig.region,
            maxAttempts: 3,
            logger: console,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
            }
        };

        this.s3Client = new S3(s3Config);
        this.bucket = storageConfig.bucket;
        this.encryptionConfig = storageConfig.encryption;
        this.tenantConfig = storageConfig.tenantIsolation;

        // Initialize multer with S3 storage and security controls
        this.uploadMiddleware = multer({
            storage: multerS3({
                s3: this.s3Client,
                bucket: this.bucket,
                contentType: multerS3.AUTO_CONTENT_TYPE,
                key: (req, file, cb) => {
                    const tenantId = req.headers['x-tenant-id'] as string;
                    const key = this.generateSecureKey(file.originalname, tenantId);
                    cb(null, key);
                },
                serverSideEncryption: this.encryptionConfig.enabled ? 'AES256' : undefined,
            }),
            limits: {
                fileSize: storageConfig.upload.maxSize,
            },
            fileFilter: (req, file, cb) => {
                this.validateFileType(file, cb);
            }
        });
    }

    /**
     * Uploads a file with enhanced security and tenant isolation
     * @param file - File to upload
     * @param options - Upload options with tenant context
     * @returns Promise<string> - Uploaded file URL
     */
    public async uploadFile(file: Express.Multer.File, options: IStorageOptions): Promise<string> {
        try {
            // Validate tenant access and file metadata
            await this.validateTenantAccess(options.path || '', options.tenantId);
            this.validateFileMetadata(file, options);

            // Generate secure key with tenant isolation
            const key = this.generateSecureKey(file.originalname, options.tenantId);

            const uploadParams = {
                Bucket: this.bucket,
                Key: key,
                Body: file.buffer,
                ContentType: options.contentType || file.mimetype,
                Metadata: {
                    ...options.metadata,
                    tenantId: options.tenantId,
                    uploadedAt: new Date().toISOString()
                },
                ServerSideEncryption: this.encryptionConfig.enabled ? 'AES256' : undefined,
            };

            // Upload file with retry mechanism
            const command = new PutObjectCommand(uploadParams);
            await this.s3Client.send(command);

            // Log successful upload
            logger.info('File uploaded successfully', {
                tenantId: options.tenantId,
                fileKey: key,
                contentType: options.contentType
            });

            return this.generateSecureUrl(key);
        } catch (error) {
            logger.error('File upload failed', {
                tenantId: options.tenantId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Downloads a file with enhanced security checks
     * @param key - File key
     * @param options - Download options with tenant context
     * @returns Promise<GetObjectCommandOutput> - File data
     */
    public async downloadFile(key: string, options: IStorageOptions): Promise<GetObjectCommandOutput> {
        try {
            // Validate tenant access
            await this.validateTenantAccess(key, options.tenantId);

            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            const response = await this.s3Client.send(command);

            // Log successful download
            logger.info('File downloaded successfully', {
                tenantId: options.tenantId,
                fileKey: key
            });

            return response;
        } catch (error) {
            logger.error('File download failed', {
                tenantId: options.tenantId,
                fileKey: key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Deletes a file with tenant validation
     * @param key - File key
     * @param options - Delete options with tenant context
     */
    public async deleteFile(key: string, options: IStorageOptions): Promise<void> {
        try {
            // Validate tenant access
            await this.validateTenantAccess(key, options.tenantId);

            const command = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            await this.s3Client.send(command);

            // Log successful deletion
            logger.info('File deleted successfully', {
                tenantId: options.tenantId,
                fileKey: key
            });
        } catch (error) {
            logger.error('File deletion failed', {
                tenantId: options.tenantId,
                fileKey: key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Generates a signed URL for temporary file access
     * @param key - File key
     * @param options - Signed URL options with tenant context
     * @returns Promise<string> - Signed URL
     */
    public async getSignedUrl(key: string, options: IStorageOptions): Promise<string> {
        try {
            // Validate tenant access
            await this.validateTenantAccess(key, options.tenantId);

            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            const signedUrl = await getSignedUrl(this.s3Client, command, {
                expiresIn: options.expiration || 3600,
            });

            // Log URL generation
            logger.info('Signed URL generated', {
                tenantId: options.tenantId,
                fileKey: key,
                expiration: options.expiration
            });

            return signedUrl;
        } catch (error) {
            logger.error('Signed URL generation failed', {
                tenantId: options.tenantId,
                fileKey: key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Lists files for a specific tenant
     * @param prefix - File prefix
     * @param options - List options with tenant context
     * @returns Promise<string[]> - List of file keys
     */
    public async listFiles(prefix: string, options: IStorageOptions): Promise<string[]> {
        try {
            const tenantPrefix = this.getTenantPrefix(options.tenantId, prefix);
            const command = new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: tenantPrefix,
            });

            const response = await this.s3Client.send(command);
            return (response.Contents || []).map(item => item.Key || '');
        } catch (error) {
            logger.error('File listing failed', {
                tenantId: options.tenantId,
                prefix,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Validates tenant access to a file
     * @param key - File key
     * @param tenantId - Tenant ID
     * @returns Promise<boolean> - Access validation result
     */
    public async validateTenantAccess(key: string, tenantId: string): Promise<boolean> {
        if (!this.tenantConfig.enabled) {
            return true;
        }

        const tenantPrefix = this.getTenantPrefix(tenantId);
        if (!key.startsWith(tenantPrefix)) {
            logger.error('Invalid tenant access attempt', {
                tenantId,
                fileKey: key
            });
            throw new Error('Access denied: Invalid tenant context');
        }

        return true;
    }

    /**
     * Retrieves storage metrics for a tenant
     * @param tenantId - Tenant ID
     * @returns Promise<any> - Storage metrics
     */
    public async getStorageMetrics(tenantId: string): Promise<any> {
        try {
            const tenantPrefix = this.getTenantPrefix(tenantId);
            const command = new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: tenantPrefix,
            });

            const response = await this.s3Client.send(command);
            const totalSize = (response.Contents || [])
                .reduce((acc, item) => acc + (item.Size || 0), 0);

            return {
                fileCount: response.KeyCount || 0,
                totalSize,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Storage metrics retrieval failed', {
                tenantId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Generates a secure file key with tenant isolation
     * @private
     */
    private generateSecureKey(filename: string, tenantId: string): string {
        const hash = crypto.createHash('sha256')
            .update(`${tenantId}-${filename}-${Date.now()}`)
            .digest('hex')
            .substring(0, 8);

        return `${this.getTenantPrefix(tenantId)}/${hash}-${filename}`;
    }

    /**
     * Gets tenant-specific storage prefix
     * @private
     */
    private getTenantPrefix(tenantId: string, additionalPrefix?: string): string {
        const base = this.tenantConfig.pathPrefix.replace('${tenantId}', tenantId);
        return additionalPrefix ? `${base}/${additionalPrefix}` : base;
    }

    /**
     * Validates file metadata and type
     * @private
     */
    private validateFileMetadata(file: Express.Multer.File, options: IStorageOptions): void {
        if (options.maxSize && file.size > options.maxSize) {
            throw new Error(`File size exceeds maximum allowed size of ${options.maxSize} bytes`);
        }

        if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
            throw new Error(`File type ${file.mimetype} is not allowed`);
        }
    }

    /**
     * Validates file type for upload
     * @private
     */
    private validateFileType(file: Express.Multer.File, cb: multer.FileFilterCallback): void {
        const allowedTypes = storageConfig.upload.allowedTypes;
        if (!allowedTypes.includes(file.mimetype)) {
            cb(new Error(`File type ${file.mimetype} is not allowed`));
            return;
        }
        cb(null, true);
    }

    /**
     * Generates a secure URL for file access
     * @private
     */
    private generateSecureUrl(key: string): string {
        return `https://${this.bucket}.s3.${storageConfig.region}.amazonaws.com/${key}`;
    }
}

export default StorageService;
export { IStorageService, IStorageOptions };